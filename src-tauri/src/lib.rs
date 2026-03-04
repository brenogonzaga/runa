#[cfg(desktop)]
mod ai;
mod clipboard;
mod commands;
mod config;
#[cfg(desktop)]
mod git;
#[cfg(desktop)]
mod git_commands;
mod notes;
#[cfg(desktop)]
mod preview;
#[cfg(desktop)]
mod rate_limit;
mod search;
mod state;
mod types;
mod utils;
#[cfg(desktop)]
mod watcher;

use config::{
    get_search_index_path, load_app_config, load_settings, normalize_notes_folder_path,
    save_app_config,
};
use search::SearchIndex;
use state::AppState;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Mutex, RwLock};
use tauri::Manager;
use types::Settings;

#[cfg(desktop)]
use std::sync::Arc;

#[cfg(target_os = "macos")]
use utils::is_markdown_extension;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default();

    // Single-instance: forward CLI args from subsequent launches to the running instance
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            preview::handle_cli_args(app, &args, &cwd);
        }));
    }

    // Updater only on desktop
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    let app = builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            let mut app_config = load_app_config(app.handle());

            // Normalize legacy/invalid saved paths (e.g. file:// URI from older builds)
            if let Some(saved_path) = app_config.notes_folder.clone() {
                match normalize_notes_folder_path(&saved_path) {
                    Ok(normalized) if normalized.is_dir() => {
                        let normalized_str = normalized.to_string_lossy().into_owned();
                        if normalized_str != saved_path {
                            app_config.notes_folder = Some(normalized_str);
                            let _ = save_app_config(app.handle(), &app_config);
                        }
                    }
                    Ok(normalized) => {
                        eprintln!(
                            "Notes folder not found (may be temporarily unavailable): {:?}",
                            normalized
                        );
                    }
                    Err(_) => {
                        app_config.notes_folder = None;
                        let _ = save_app_config(app.handle(), &app_config);
                    }
                }
            }

            let settings = if let Some(ref folder) = app_config.notes_folder {
                load_settings(folder)
            } else {
                Settings::default()
            };

            let search_index = if let Some(ref folder) = app_config.notes_folder {
                if let Ok(index_path) = get_search_index_path(app.handle()) {
                    SearchIndex::new(&index_path).ok().inspect(|idx| {
                        let _ = idx.rebuild_index(&PathBuf::from(folder));
                    })
                } else {
                    None
                }
            } else {
                None
            };

            let state = AppState {
                app_config: RwLock::new(app_config),
                settings: RwLock::new(settings),
                notes_cache: RwLock::new(HashMap::new()),
                #[cfg(desktop)]
                file_watcher: Mutex::new(None),
                search_index: Mutex::new(search_index),
                #[cfg(desktop)]
                debounce_map: Arc::new(Mutex::new(HashMap::new())),
            };
            app.manage(state);

            // Add notes folder to asset protocol scope so images can be served
            if let Some(ref folder) = app
                .state::<AppState>()
                .app_config
                .read()
                .ok() // Use .ok() instead of .expect() to avoid panic
                .and_then(|config| config.notes_folder.clone())
            {
                let _ = app.asset_protocol_scope().allow_directory(folder, true);

                // Security: Explicitly deny access to sensitive directories
                #[cfg(desktop)]
                {
                    let sensitive_dirs = [
                        ".ssh",
                        ".aws",
                        ".gnupg",
                        ".docker",
                        "Library/Keychains",
                        "AppData/Roaming",
                    ];
                    if let Ok(home) = std::env::var("HOME") {
                        for dir in sensitive_dirs {
                            let sensitive_path = PathBuf::from(&home).join(dir);
                            if sensitive_path.exists() {
                                let _ = app
                                    .asset_protocol_scope()
                                    .forbid_directory(sensitive_path, true);
                            }
                        }
                    }
                }
            }

            // Handle CLI args on first launch (desktop only)
            #[cfg(desktop)]
            {
                let args: Vec<String> = std::env::args().collect();
                if args.len() > 1 {
                    let cwd = std::env::current_dir()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .into_owned();
                    preview::handle_cli_args(app.handle(), &args, &cwd);
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            notes::get_notes_folder,
            notes::set_notes_folder,
            notes::list_notes,
            notes::read_note,
            notes::save_note,
            notes::delete_note,
            notes::create_note,
            notes::get_settings,
            notes::update_settings,
            notes::preview_note_name,
            notes::write_file,
            notes::read_file_direct,
            notes::save_file_direct,
            notes::import_file_to_folder,
            notes::get_default_notes_folder,
            search::search_notes,
            search::rebuild_search_index,
            clipboard::copy_to_clipboard,
            clipboard::copy_image_to_assets,
            clipboard::save_clipboard_image,
            commands::open_folder_dialog,
            commands::open_in_file_manager,
            commands::open_url_safe,
            commands::is_mobile_platform,
            // Desktop-only commands (git, ai, file watcher, preview)
            #[cfg(desktop)]
            watcher::start_file_watcher,
            #[cfg(desktop)]
            git_commands::git_is_available,
            #[cfg(desktop)]
            git_commands::git_get_status,
            #[cfg(desktop)]
            git_commands::git_init_repo,
            #[cfg(desktop)]
            git_commands::git_commit,
            #[cfg(desktop)]
            git_commands::git_push,
            #[cfg(desktop)]
            git_commands::git_fetch,
            #[cfg(desktop)]
            git_commands::git_pull,
            #[cfg(desktop)]
            git_commands::git_add_remote,
            #[cfg(desktop)]
            git_commands::git_push_with_upstream,
            #[cfg(desktop)]
            ai::ai_check_claude_cli,
            #[cfg(desktop)]
            ai::ai_check_codex_cli,
            #[cfg(desktop)]
            ai::ai_execute_claude,
            #[cfg(desktop)]
            ai::ai_execute_codex,
            #[cfg(desktop)]
            preview::open_file_preview,
        ])
        .build(tauri::generate_context!())
        .expect("Fatal: Failed to build Tauri application");

    // Use .run() callback to handle macOS "Open With" file events
    app.run(|_app_handle, _event| {
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Opened { urls } = _event {
            for url in urls {
                if let Ok(path) = url.to_file_path() {
                    if is_markdown_extension(&path)
                        && path.is_file()
                        && !preview::try_select_in_notes_folder(_app_handle, &path)
                    {
                        let _ =
                            preview::create_preview_window(_app_handle, &path.to_string_lossy());
                    }
                }
            }
        }
    });
}
