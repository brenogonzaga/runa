use base64::Engine;
use std::path::PathBuf;
use tauri::{AppHandle, State};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tokio::fs;

use crate::state::AppState;
use crate::utils::sanitize_filename;

#[tauri::command]
pub(crate) fn copy_to_clipboard(app: AppHandle, text: String) -> Result<(), String> {
    app.clipboard().write_text(text).map_err(|e| e.to_string())
}

#[tauri::command]
pub(crate) async fn save_clipboard_image(
    base64_data: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    if base64_data.trim().is_empty() {
        return Err("Clipboard data is empty".to_string());
    }

    let folder = {
        let app_config = state.app_config.read().expect("app_config read lock");
        app_config
            .notes_folder
            .clone()
            .ok_or("Notes folder not set")?
    };

    let image_data = base64::engine::general_purpose::STANDARD
        .decode(&base64_data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;

    if image_data.is_empty() {
        return Err("Decoded image data is empty".to_string());
    }

    let assets_dir = PathBuf::from(&folder).join("assets");
    fs::create_dir_all(&assets_dir)
        .await
        .map_err(|e| e.to_string())?;

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let mut target_name = format!("screenshot-{}.png", timestamp);
    let mut counter = 1;
    let mut target_path = assets_dir.join(&target_name);

    while target_path.exists() {
        target_name = format!("screenshot-{}-{}.png", timestamp, counter);
        target_path = assets_dir.join(&target_name);
        counter += 1;
    }

    fs::write(&target_path, &image_data)
        .await
        .map_err(|e| format!("Failed to write image: {}", e))?;

    Ok(format!("assets/{}", target_name))
}

#[tauri::command]
pub(crate) async fn copy_image_to_assets(
    source_path: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let folder = {
        let app_config = state.app_config.read().expect("app_config read lock");
        app_config
            .notes_folder
            .clone()
            .ok_or("Notes folder not set")?
    };

    let source = PathBuf::from(&source_path);
    if !source.exists() {
        return Err("Source image file does not exist".to_string());
    }

    let extension = source
        .extension()
        .and_then(|e| e.to_str())
        .ok_or("Invalid file extension")?;

    let original_name = source
        .file_stem()
        .and_then(|n| n.to_str())
        .unwrap_or("image");

    let sanitized_name = sanitize_filename(original_name);

    let assets_dir = PathBuf::from(&folder).join("assets");
    fs::create_dir_all(&assets_dir)
        .await
        .map_err(|e| e.to_string())?;

    let mut target_name = format!("{}.{}", sanitized_name, extension);
    let mut counter = 1;
    let mut target_path = assets_dir.join(&target_name);

    while target_path.exists() {
        target_name = format!("{}-{}.{}", sanitized_name, counter, extension);
        target_path = assets_dir.join(&target_name);
        counter += 1;
    }

    fs::copy(&source, &target_path)
        .await
        .map_err(|e| format!("Failed to copy image: {}", e))?;

    Ok(format!("assets/{}", target_name))
}
