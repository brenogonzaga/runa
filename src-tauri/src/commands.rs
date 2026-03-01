use std::path::PathBuf;
use tauri::AppHandle;

/// Check if running on mobile platform
#[tauri::command]
pub(crate) fn is_mobile_platform() -> bool {
    cfg!(mobile)
}

#[tauri::command]
pub(crate) async fn open_folder_dialog(
    app: AppHandle,
    default_path: Option<String>,
) -> Result<Option<String>, String> {
    #[cfg(mobile)]
    {
        let _ = (app, default_path);
        return Err("Folder dialogs are not supported on mobile".to_string());
    }

    #[cfg(desktop)]
    {
        use tauri_plugin_dialog::DialogExt;

        let result = tauri::async_runtime::spawn_blocking(move || {
            let mut builder = app.dialog().file().set_can_create_directories(true);

            if let Some(path) = default_path {
                builder = builder.set_directory(path);
            }

            builder.blocking_pick_folder()
        })
        .await
        .map_err(|e| format!("Dialog task failed: {}", e))?;

        Ok(result.map(|p| p.to_string()))
    }
}

#[tauri::command]
pub(crate) async fn open_in_file_manager(path: String) -> Result<(), String> {
    let path_buf = PathBuf::from(&path);
    if !path_buf.exists() || !path_buf.is_dir() {
        return Err("Path does not exist or is not a directory".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "windows")]
    {
        let windows_path = path.replace("/", "\\");
        std::process::Command::new("explorer")
            .arg(&windows_path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    return Err("Unsupported platform".to_string());

    #[allow(unreachable_code)]
    Ok(())
}

#[tauri::command]
pub(crate) async fn open_url_safe(
    #[allow(unused_variables)] app: tauri::AppHandle,
    url: String,
) -> Result<(), String> {
    let parsed = url::Url::parse(&url).map_err(|e| format!("Invalid URL: {}", e))?;

    match parsed.scheme() {
        "http" | "https" | "mailto" => {}
        scheme => {
            return Err(format!(
                "URL scheme '{}' is not allowed. Only http, https, and mailto are permitted.",
                scheme
            ))
        }
    }

    #[cfg(desktop)]
    {
        open::that(&url).map_err(|e| format!("Failed to open URL: {}", e))
    }

    #[cfg(mobile)]
    {
        use tauri_plugin_opener::OpenerExt;
        app.opener()
            .open_url(&url, None::<&str>)
            .map_err(|e| format!("Failed to open URL: {}", e))
    }
}
