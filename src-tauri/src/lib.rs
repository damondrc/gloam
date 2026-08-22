use tauri::Manager;

/// Emitted to the frontend when the user asks to toggle lock mode from outside
/// the window. Locking makes the widget click-through, so this shortcut is the
/// guaranteed way back in if hit-testing the padlock ever fails.
const TOGGLE_LOCK_EVENT: &str = "gloam://toggle-lock";

/// Whether a tray icon actually exists.
///
/// It usually does, and on a desktop that has no tray — or has one turned off,
/// which several Linux environments do by default — it does not. That single
/// fact decides what the widget's close button means, so it is answered once
/// at startup and asked by the frontend rather than guessed at.
struct TrayPresence(bool);

/// Where the window was standing when it was last hidden.
///
/// Hiding and showing a window on X11 is an unmap and a remap, and a remapped
/// window is a new one as far as the window manager is concerned: it places it
/// wherever its own policy says, which is usually somewhere near the top left
/// and occasionally somewhere else entirely. Windows keeps the position across
/// the same pair of calls and needs none of this.
///
/// Rather than depend on which platform is being polite, the position is
/// written down on the way out and put back on the way in. Taken rather than
/// read, so it only ever applies to a window that is actually coming back from
/// being hidden — surfacing one that was merely behind something else should
/// not move it.
struct HiddenAt(std::sync::Mutex<Option<tauri::PhysicalPosition<i32>>>);

/// The tray menu's first entry, kept so its wording can follow the window.
///
/// It says `Hide Gloam` while the widget is out and `Show Gloam` while it is
/// away. A single entry that does both, rather than two entries of which one is
/// always wrong — and on Linux it is the only way to put the widget away at
/// all, since the AppIndicator protocol that Linux trays speak has no notion of
/// a click on an icon.
struct ToggleEntry(tauri::menu::MenuItem<tauri::Wry>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    // Must be registered before anything else, so a duplicate launch is turned
    // away before it has a chance to create a window or claim a shortcut.
    #[cfg(desktop)]
    let builder = builder.plugin(single_instance_plugin());

    #[cfg(desktop)]
    let builder = builder.plugin(global_shortcut_plugin());

    builder
        .invoke_handler(tauri::generate_handler![dismiss, tray_present])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                // The window is also declared always-on-top in tauri.conf.json,
                // but some Windows shells drop the flag when a window is created
                // while another app is fullscreen. Re-asserting it here is cheap
                // insurance.
                let _ = window.set_always_on_top(true);
            }

            // A tray that cannot be built must not stop the widget opening, for
            // the same reason a global shortcut that cannot be registered does
            // not: it is a convenience with a fallback, and the fallback is
            // that closing goes back to meaning what it used to.
            #[cfg(desktop)]
            let tray = match build_tray(app.handle()) {
                Ok(entry) => {
                    app.manage(ToggleEntry(entry));
                    true
                }
                Err(error) => {
                    eprintln!("gloam: no tray icon ({error}); closing will quit");
                    false
                }
            };

            #[cfg(not(desktop))]
            let tray = false;

            app.manage(TrayPresence(tray));
            app.manage(HiddenAt(std::sync::Mutex::new(None)));

            #[cfg(desktop)]
            register_toggle_shortcut(app.handle())?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Gloam");
}

/// Brings the widget back into view, wherever it had got to.
///
/// Every route back to the window goes through here — the tray icon, its menu,
/// and a second launch — so none of them can be subtly different from the
/// others. Always-on-top is re-asserted because a window that has been hidden
/// and shown again is, as far as some shells are concerned, a new one.
fn surface(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    // Placed before it is shown, so the window manager maps it where it
    // belongs. Showing first and correcting afterwards also works, and looks
    // like the widget stumbling into place: it appears wherever the manager
    // felt like putting it and then jumps, a frame later, to where it was
    // actually left.
    let hidden = take_hidden_position(app);
    if let Some(position) = hidden {
        let _ = window.set_position(position);
    }

    let _ = window.show();
    let _ = window.unminimize();

    // And again once it is mapped. A position set on an unmapped window is a
    // hint, and a window manager is free to decline it; when the first attempt
    // was honoured this is the same coordinates and moves nothing at all.
    if let Some(position) = hidden {
        let _ = window.set_position(position);
    }

    let _ = window.set_always_on_top(true);
    let _ = window.set_focus();
    set_toggle_entry(app, true);
}

/// Whether the widget is on screen at all — mapped, rather than in front.
fn is_showing(app: &tauri::AppHandle) -> bool {
    app.get_webview_window("main")
        .and_then(|window| window.is_visible().ok())
        .unwrap_or(false)
}

/// One gesture for both directions: put it away if it is out, bring it back if
/// it is not. Used by the menu entry and, where the platform reports one, by a
/// click on the icon.
fn toggle_window(app: &tauri::AppHandle) {
    if is_showing(app) {
        hide_to_tray(app);
    } else {
        surface(app);
    }
}

/// Keeps the menu entry describing what it will do next.
fn set_toggle_entry(app: &tauri::AppHandle, showing: bool) {
    if let Some(entry) = app.try_state::<ToggleEntry>() {
        let _ = entry
            .0
            .set_text(if showing { "Hide Gloam" } else { "Show Gloam" });
    }
}

/// Reads and clears the position the window was last hidden from.
///
/// Taken rather than read: it should only ever apply to a window actually
/// coming back from being hidden. Surfacing one that was merely behind
/// something else must not move it.
fn take_hidden_position(app: &tauri::AppHandle) -> Option<tauri::PhysicalPosition<i32>> {
    app.try_state::<HiddenAt>()?.0.lock().ok()?.take()
}

/// Puts the widget away, remembering where it stood.
fn hide_to_tray(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    if let (Ok(position), Some(state)) = (window.outer_position(), app.try_state::<HiddenAt>()) {
        if let Ok(mut hidden) = state.0.lock() {
            *hidden = Some(position);
        }
    }

    let _ = window.hide();
    set_toggle_entry(app, false);
}

/// What the widget's close button does.
///
/// With a tray, closing hides: the run carries on, and the icon is the way
/// back. Without one, hiding would be indistinguishable from losing the app,
/// so it quits instead — which is what it has always done.
#[tauri::command]
fn dismiss(app: tauri::AppHandle, tray: tauri::State<'_, TrayPresence>) {
    if tray.0 {
        hide_to_tray(&app);
    } else {
        app.exit(0);
    }
}

#[tauri::command]
fn tray_present(tray: tauri::State<'_, TrayPresence>) -> bool {
    tray.0
}

/// The tray icon and its menu.
///
/// Three entries, and the middle one is why this exists at all. An always
/// on-top window with no frame can be dragged somewhere unhelpful, left on a
/// monitor that is later unplugged, or hidden behind its own lock mode — and
/// none of those has a way out from inside the widget. `Reset position` is the
/// way out, and it is what makes remembering the window's position safe to
/// build next.
///
/// It centres rather than returning to the configured corner, because the
/// corner is itself a position that may no longer exist: the whole failure
/// being recovered from is a monitor layout that changed. The middle of the
/// primary display is the one place that is always there.
///
/// Nothing else goes in here. The tray is an escape hatch, not a second copy
/// of the interface — a start button in a menu would be a control with none of
/// the widget's own language around it, in a place the widget cannot draw.
///
/// Returns the first entry so its wording can be kept in step with the window.
#[cfg(desktop)]
fn build_tray(
    app: &tauri::AppHandle,
) -> Result<tauri::menu::MenuItem<tauri::Wry>, Box<dyn std::error::Error>> {
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

    // Named for what it will do, and the window starts out on screen.
    let toggle = MenuItem::with_id(app, "toggle", "Hide Gloam", true, None::<&str>)?;
    let recover = MenuItem::with_id(app, "recover", "Reset position", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&toggle, &recover, &separator, &quit])?;

    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or("the bundle has no default window icon")?;

    TrayIconBuilder::with_id("gloam")
        .icon(icon)
        .tooltip("Gloam")
        .menu(&menu)
        // Left click surfaces the widget; the menu is on the right button,
        // where a menu belongs. Opening a menu to press "show" would make the
        // common case the slow one.
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "toggle" => toggle_window(app),
            "recover" => {
                surface(app);
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.center();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        // A left click is a toggle: put it away if it is out, bring it back if
        // it is not. One gesture for both directions, because "click to show"
        // with no way back leaves the user hunting through a menu for the
        // opposite of what they just did.
        //
        // Windows only. The AppIndicator protocol that Linux trays speak has
        // no notion of a click on the icon — it offers a menu and nothing
        // else — so this never fires there and the menu is the whole
        // interface. See the note in the README.
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(toggle)
}

/// Refuses to start a second copy.
///
/// Two Gloams are worse than they sound. The window opens at a fixed position,
/// so a duplicate lands exactly on top of the original and reads as one widget
/// behaving strangely. Worse, only one process can hold a global shortcut, so
/// the second copy silently loses Ctrl+Alt+G — and if the first copy is locked
/// and therefore click-through, the user is left with a stack of windows, no
/// visible close button and no working escape hatch.
#[cfg(desktop)]
fn single_instance_plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri_plugin_single_instance::init(|app, _args, _cwd| {
        // Surface the copy that is already running instead of doing nothing,
        // so launching again reads as "here it is" rather than a failure. It
        // matters more now that closing only hides: launching from the start
        // menu is the other way back in, for anyone who never looks at a tray.
        surface(app);
    })
}

#[cfg(desktop)]
fn toggle_shortcut() -> tauri_plugin_global_shortcut::Shortcut {
    use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut};

    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyG)
}

#[cfg(desktop)]
fn global_shortcut_plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    use tauri::Emitter;
    use tauri_plugin_global_shortcut::ShortcutState;

    let target = toggle_shortcut();

    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(move |app, shortcut, event| {
            // Fire on press only; without this the widget would toggle twice
            // per keystroke.
            if shortcut == &target && event.state() == ShortcutState::Pressed {
                let _ = app.emit(TOGGLE_LOCK_EVENT, ());
            }
        })
        .build()
}

#[cfg(desktop)]
fn register_toggle_shortcut(app: &tauri::AppHandle) -> tauri::Result<()> {
    use tauri_plugin_global_shortcut::GlobalShortcutExt;

    // A conflict with another application must not stop the widget from
    // opening; the padlock still works without the shortcut.
    if let Err(error) = app.global_shortcut().register(toggle_shortcut()) {
        eprintln!("gloam: could not register Ctrl+Alt+G ({error})");
    }
    Ok(())
}
