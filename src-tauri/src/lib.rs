mod clipboard;
mod logger;
mod auto_expand;

use clipboard::{read_clipboard, write_clipboard};
use auto_expand::{AutoExpander, SnippetMap};
use std::sync::{Arc, Mutex};
use tauri::State;

struct AppState {
    auto_expander: Arc<Mutex<Option<AutoExpander>>>,
    snippet_map: SnippetMap,
}

#[tauri::command]
fn enable_auto_expansion(state: State<AppState>) -> Result<(), String> {
    let expander = state.auto_expander.lock().unwrap();
    if let Some(ref exp) = *expander {
        exp.set_enabled(true);
        tracing::info!("Auto-expansion enabled");
        Ok(())
    } else {
        Err("Auto-expander not initialized".to_string())
    }
}

#[tauri::command]
fn disable_auto_expansion(state: State<AppState>) -> Result<(), String> {
    let expander = state.auto_expander.lock().unwrap();
    if let Some(ref exp) = *expander {
        exp.set_enabled(false);
        tracing::info!("Auto-expansion disabled");
        Ok(())
    } else {
        Err("Auto-expander not initialized".to_string())
    }
}

#[tauri::command]
fn update_snippets_map(
    keywords: Vec<String>,
    texts: Vec<String>,
    state: State<AppState>,
) -> Result<(), String> {
    if keywords.len() != texts.len() {
        return Err("Keywords and texts length mismatch".to_string());
    }

    let snippets: Vec<(String, String)> = keywords.into_iter().zip(texts).collect();
    state.snippet_map.update(snippets);
    tracing::info!("Snippet map updated from frontend");
    Ok(())
}

#[tauri::command]
fn is_auto_expansion_enabled(state: State<AppState>) -> Result<bool, String> {
    let expander = state.auto_expander.lock().unwrap();
    if let Some(ref exp) = *expander {
        Ok(exp.is_enabled())
    } else {
        Ok(false)
    }
}

#[tauri::command]
fn check_accessibility_permissions() -> bool {
    #[cfg(target_os = "macos")]
    {
        unsafe {
            accessibility_sys::AXIsProcessTrusted()
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        // On other platforms, assume permissions are OK
        true
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    logger::init();
    tracing::info!("Starting Snippet App");

    let snippet_map = SnippetMap::new();
    let auto_expander = AutoExpander::new(snippet_map.clone());

    // Start keyboard listener
    auto_expander.clone().start();

    let app_state = AppState {
        auto_expander: Arc::new(Mutex::new(Some(auto_expander))),
        snippet_map,
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            read_clipboard,
            write_clipboard,
            enable_auto_expansion,
            disable_auto_expansion,
            update_snippets_map,
            is_auto_expansion_enabled,
            check_accessibility_permissions
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
