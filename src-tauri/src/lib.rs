use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                // The window is also declared always-on-top in tauri.conf.json,
                // but some Windows shells drop the flag when a window is created
                // while another app is fullscreen. Re-asserting it here is cheap
                // insurance.
                let _ = window.set_always_on_top(true);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Gloam");
}
