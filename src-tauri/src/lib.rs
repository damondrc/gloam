use tauri::Manager;

/// Emitted to the frontend when the user asks to toggle lock mode from outside
/// the window. Locking makes the widget click-through, so this shortcut is the
/// guaranteed way back in if hit-testing the padlock ever fails.
const TOGGLE_LOCK_EVENT: &str = "gloam://toggle-lock";

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
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                // The window is also declared always-on-top in tauri.conf.json,
                // but some Windows shells drop the flag when a window is created
                // while another app is fullscreen. Re-asserting it here is cheap
                // insurance.
                let _ = window.set_always_on_top(true);
            }

            #[cfg(desktop)]
            register_toggle_shortcut(app.handle())?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Gloam");
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
        // so launching again reads as "here it is" rather than a failure.
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
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
