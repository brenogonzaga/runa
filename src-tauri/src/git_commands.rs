use std::path::PathBuf;
use tauri::State;

use crate::git;
use crate::state::AppState;

#[tauri::command]
pub(crate) async fn git_is_available() -> bool {
    tauri::async_runtime::spawn_blocking(git::is_available)
        .await
        .unwrap_or(false)
}

#[tauri::command]
pub(crate) async fn git_get_status(
    state: State<'_, AppState>,
) -> Result<git::GitStatus, String> {
    let folder = {
        let app_config = state.app_config.read().expect("app_config read lock");
        app_config.notes_folder.clone()
    };

    match folder {
        Some(path) => {
            tauri::async_runtime::spawn_blocking(move || git::get_status(&PathBuf::from(path)))
                .await
                .map_err(|e| e.to_string())
        }
        None => Ok(git::GitStatus::default()),
    }
}

#[tauri::command]
pub(crate) async fn git_init_repo(state: State<'_, AppState>) -> Result<(), String> {
    let folder = {
        let app_config = state.app_config.read().expect("app_config read lock");
        app_config
            .notes_folder
            .clone()
            .ok_or("Notes folder not set")?
    };

    tauri::async_runtime::spawn_blocking(move || git::git_init(&PathBuf::from(folder)))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub(crate) async fn git_commit(
    message: String,
    state: State<'_, AppState>,
) -> Result<git::GitResult, String> {
    let folder = {
        let app_config = state.app_config.read().expect("app_config read lock");
        app_config.notes_folder.clone()
    };

    match folder {
        Some(path) => tauri::async_runtime::spawn_blocking(move || {
            git::commit_all(&PathBuf::from(path), &message)
        })
        .await
        .map_err(|e| e.to_string()),
        None => Ok(git::GitResult {
            success: false,
            message: None,
            error: Some("Notes folder not set".to_string()),
        }),
    }
}

#[tauri::command]
pub(crate) async fn git_push(state: State<'_, AppState>) -> Result<git::GitResult, String> {
    let folder = {
        let app_config = state.app_config.read().expect("app_config read lock");
        app_config.notes_folder.clone()
    };

    match folder {
        Some(path) => tauri::async_runtime::spawn_blocking(move || git::push(&PathBuf::from(path)))
            .await
            .map_err(|e| e.to_string()),
        None => Ok(git::GitResult {
            success: false,
            message: None,
            error: Some("Notes folder not set".to_string()),
        }),
    }
}

#[tauri::command]
pub(crate) async fn git_fetch(state: State<'_, AppState>) -> Result<git::GitResult, String> {
    let folder = {
        let app_config = state.app_config.read().expect("app_config read lock");
        app_config.notes_folder.clone()
    };

    match folder {
        Some(path) => {
            tauri::async_runtime::spawn_blocking(move || git::fetch(&PathBuf::from(path)))
                .await
                .map_err(|e| e.to_string())
        }
        None => Ok(git::GitResult {
            success: false,
            message: None,
            error: Some("Notes folder not set".to_string()),
        }),
    }
}

#[tauri::command]
pub(crate) async fn git_pull(state: State<'_, AppState>) -> Result<git::GitResult, String> {
    let folder = {
        let app_config = state.app_config.read().expect("app_config read lock");
        app_config.notes_folder.clone()
    };

    match folder {
        Some(path) => tauri::async_runtime::spawn_blocking(move || git::pull(&PathBuf::from(path)))
            .await
            .map_err(|e| e.to_string()),
        None => Ok(git::GitResult {
            success: false,
            message: None,
            error: Some("Notes folder not set".to_string()),
        }),
    }
}

#[tauri::command]
pub(crate) async fn git_add_remote(
    url: String,
    state: State<'_, AppState>,
) -> Result<git::GitResult, String> {
    let folder = {
        let app_config = state.app_config.read().expect("app_config read lock");
        app_config.notes_folder.clone()
    };

    match folder {
        Some(path) => tauri::async_runtime::spawn_blocking(move || {
            git::add_remote(&PathBuf::from(path), &url)
        })
        .await
        .map_err(|e| e.to_string()),
        None => Ok(git::GitResult {
            success: false,
            message: None,
            error: Some("Notes folder not set".to_string()),
        }),
    }
}

#[tauri::command]
pub(crate) async fn git_push_with_upstream(
    state: State<'_, AppState>,
) -> Result<git::GitResult, String> {
    let folder = {
        let app_config = state.app_config.read().expect("app_config read lock");
        app_config.notes_folder.clone()
    };

    match folder {
        Some(path) => {
            tauri::async_runtime::spawn_blocking(move || {
                let status = git::get_status(&PathBuf::from(&path));
                match status.current_branch {
                    Some(branch) => git::push_with_upstream(&PathBuf::from(&path), &branch),
                    None => git::GitResult {
                        success: false,
                        message: None,
                        error: Some("No current branch found".to_string()),
                    },
                }
            })
            .await
            .map_err(|e| e.to_string())
        }
        None => Ok(git::GitResult {
            success: false,
            message: None,
            error: Some("Notes folder not set".to_string()),
        }),
    }
}
