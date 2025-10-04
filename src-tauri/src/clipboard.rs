use arboard::Clipboard;

#[tauri::command]
pub fn read_clipboard() -> Result<String, String> {
    Clipboard::new()
        .and_then(|mut clipboard| clipboard.get_text())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_clipboard(text: String) -> Result<(), String> {
    Clipboard::new()
        .and_then(|mut clipboard| clipboard.set_text(text))
        .map_err(|e| e.to_string())
}
