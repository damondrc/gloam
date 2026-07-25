// Keeps a console window from opening alongside the widget on Windows release
// builds. Debug builds keep it so panics and logs stay visible.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    gloam_lib::run()
}
