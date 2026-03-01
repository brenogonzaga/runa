use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager};

use crate::state::AppState;
use crate::utils::{id_from_abs_path, is_markdown_extension};

/// Check if a markdown file is inside the configured notes folder.
/// If so, emit a "select-note" event to the main window and optionally focus it.
pub(crate) fn try_select_in_notes_folder(app: &AppHandle, path: &Path) -> bool {
    let state = match app.try_state::<AppState>() {
        Some(s) => s,
        None => return false,
    };

    let notes_folder = state
        .app_config
        .read()
        .expect("app_config read lock")
        .notes_folder
        .clone();

    let folder = match notes_folder {
        Some(f) => f,
        None => return false,
    };

    let folder_path = PathBuf::from(&folder);
    let (canonical_file, canonical_folder) = match (path.canonicalize(), folder_path.canonicalize())
    {
        (Ok(f), Ok(d)) => (f, d),
        _ => return false,
    };

    if !canonical_file.starts_with(&canonical_folder) {
        return false;
    }

    let note_id = match id_from_abs_path(&canonical_folder, &canonical_file) {
        Some(id) => id,
        None => return false,
    };

    let _ = app.emit_to("main", "select-note", note_id);
    #[cfg(desktop)]
    if let Some(main_window) = app.get_webview_window("main") {
        let _ = main_window.set_focus();
    }
    true
}

// --- Desktop-only: preview windows and CLI argument handling ---

#[cfg(desktop)]
pub(crate) fn create_preview_window(app: &AppHandle, file_path: &str) -> Result<(), String> {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    use tauri::{webview::WebviewWindowBuilder, WebviewUrl};

    let mut hasher = DefaultHasher::new();
    file_path.hash(&mut hasher);
    let label = format!("preview-{:x}", hasher.finish());

    if let Some(window) = app.get_webview_window(&label) {
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let filename = PathBuf::from(file_path)
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "Preview".to_string());

    let encoded_path = urlencoding::encode(file_path);
    let url = format!("index.html?mode=preview&file={}", encoded_path);

    let builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::App(url.into()))
        .title(format!("{} — Runa", filename))
        .inner_size(800.0, 600.0)
        .min_inner_size(400.0, 300.0)
        .resizable(true)
        .decorations(true);

    #[cfg(target_os = "macos")]
    let builder = builder
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .hidden_title(true);

    let window = builder
        .build()
        .map_err(|e| format!("Failed to create preview window: {}", e))?;

    let win = window.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(500));
        let _ = win.set_focus();
    });

    Ok(())
}

#[cfg(desktop)]
pub(crate) fn handle_cli_args(app: &AppHandle, args: &[String], cwd: &str) {
    let mut opened_file = false;

    for arg in args.iter().skip(1) {
        if arg.starts_with('-') {
            continue;
        }

        let path = if PathBuf::from(arg).is_absolute() {
            PathBuf::from(arg)
        } else {
            PathBuf::from(cwd).join(arg)
        };

        if is_markdown_extension(&path) && path.is_file() {
            opened_file = true;
            if !try_select_in_notes_folder(app, &path) {
                let _ = create_preview_window(app, &path.to_string_lossy());
            }
        }
    }

    if !opened_file {
        if let Some(main_window) = app.get_webview_window("main") {
            let _ = main_window.set_focus();
        }
    }
}

#[tauri::command]
pub(crate) fn open_file_preview(app: AppHandle, path: String) -> Result<(), String> {
    #[cfg(mobile)]
    {
        let _ = (app, path);
        return Err("Preview windows are not supported on mobile".to_string());
    }

    #[cfg(desktop)]
    {
        let file_path = PathBuf::from(&path);
        if !file_path.exists() {
            return Err(format!("File not found: {}", path));
        }

        if !try_select_in_notes_folder(&app, &file_path) {
            create_preview_window(&app, &path)?;
        }
        Ok(())
    }
}
