use std::collections::HashMap;
use std::sync::{Mutex, RwLock};

#[cfg(desktop)]
use std::path::PathBuf;
#[cfg(desktop)]
use std::sync::Arc;
#[cfg(desktop)]
use std::time::Instant;

use crate::search::SearchIndex;
use crate::types::{AppConfig, NoteMetadata, Settings};

// File watcher state (holds the watcher to keep it alive) - desktop only
#[cfg(desktop)]
pub struct FileWatcherState {
    #[allow(dead_code)]
    pub watcher: notify::RecommendedWatcher,
}

// Application state
pub struct AppState {
    pub app_config: RwLock<AppConfig>,
    pub settings: RwLock<Settings>,
    pub notes_cache: RwLock<HashMap<String, NoteMetadata>>,
    #[cfg(desktop)]
    pub file_watcher: Mutex<Option<FileWatcherState>>,
    pub search_index: Mutex<Option<SearchIndex>>,
    #[cfg(desktop)]
    pub debounce_map: Arc<Mutex<HashMap<PathBuf, Instant>>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            app_config: RwLock::new(AppConfig::default()),
            settings: RwLock::new(Settings::default()),
            notes_cache: RwLock::new(HashMap::new()),
            #[cfg(desktop)]
            file_watcher: Mutex::new(None),
            search_index: Mutex::new(None),
            #[cfg(desktop)]
            debounce_map: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}
