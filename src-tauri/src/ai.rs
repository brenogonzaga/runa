use std::{
    path::PathBuf,
    process::Command,
    sync::{Arc, Mutex},
};

use tauri::State;

use crate::{state::AppState, types::AiExecutionResult};

/// Create a `Command` that hides the console window on Windows.
fn no_window_cmd(program: &str) -> Command {
    #[allow(unused_mut)]
    let mut cmd = Command::new(program);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

pub(crate) fn get_expanded_path() -> String {
    let system_path = std::env::var("PATH").unwrap_or_default();
    let home = std::env::var("HOME").unwrap_or_else(|_| String::new());

    if home.is_empty() {
        return system_path;
    }

    // Common locations for node-installed CLIs (nvm, volta, fnm, mise, homebrew, global npm)
    let candidate_dirs = vec![
        format!("{home}/.nvm/versions/node"),
        format!("{home}/.fnm/node-versions"),
        format!("{home}/.local/share/mise/installs/node"),
    ];
    let static_dirs = vec![
        format!("{home}/.volta/bin"),
        format!("{home}/.local/bin"),
        "/usr/local/bin".to_string(),
        "/opt/homebrew/bin".to_string(),
    ];

    let mut expanded = Vec::new();

    for dir in static_dirs {
        expanded.push(dir);
    }

    for base in &candidate_dirs {
        if let Ok(entries) = std::fs::read_dir(base) {
            for entry in entries.flatten() {
                let bin_path = entry.path().join("bin");
                if bin_path.exists() {
                    expanded.push(bin_path.to_string_lossy().to_string());
                }
            }
        }
    }

    expanded.push(system_path);
    expanded.join(":")
}

pub(crate) fn check_cli_exists(command_name: &str, path: &str) -> Result<bool, String> {
    let which_cmd = if cfg!(target_os = "windows") {
        "where"
    } else {
        "which"
    };

    let check_output = no_window_cmd(which_cmd)
        .arg(command_name)
        .env("PATH", path)
        .output()
        .map_err(|e| format!("Failed to check for {} CLI: {}", command_name, e))?;

    Ok(check_output.status.success())
}

#[tauri::command]
pub(crate) async fn ai_check_claude_cli() -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let path = get_expanded_path();
        check_cli_exists("claude", &path)
    })
    .await
    .map_err(|e| format!("Failed to check Claude CLI: {}", e))?
}

#[tauri::command]
pub(crate) async fn ai_check_codex_cli() -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let path = get_expanded_path();
        check_cli_exists("codex", &path)
    })
    .await
    .map_err(|e| format!("Failed to check Codex CLI: {}", e))?
}

/// Shared AI CLI execution: spawns `command` with `args`, writes `stdin_input` to stdin,
/// and returns the result with a 5-minute timeout.
async fn execute_ai_cli(
    cli_name: &str,
    command: String,
    args: Vec<String>,
    stdin_input: String,
    not_found_msg: String,
) -> Result<AiExecutionResult, String> {
    use std::io::Write;
    use std::process::{Child, Stdio};

    let cli_name = cli_name.to_string();
    let timeout_duration = std::time::Duration::from_secs(300);
    let shared_child: Arc<Mutex<Option<Child>>> = Arc::new(Mutex::new(None));
    let child_for_task = Arc::clone(&shared_child);
    let cli_name_task = cli_name.clone();

    let mut task = tauri::async_runtime::spawn_blocking(move || {
        let path = get_expanded_path();
        match check_cli_exists(&command, &path) {
            Ok(false) => {
                return AiExecutionResult {
                    success: false,
                    output: String::new(),
                    error: Some(not_found_msg),
                };
            }
            Err(e) => {
                return AiExecutionResult {
                    success: false,
                    output: String::new(),
                    error: Some(e),
                };
            }
            Ok(true) => {}
        }

        let mut cmd = no_window_cmd(&command);
        cmd.env("PATH", &path);
        for arg in &args {
            cmd.arg(arg);
        }
        let process = match cmd
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
        {
            Ok(p) => p,
            Err(e) => {
                return AiExecutionResult {
                    success: false,
                    output: String::new(),
                    error: Some(format!("Failed to execute {}: {}", cli_name_task, e)),
                };
            }
        };

        if let Ok(mut guard) = child_for_task.lock() {
            *guard = Some(process);
        } else {
            return AiExecutionResult {
                success: false,
                output: String::new(),
                error: Some(format!("Failed to lock {} process handle", cli_name_task)),
            };
        }

        let stdin_handle = child_for_task
            .lock()
            .ok()
            .and_then(|mut g| g.as_mut().and_then(|p| p.stdin.take()));

        if let Some(mut stdin) = stdin_handle {
            if let Err(e) = stdin.write_all(stdin_input.as_bytes()) {
                if let Ok(mut g) = child_for_task.lock() {
                    if let Some(ref mut p) = *g {
                        let _ = p.kill();
                        let _ = p.wait();
                    }
                }
                return AiExecutionResult {
                    success: false,
                    output: String::new(),
                    error: Some(format!("Failed to write to {} stdin: {}", cli_name_task, e)),
                };
            }
        } else {
            if let Ok(mut g) = child_for_task.lock() {
                if let Some(ref mut p) = *g {
                    let _ = p.kill();
                    let _ = p.wait();
                }
            }
            return AiExecutionResult {
                success: false,
                output: String::new(),
                error: Some(format!("Failed to open stdin for {}", cli_name_task)),
            };
        }

        let stdout_handle = child_for_task
            .lock()
            .ok()
            .and_then(|mut g| g.as_mut().and_then(|p| p.stdout.take()));
        let stderr_handle = child_for_task
            .lock()
            .ok()
            .and_then(|mut g| g.as_mut().and_then(|p| p.stderr.take()));

        use std::io::Read;

        let mut stdout_str = String::new();
        if let Some(mut out) = stdout_handle {
            let _ = out.read_to_string(&mut stdout_str);
        }

        let mut stderr_str = String::new();
        if let Some(mut err) = stderr_handle {
            let _ = err.read_to_string(&mut stderr_str);
        }

        let success = child_for_task
            .lock()
            .ok()
            .and_then(|mut g| g.as_mut().and_then(|p| p.wait().ok()))
            .map(|s| s.success())
            .unwrap_or(false);

        if success {
            AiExecutionResult {
                success: true,
                output: stdout_str,
                error: None,
            }
        } else {
            AiExecutionResult {
                success: false,
                output: stdout_str,
                error: Some(stderr_str),
            }
        }
    });

    let result = match tokio::time::timeout(timeout_duration, &mut task).await {
        Ok(join_result) => {
            join_result.map_err(|e| format!("Failed to join {} blocking task: {}", cli_name, e))?
        }
        Err(_) => {
            if let Ok(mut guard) = shared_child.lock() {
                if let Some(ref mut process) = *guard {
                    let _ = process.kill();
                }
            }

            match tokio::time::timeout(std::time::Duration::from_secs(5), task).await {
                Ok(join_result) => {
                    if let Err(e) = join_result {
                        return Err(format!(
                            "Failed to join {} blocking task after timeout: {}",
                            cli_name, e
                        ));
                    }
                }
                Err(_) => {
                    return Err(format!(
                        "{} CLI timed out and failed to exit after kill signal",
                        cli_name
                    ));
                }
            }

            AiExecutionResult {
                success: false,
                output: String::new(),
                error: Some(format!("{} CLI timed out after 5 minutes", cli_name)),
            }
        }
    };

    Ok(result)
}

#[tauri::command]
pub(crate) async fn ai_execute_claude(
    file_path: String,
    prompt: String,
    state: tauri::State<'_, AppState>,
) -> Result<AiExecutionResult, String> {
    let path = PathBuf::from(&file_path);
    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase());

    match extension.as_deref() {
        Some("md") | Some("markdown") => {}
        _ => return Err("AI editing is only allowed on markdown files".to_string()),
    }

    let folder = {
        let app_config = state.app_config.read().expect("app_config read lock");
        app_config
            .notes_folder
            .clone()
            .ok_or("Notes folder not set")?
    };

    let notes_folder = PathBuf::from(&folder)
        .canonicalize()
        .map_err(|_| "Failed to resolve notes folder path".to_string())?;

    let canonical_file = path
        .canonicalize()
        .map_err(|_| "Failed to resolve file path".to_string())?;

    if !canonical_file.starts_with(&notes_folder) {
        return Err("AI editing is only allowed on files within the notes folder".to_string());
    }

    execute_ai_cli(
        "Claude",
        "claude".to_string(),
        vec![
            canonical_file.to_string_lossy().to_string(),
            "--dangerously-skip-permissions".to_string(),
            "--print".to_string(),
        ],
        prompt,
        "Claude CLI not found. Please install it from https://claude.ai/code".to_string(),
    )
    .await
}

#[tauri::command]
pub(crate) async fn ai_execute_codex(
    file_path: String,
    prompt: String,
    state: State<'_, AppState>,
) -> Result<AiExecutionResult, String> {
    // Validate file extension
    let path = PathBuf::from(&file_path);
    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase());

    match extension.as_deref() {
        Some("md") | Some("markdown") => {}
        _ => return Err("AI editing is only allowed on markdown files".to_string()),
    }

    // Validate path is within notes folder
    let folder = {
        let app_config = state.app_config.read().expect("app_config read lock");
        app_config
            .notes_folder
            .clone()
            .ok_or("Notes folder not set")?
    };

    let notes_folder = PathBuf::from(&folder)
        .canonicalize()
        .map_err(|_| "Failed to resolve notes folder path".to_string())?;

    let canonical_file = path
        .canonicalize()
        .map_err(|_| "Failed to resolve file path".to_string())?;

    if !canonical_file.starts_with(&notes_folder) {
        return Err("AI editing is only allowed on files within the notes folder".to_string());
    }

    let canonical_path_str = canonical_file.to_string_lossy().to_string();
    let stdin_input = format!(
        "Edit only this markdown file: {canonical_path_str}\n\
         Apply the user's instructions below directly to that file.\n\
         Do not create, delete, rename, or modify any other files.\n\
         User instructions:\n\
         {prompt}"
    );

    execute_ai_cli(
        "Codex",
        "codex".to_string(),
        vec![
            "exec".to_string(),
            "--skip-git-repo-check".to_string(),
            "--dangerously-bypass-approvals-and-sandbox".to_string(),
            "-".to_string(),
        ],
        stdin_input,
        "Codex CLI not found. Please install it from https://github.com/openai/codex".to_string(),
    )
    .await
}
