use std::collections::HashSet;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::fs;
use tokio::io::AsyncWriteExt;

use crate::config::{
    get_search_index_path, load_settings, normalize_notes_folder_path, save_app_config,
    save_settings,
};
use crate::search::SearchIndex;
use crate::state::AppState;
use crate::types::{FileContent, Note, NoteMetadata, Settings};
use crate::utils::{
    abs_path_from_id, expand_note_name_template, extract_title, extract_title_from_id,
    generate_preview, id_from_abs_path, is_visible_notes_entry, sanitize_filename,
    validate_preview_path,
};

/// Get the default notes folder path (app documents directory on mobile, None on desktop)
#[tauri::command]
pub(crate) fn get_default_notes_folder(app: AppHandle) -> Result<Option<String>, String> {
    #[cfg(mobile)]
    {
        // On mobile, use app's document directory as default
        let doc_dir = app
            .path()
            .document_dir()
            .or_else(|_| app.path().app_data_dir())
            .map_err(|e| format!("Failed to get document directory: {}", e))?;

        let notes_folder = doc_dir.join("Notes");
        std::fs::create_dir_all(&notes_folder)
            .map_err(|e| format!("Failed to create notes folder: {}", e))?;

        Ok(Some(notes_folder.to_string_lossy().into_owned()))
    }

    #[cfg(desktop)]
    {
        let _ = app;
        Ok(None) // Desktop allows user to choose folder
    }
}

#[tauri::command]
pub(crate) fn get_notes_folder(state: State<AppState>) -> Option<String> {
    state
        .app_config
        .read()
        .expect("app_config read lock")
        .notes_folder
        .clone()
}

#[tauri::command]
pub(crate) fn set_notes_folder(
    app: AppHandle,
    path: String,
    state: State<AppState>,
) -> Result<(), String> {
    let path_buf = normalize_notes_folder_path(&path)?;
    let normalized_path = path_buf.to_string_lossy().into_owned();

    if !path_buf.exists() {
        std::fs::create_dir_all(&path_buf).map_err(|e| e.to_string())?;
    }

    // Create assets folder
    let assets = path_buf.join("assets");
    std::fs::create_dir_all(&assets).map_err(|e| e.to_string())?;

    // Create .runa config folder
    let runa_dir = path_buf.join(".runa");
    std::fs::create_dir_all(&runa_dir).map_err(|e| e.to_string())?;

    // Verify write access
    let write_test_path = runa_dir.join(".write-test");
    std::fs::write(&write_test_path, b"ok")
        .map_err(|e| format!("Notes folder is not writable: {}", e))?;
    let _ = std::fs::remove_file(&write_test_path);

    let settings = load_settings(&normalized_path);

    {
        let mut app_config = state.app_config.write().expect("app_config write lock");
        app_config.notes_folder = Some(normalized_path.clone());
    }
    {
        let mut current_settings = state.settings.write().expect("settings write lock");
        *current_settings = settings;
    }
    {
        let app_config = state.app_config.read().expect("app_config read lock");
        save_app_config(&app, &app_config).map_err(|e| e.to_string())?;
    }

    let _ = app.asset_protocol_scope().allow_directory(&path_buf, true);

    // Initialize search index
    if let Ok(index_path) = get_search_index_path(&app) {
        if let Ok(search_index) = SearchIndex::new(&index_path) {
            let _ = search_index.rebuild_index(&path_buf);
            let mut index = state.search_index.lock().expect("search index mutex");
            *index = Some(search_index);
        }
    }

    Ok(())
}

#[tauri::command]
pub(crate) async fn list_notes(state: State<'_, AppState>) -> Result<Vec<NoteMetadata>, String> {
    let folder = {
        let app_config = state.app_config.read().expect("app_config read lock");
        app_config
            .notes_folder
            .clone()
            .ok_or("Notes folder not set")?
    };

    let path = PathBuf::from(&folder);
    if !path.exists() {
        return Ok(vec![]);
    }

    let path_clone = path.clone();
    let discovered = tokio::task::spawn_blocking(move || {
        use walkdir::WalkDir;
        let mut results: Vec<(String, String, String, i64)> = Vec::new();
        for entry in WalkDir::new(&path_clone)
            .max_depth(10)
            .into_iter()
            .filter_entry(is_visible_notes_entry)
            .flatten()
        {
            let file_path = entry.path();
            if !file_path.is_file() {
                continue;
            }
            if let Some(id) = id_from_abs_path(&path_clone, file_path) {
                if let Ok(content) = std::fs::read_to_string(file_path) {
                    let modified = entry
                        .metadata()
                        .ok()
                        .and_then(|m| m.modified().ok())
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs() as i64)
                        .unwrap_or(0);
                    let title = extract_title(&content);
                    let preview = generate_preview(&content);
                    results.push((id, title, preview, modified));
                }
            }
        }
        results
    })
    .await
    .map_err(|e| e.to_string())?;

    let mut notes: Vec<NoteMetadata> = discovered
        .into_iter()
        .map(|(id, title, preview, modified)| NoteMetadata {
            id,
            title,
            preview,
            modified,
        })
        .collect();

    let pinned_ids: HashSet<String> = {
        let settings = state.settings.read().expect("settings read lock");
        settings
            .pinned_note_ids
            .as_ref()
            .map(|ids| ids.iter().cloned().collect())
            .unwrap_or_default()
    };

    notes.sort_by(|a, b| {
        let a_pinned = pinned_ids.contains(&a.id);
        let b_pinned = pinned_ids.contains(&b.id);

        match (a_pinned, b_pinned) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => b.modified.cmp(&a.modified),
        }
    });

    {
        let mut cache = state.notes_cache.write().expect("cache write lock");
        cache.clear();
        for note in &notes {
            cache.insert(note.id.clone(), note.clone());
        }
    }

    Ok(notes)
}

#[tauri::command]
pub(crate) async fn read_note(id: String, state: State<'_, AppState>) -> Result<Note, String> {
    let folder = {
        let app_config = state.app_config.read().expect("app_config read lock");
        app_config
            .notes_folder
            .clone()
            .ok_or("Notes folder not set")?
    };

    let folder_path = PathBuf::from(&folder);
    let file_path = abs_path_from_id(&folder_path, &id)?;
    if !file_path.exists() {
        return Err("Note not found".to_string());
    }

    let content = fs::read_to_string(&file_path)
        .await
        .map_err(|e| e.to_string())?;
    let metadata = fs::metadata(&file_path).await.map_err(|e| e.to_string())?;

    let modified = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);

    Ok(Note {
        id,
        title: extract_title(&content),
        content,
        path: file_path.to_string_lossy().into_owned(),
        modified,
    })
}

#[tauri::command]
pub(crate) async fn save_note(
    id: Option<String>,
    content: String,
    state: State<'_, AppState>,
) -> Result<Note, String> {
    let folder = {
        let app_config = state.app_config.read().expect("app_config read lock");
        app_config
            .notes_folder
            .clone()
            .ok_or("Notes folder not set")?
    };
    let folder_path = PathBuf::from(&folder);

    let title = extract_title(&content);
    let sanitized_leaf = sanitize_filename(&title);

    let (final_id, file_path, old_id) = if let Some(existing_id) = id {
        let (dir_prefix, desired_id) = if let Some(pos) = existing_id.rfind('/') {
            let prefix = &existing_id[..pos];
            (
                Some(prefix.to_string()),
                format!("{}/{}", prefix, sanitized_leaf),
            )
        } else {
            (None, sanitized_leaf.clone())
        };

        let old_file_path = abs_path_from_id(&folder_path, &existing_id)?;

        if existing_id != desired_id {
            let mut new_id = desired_id.clone();
            let mut counter = 1;

            while new_id != existing_id
                && abs_path_from_id(&folder_path, &new_id)
                    .map(|p| p.exists())
                    .unwrap_or(false)
            {
                new_id = if let Some(ref prefix) = dir_prefix {
                    format!("{}/{}-{}", prefix, sanitized_leaf, counter)
                } else {
                    format!("{}-{}", sanitized_leaf, counter)
                };
                counter += 1;
            }

            let new_file_path = abs_path_from_id(&folder_path, &new_id)?;
            (new_id, new_file_path, Some((existing_id, old_file_path)))
        } else {
            (existing_id, old_file_path, None)
        }
    } else {
        let mut new_id = sanitized_leaf.clone();
        let mut counter = 1;

        while abs_path_from_id(&folder_path, &new_id)
            .map(|p| p.exists())
            .unwrap_or(false)
        {
            new_id = format!("{}-{}", sanitized_leaf, counter);
            counter += 1;
        }

        let new_file_path = abs_path_from_id(&folder_path, &new_id)?;
        (new_id, new_file_path, None)
    };

    fs::write(&file_path, &content)
        .await
        .map_err(|e| e.to_string())?;

    if let Some((_, ref old_file_path)) = old_id {
        if old_file_path.exists() && *old_file_path != file_path {
            let _ = fs::remove_file(old_file_path).await;
        }
    }

    let metadata = fs::metadata(&file_path).await.map_err(|e| e.to_string())?;
    let modified = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);

    {
        let index = state.search_index.lock().expect("search index mutex");
        if let Some(ref search_index) = *index {
            if let Some((ref old_id_str, _)) = old_id {
                let _ = search_index.delete_note(old_id_str);
            }
            let _ = search_index.index_note(&final_id, &title, &content, modified);
        }
    }

    if let Some((ref old_id_str, _)) = old_id {
        let mut cache = state.notes_cache.write().expect("cache write lock");
        cache.remove(old_id_str);
    }

    Ok(Note {
        id: final_id,
        title,
        content,
        path: file_path.to_string_lossy().into_owned(),
        modified,
    })
}

#[tauri::command]
pub(crate) async fn delete_note(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let folder = {
        let app_config = state.app_config.read().expect("app_config read lock");
        app_config
            .notes_folder
            .clone()
            .ok_or("Notes folder not set")?
    };

    let folder_path = PathBuf::from(&folder);
    let file_path = abs_path_from_id(&folder_path, &id)?;
    if file_path.exists() {
        fs::remove_file(&file_path)
            .await
            .map_err(|e| e.to_string())?;
    }

    {
        let index = state.search_index.lock().expect("search index mutex");
        if let Some(ref search_index) = *index {
            let _ = search_index.delete_note(&id);
        }
    }
    {
        let mut cache = state.notes_cache.write().expect("cache write lock");
        cache.remove(&id);
    }

    Ok(())
}

#[tauri::command]
pub(crate) async fn create_note(state: State<'_, AppState>) -> Result<Note, String> {
    let folder = {
        let app_config = state.app_config.read().expect("app_config read lock");
        app_config
            .notes_folder
            .clone()
            .ok_or("Notes folder not set")?
    };
    let folder_path = PathBuf::from(&folder);

    let template = {
        let settings = state.settings.read().expect("settings read lock");
        settings
            .default_note_name
            .clone()
            .unwrap_or_else(|| "Untitled".to_string())
    };

    let expanded = expand_note_name_template(&template);
    let sanitized = sanitize_filename(&expanded);

    let has_counter = template.contains("{counter}");
    let base_id = if has_counter {
        sanitized.replace("{counter}", "1")
    } else {
        sanitized.clone()
    };

    let mut final_id = base_id.clone();
    let mut counter = if has_counter { 2 } else { 1 };

    while abs_path_from_id(&folder_path, &final_id)
        .map(|p| p.exists())
        .unwrap_or(false)
    {
        if has_counter {
            final_id = sanitized.replace("{counter}", &counter.to_string());
        } else {
            final_id = format!("{}-{}", base_id, counter);
        }
        counter += 1;
    }

    let display_title = extract_title_from_id(&final_id);
    let content = format!("# {}\n\n", display_title);
    let file_path = abs_path_from_id(&folder_path, &final_id)?;

    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)
            .await
            .map_err(|e| e.to_string())?;
    }

    fs::write(&file_path, &content)
        .await
        .map_err(|e| e.to_string())?;

    let modified = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);

    {
        let index = state.search_index.lock().expect("search index mutex");
        if let Some(ref search_index) = *index {
            let _ = search_index.index_note(&final_id, &display_title, &content, modified);
        }
    }

    Ok(Note {
        id: final_id,
        title: display_title,
        content,
        path: file_path.to_string_lossy().into_owned(),
        modified,
    })
}

#[tauri::command]
pub(crate) fn get_settings(state: State<AppState>) -> Settings {
    state.settings.read().expect("settings read lock").clone()
}

#[tauri::command]
pub(crate) fn update_settings(
    new_settings: Settings,
    state: State<AppState>,
) -> Result<(), String> {
    let folder = {
        let app_config = state.app_config.read().expect("app_config read lock");
        app_config
            .notes_folder
            .clone()
            .ok_or("Notes folder not set")?
    };

    {
        let mut settings = state.settings.write().expect("settings write lock");
        *settings = new_settings;
    }

    let settings = state.settings.read().expect("settings read lock");
    save_settings(&folder, &settings).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub(crate) async fn write_file(path: String, contents: Vec<u8>) -> Result<(), String> {
    fs::write(&path, contents)
        .await
        .map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
pub(crate) fn preview_note_name(template: String) -> Result<String, String> {
    let expanded = expand_note_name_template(&template);
    let sanitized = sanitize_filename(&expanded);

    let preview = if template.contains("{counter}") {
        sanitized.replace("{counter}", "1")
    } else {
        sanitized
    };

    Ok(preview)
}

#[tauri::command]
pub(crate) async fn read_file_direct(path: String) -> Result<FileContent, String> {
    let canonical = validate_preview_path(&path)?;

    if !canonical.is_file() {
        return Err(format!("Not a file: {}", path));
    }

    let content = fs::read_to_string(&canonical)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))?;
    let metadata = fs::metadata(&canonical)
        .await
        .map_err(|e| format!("Failed to read metadata: {}", e))?;

    let modified = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);

    let title = extract_title(&content);

    Ok(FileContent {
        path,
        content,
        title,
        modified,
    })
}

#[tauri::command]
pub(crate) async fn save_file_direct(path: String, content: String) -> Result<FileContent, String> {
    let canonical = validate_preview_path(&path)?;

    if !canonical.is_file() {
        return Err(format!("Not a file: {}", path));
    }

    fs::write(&canonical, &content)
        .await
        .map_err(|e| format!("Failed to write file: {}", e))?;

    let metadata = fs::metadata(&canonical)
        .await
        .map_err(|e| format!("Failed to read metadata: {}", e))?;
    let modified = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);

    let title = extract_title(&content);

    Ok(FileContent {
        path,
        content,
        title,
        modified,
    })
}

#[tauri::command]
pub(crate) async fn import_file_to_folder(
    app: AppHandle,
    path: String,
    state: State<'_, AppState>,
) -> Result<NoteMetadata, String> {
    let source = validate_preview_path(&path)?;
    if !source.is_file() {
        return Err(format!("Not a file: {}", path));
    }

    let folder = {
        let app_config = state.app_config.read().expect("app_config read lock");
        app_config
            .notes_folder
            .clone()
            .ok_or("Notes folder not set")?
    };
    let folder_path = PathBuf::from(&folder);

    let content = fs::read_to_string(&source)
        .await
        .map_err(|e| format!("Failed to read source file: {}", e))?;

    let extracted_title = extract_title(&content);
    let base_name = if extracted_title.trim().is_empty() {
        source
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Untitled")
            .to_string()
    } else {
        extracted_title.trim().to_string()
    };
    let base_id = sanitize_filename(&base_name);

    let mut final_id = base_id.clone();
    let mut counter = 1;
    loop {
        let candidate = abs_path_from_id(&folder_path, &final_id)?;
        match fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&candidate)
            .await
        {
            Ok(mut file) => {
                if let Err(e) = file.write_all(content.as_bytes()).await {
                    let _ = fs::remove_file(&candidate).await;
                    return Err(format!("Failed to write file: {}", e));
                }
                break;
            }
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
                final_id = format!("{}-{}", base_id, counter);
                counter += 1;
            }
            Err(e) => return Err(format!("Failed to create file: {}", e)),
        }
    }

    let modified = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);

    {
        let index = state.search_index.lock().expect("search index mutex");
        if let Some(ref search_index) = *index {
            let _ = search_index.index_note(&final_id, &extracted_title, &content, modified);
        }
    }

    let preview = content
        .lines()
        .skip(1)
        .filter(|l| !l.trim().is_empty())
        .take(3)
        .collect::<Vec<_>>()
        .join(" ");

    let metadata = NoteMetadata {
        id: final_id,
        title: extracted_title,
        preview,
        modified,
    };

    {
        let mut cache = state.notes_cache.write().expect("cache write lock");
        cache.insert(metadata.id.clone(), metadata.clone());
    }

    let _ = app.emit_to("main", "select-note", &metadata.id);
    #[cfg(desktop)]
    if let Some(main_window) = app.get_webview_window("main") {
        let _ = main_window.set_focus();
    }

    Ok(metadata)
}
