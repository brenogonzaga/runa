use std::path::{Path, PathBuf};

use once_cell::sync::Lazy;
use regex::Regex;

#[cfg(desktop)]
use std::collections::HashMap;
#[cfg(desktop)]
use std::sync::Mutex;
#[cfg(desktop)]
use std::time::Instant;

/// Regex for matching markdown images: ![alt](url)
static IMG_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"!\[([^\]]*)\]\([^)]+\)").expect("IMG_RE: Invalid regex pattern"));

/// Regex for matching markdown links: [text](url)
static LINK_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"\[([^\]]+)\]\([^)]+\)").expect("LINK_RE: Invalid regex pattern"));

/// Regex for matching list markers at start of line
static LIST_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^(\s*[-+*]|\s*\d+\.)\s+").expect("LIST_RE: Invalid regex pattern"));

/// Directories to exclude from note discovery and ID resolution.
pub(crate) const EXCLUDED_DIRS: &[&str] = &[".git", ".runa", ".obsidian", ".trash", "assets"];

/// Filter for WalkDir: skips excluded directories.
pub(crate) fn is_visible_notes_entry(entry: &walkdir::DirEntry) -> bool {
    if entry.file_type().is_dir() {
        let name = entry.file_name().to_str().unwrap_or("");
        return !EXCLUDED_DIRS.contains(&name);
    }
    true
}

/// Convert an absolute file path to a note ID (relative path from notes root,
/// no .md extension, POSIX separators).
/// Returns None if the path is outside the root, not a .md file, or in an excluded directory.
pub(crate) fn id_from_abs_path(notes_root: &Path, file_path: &Path) -> Option<String> {
    let rel = file_path.strip_prefix(notes_root).ok()?;

    // Skip files inside excluded directories (.git, .runa, assets, etc.)
    for component in rel.parent().unwrap_or(Path::new("")).components() {
        if let std::path::Component::Normal(name) = component {
            let name_str = name.to_str()?;
            if EXCLUDED_DIRS.contains(&name_str) {
                return None;
            }
        }
    }

    // Must be a .md file
    if file_path.extension()?.to_str()? != "md" {
        return None;
    }

    let rel_str = rel.to_str()?;
    let id = rel_str
        .strip_suffix(".md")?
        .replace(std::path::MAIN_SEPARATOR, "/");

    if id.is_empty() {
        None
    } else {
        Some(id)
    }
}

/// Convert a note ID to an absolute file path. Validates against path traversal.
pub(crate) fn abs_path_from_id(notes_root: &Path, id: &str) -> Result<PathBuf, String> {
    if id.contains('\\') {
        return Err("Invalid note ID: backslashes not allowed".to_string());
    }

    let rel = Path::new(id);

    for component in rel.components() {
        match component {
            std::path::Component::ParentDir => {
                return Err("Invalid note ID: parent directory references not allowed".to_string());
            }
            std::path::Component::CurDir => {
                return Err("Invalid note ID: current directory references not allowed".to_string());
            }
            std::path::Component::RootDir | std::path::Component::Prefix(_) => {
                return Err("Invalid note ID: absolute paths not allowed".to_string());
            }
            _ => {}
        }
    }

    // Append ".md" via OsString to avoid with_extension replacing dots in stems
    let joined = notes_root.join(rel);
    let mut file_path_os = joined.into_os_string();
    file_path_os.push(".md");
    let file_path = PathBuf::from(file_path_os);

    if !file_path.starts_with(notes_root) {
        return Err("Invalid note ID: path escapes notes folder".to_string());
    }

    Ok(file_path)
}

/// Validate a file path for preview mode direct file operations.
/// Ensures the path is a markdown file and resolves symlinks.
pub(crate) fn validate_preview_path(path: &str) -> Result<PathBuf, String> {
    let file_path = PathBuf::from(path);

    match file_path.extension().and_then(|e| e.to_str()) {
        Some(ext) if ext.eq_ignore_ascii_case("md") || ext.eq_ignore_ascii_case("markdown") => {}
        _ => return Err("Only .md and .markdown files are allowed".to_string()),
    }

    let canonical = file_path
        .canonicalize()
        .map_err(|e| format!("Cannot resolve file path: {}", e))?;

    Ok(canonical)
}

/// Check if a file extension is a supported markdown extension (desktop only - used for file handling).
#[cfg(desktop)]
pub(crate) fn is_markdown_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|s| {
            let lower = s.to_ascii_lowercase();
            lower == "md" || lower == "markdown"
        })
        .unwrap_or(false)
}

// Utility: Sanitize filename from title
pub(crate) fn sanitize_filename(title: &str) -> String {
    let sanitized: String = title
        .chars()
        .filter(|c| *c != '\u{00A0}' && *c != '\u{FEFF}' && *c != '\0')
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '-',
            _ => c,
        })
        .collect();

    let trimmed = sanitized.trim();
    if trimmed.is_empty() || is_effectively_empty(trimmed) {
        "Untitled".to_string()
    } else {
        trimmed.to_string()
    }
}

/// Expands template tags in a note name template using local timezone.
pub(crate) fn expand_note_name_template(template: &str) -> String {
    use chrono::Local;

    let mut result = template.to_string();
    let now = Local::now();

    result = result.replace("{timestamp}", &now.timestamp().to_string());
    result = result.replace("{date}", &now.format("%Y-%m-%d").to_string());
    result = result.replace("{year}", &now.format("%Y").to_string());
    result = result.replace("{month}", &now.format("%m").to_string());
    result = result.replace("{day}", &now.format("%d").to_string());
    result = result.replace("{time}", &now.format("%H-%M-%S").to_string());

    result
}

/// Extracts a display title from a note ID (filename).
pub(crate) fn extract_title_from_id(id: &str) -> String {
    let filename = id.rsplit('/').next().unwrap_or(id);
    let title = filename.replace(['-', '_'], " ");

    title
        .split_whitespace()
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => first.to_uppercase().to_string() + chars.as_str(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

// Utility: Check if a string is effectively empty
pub(crate) fn is_effectively_empty(s: &str) -> bool {
    s.chars()
        .all(|c| c.is_whitespace() || c == '\u{00A0}' || c == '\u{FEFF}')
}

/// Strip YAML frontmatter (leading `---` ... `---` block) from content.
pub(crate) fn strip_frontmatter(content: &str) -> &str {
    let trimmed = content.trim_start();
    if trimmed.starts_with("---") {
        if let Some(rest) = trimmed.strip_prefix("---") {
            if let Some(end) = rest.find("\n---") {
                let after_close = &rest[end + 4..];
                return after_close
                    .strip_prefix("\r\n")
                    .or_else(|| after_close.strip_prefix('\n'))
                    .unwrap_or(after_close);
            }
        }
    }
    content
}

// Utility: Extract title from markdown content
pub(crate) fn extract_title(content: &str) -> String {
    let body = strip_frontmatter(content);
    for line in body.lines() {
        let trimmed = line.trim();
        if let Some(title) = trimmed.strip_prefix("# ") {
            let title = title.trim();
            if !is_effectively_empty(title) {
                return title.to_string();
            }
        }
        if !is_effectively_empty(trimmed) {
            return trimmed.chars().take(50).collect();
        }
    }
    "Untitled".to_string()
}

// Utility: Generate preview from content (strip markdown formatting)
pub(crate) fn generate_preview(content: &str) -> String {
    let body = strip_frontmatter(content);
    for line in body.lines().skip(1) {
        let trimmed = line.trim();
        if !trimmed.is_empty() {
            let stripped = strip_markdown(trimmed);
            if !stripped.is_empty() {
                return stripped.chars().take(100).collect();
            }
        }
    }
    String::new()
}

// Strip common markdown formatting from text
pub(crate) fn strip_markdown(text: &str) -> String {
    let mut result = text.to_string();

    // Remove heading markers
    let trimmed = result.trim_start();
    if trimmed.starts_with('#') {
        result = trimmed.trim_start_matches('#').trim_start().to_string();
    }

    // Remove strikethrough (~~text~~)
    while let Some(start) = result.find("~~") {
        if let Some(end) = result[start + 2..].find("~~") {
            let inner = result[start + 2..start + 2 + end].to_string();
            result = format!(
                "{}{}{}",
                &result[..start],
                inner,
                &result[start + 4 + end..]
            );
        } else {
            break;
        }
    }

    // Remove bold (**text** or __text__)
    while let Some(start) = result.find("**") {
        if let Some(end) = result[start + 2..].find("**") {
            let inner = result[start + 2..start + 2 + end].to_string();
            result = format!(
                "{}{}{}",
                &result[..start],
                inner,
                &result[start + 4 + end..]
            );
        } else {
            break;
        }
    }
    while let Some(start) = result.find("__") {
        if let Some(end) = result[start + 2..].find("__") {
            let inner = result[start + 2..start + 2 + end].to_string();
            result = format!(
                "{}{}{}",
                &result[..start],
                inner,
                &result[start + 4 + end..]
            );
        } else {
            break;
        }
    }

    // Remove inline code
    while let Some(start) = result.find('`') {
        if let Some(end) = result[start + 1..].find('`') {
            let inner = result[start + 1..start + 1 + end].to_string();
            result = format!(
                "{}{}{}",
                &result[..start],
                inner,
                &result[start + 2 + end..]
            );
        } else {
            break;
        }
    }

    result = IMG_RE.replace_all(&result, "$1").to_string();

    result = LINK_RE.replace_all(&result, "$1").to_string();

    // Remove italic (*text*)
    while let Some(start) = result.find('*') {
        if let Some(end) = result[start + 1..].find('*') {
            if end > 0 {
                let inner = result[start + 1..start + 1 + end].to_string();
                result = format!(
                    "{}{}{}",
                    &result[..start],
                    inner,
                    &result[start + 2 + end..]
                );
            } else {
                break;
            }
        } else {
            break;
        }
    }
    // Remove italic (_text_)
    while let Some(start) = result.find('_') {
        if let Some(end) = result[start + 1..].find('_') {
            if end > 0 {
                let inner = result[start + 1..start + 1 + end].to_string();
                result = format!(
                    "{}{}{}",
                    &result[..start],
                    inner,
                    &result[start + 2 + end..]
                );
            } else {
                break;
            }
        } else {
            break;
        }
    }

    // Remove task list markers
    result = result
        .replace("- [ ] ", "")
        .replace("- [x] ", "")
        .replace("- [X] ", "");

    result = LIST_RE.replace(&result, "").to_string();

    result.trim().to_string()
}

/// Safe mutex lock with logging. Returns Result instead of panicking.
macro_rules! safe_lock {
    ($mutex:expr, $name:expr) => {
        $mutex.lock().map_err(|e| {
            eprintln!("Failed to acquire {} lock: {}", $name, e);
            format!("Lock acquisition failed: {}", $name)
        })
    };
}

pub(crate) use safe_lock;

// Clean up old entries from debounce map (entries older than 5 seconds) - desktop only
#[cfg(desktop)]
pub(crate) fn cleanup_debounce_map(map: &Mutex<HashMap<PathBuf, Instant>>) {
    // Use safe_lock! macro to avoid panic on poisoned mutex
    if let Ok(mut map) = safe_lock!(map, "debounce_map") {
        let now = Instant::now();
        map.retain(|_, last| now.duration_since(*last) < std::time::Duration::from_secs(5));
    }
}
