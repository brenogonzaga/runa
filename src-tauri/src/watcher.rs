use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::state::{AppState, FileWatcherState};
use crate::types::FileChangeEvent;
use crate::utils::{cleanup_debounce_map, extract_title, id_from_abs_path};

pub(crate) fn setup_file_watcher(
    app: AppHandle,
    notes_folder: &str,
    debounce_map: Arc<Mutex<HashMap<PathBuf, Instant>>>,
) -> Result<FileWatcherState, String> {
    let folder_path = PathBuf::from(notes_folder);
    let notes_root = folder_path.clone();
    let app_handle = app.clone();

    let watcher = RecommendedWatcher::new(
        move |res: anyhow::Result<notify::Event, notify::Error>| {
            if let Ok(event) = res {
                for path in event.paths.iter() {
                    let note_id = match id_from_abs_path(&notes_root, path) {
                        Some(id) => id,
                        None => continue,
                    };

                    // Debounce with cleanup
                    {
                        let mut map = debounce_map.lock().expect("debounce map mutex");
                        let now = Instant::now();

                        if map.len() > 100 {
                            map.retain(|_, last| {
                                now.duration_since(*last) < Duration::from_secs(5)
                            });
                        }

                        if let Some(last) = map.get(path) {
                            if now.duration_since(*last) < Duration::from_millis(500) {
                                continue;
                            }
                        }
                        map.insert(path.clone(), now);
                    }

                    let kind = match event.kind {
                        notify::EventKind::Create(_) => "created",
                        notify::EventKind::Modify(_) => "modified",
                        notify::EventKind::Remove(_) => "deleted",
                        notify::EventKind::Any => "modified",
                        _ => continue,
                    };

                    // Update search index for external file changes
                    if let Some(state) = app_handle.try_state::<AppState>() {
                        let index = state.search_index.lock().expect("search index mutex");
                        if let Some(ref search_index) = *index {
                            match kind {
                                "created" | "modified" => match std::fs::read_to_string(path) {
                                    Ok(content) => {
                                        let title = extract_title(&content);
                                        let modified = std::fs::metadata(path)
                                            .ok()
                                            .and_then(|m| m.modified().ok())
                                            .and_then(|t| {
                                                t.duration_since(std::time::UNIX_EPOCH).ok()
                                            })
                                            .map(|d| d.as_secs() as i64)
                                            .unwrap_or(0);
                                        let _ = search_index
                                            .index_note(&note_id, &title, &content, modified);
                                    }
                                    Err(_) => {
                                        if !path.exists() {
                                            let _ = search_index.delete_note(&note_id);
                                        }
                                    }
                                },
                                "deleted" => {
                                    let _ = search_index.delete_note(&note_id);
                                }
                                _ => {}
                            }
                        }
                    }

                    let effective_kind = if kind == "modified" && !path.exists() {
                        "deleted"
                    } else {
                        kind
                    };

                    let _ = app_handle.emit(
                        "file-change",
                        FileChangeEvent {
                            kind: effective_kind.to_string(),
                            path: path.to_string_lossy().into_owned(),
                            changed_ids: vec![note_id.clone()],
                        },
                    );
                }
            }
        },
        Config::default(),
    )
    .map_err(|e| e.to_string())?;

    let mut watcher = watcher;
    watcher
        .watch(&folder_path, RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    Ok(FileWatcherState { watcher })
}

#[tauri::command]
pub(crate) fn start_file_watcher(app: AppHandle, state: State<AppState>) -> Result<(), String> {
    let folder = {
        let app_config = state.app_config.read().expect("app_config read lock");
        app_config
            .notes_folder
            .clone()
            .ok_or("Notes folder not set")?
    };

    cleanup_debounce_map(&state.debounce_map);

    let watcher_state = setup_file_watcher(app, &folder, Arc::clone(&state.debounce_map))?;

    let mut file_watcher = state.file_watcher.lock().expect("file watcher mutex");
    *file_watcher = Some(watcher_state);

    Ok(())
}
