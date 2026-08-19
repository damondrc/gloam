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
                Ok(()) => true,
                Err(error) => {
                    eprintln!("gloam: no tray icon ({error}); closing will quit");
                    false
                }
            };

            #[cfg(not(desktop))]
            let tray = false;

            app.manage(TrayPresence(tray));

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
///
/// Generic over the runtime rather than taking the plain `AppHandle`, which is
/// the concrete one. The single-instance plugin is built generically, so a
/// concrete call from inside its callback would pin the whole plugin to one
/// runtime and stop it satisfying its own signature.
fn surface<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_always_on_top(true);
        let _ = window.set_focus();
    }
}

/// What the widget's close button does.
///
/// With a tray, closing hides: the run carries on, and the icon is the way
/// back. Without one, hiding would be indistinguishable from losing the app,
/// so it quits instead — which is what it has always done.
#[tauri::command]
fn dismiss(app: tauri::AppHandle, window: tauri::Window, tray: tauri::State<'_, TrayPresence>) {
    if tray.0 {
        let _ = window.hide();
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
#[cfg(desktop)]
fn build_tray(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

    let show = MenuItem::with_id(app, "show", "Show Gloam", true, None::<&str>)?;
    let recover = MenuItem::with_id(app, "recover", "Reset position", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show, &recover, &separator, &quit])?;

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
            "show" => surface(app),
            "recover" => {
                surface(app);
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.center();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                surface(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
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
fn single_instance_plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
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
