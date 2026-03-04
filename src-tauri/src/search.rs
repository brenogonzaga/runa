use anyhow::Result;
use std::path::PathBuf;
use std::sync::Mutex;
use tantivy::collector::TopDocs;
use tantivy::query::QueryParser;
use tantivy::schema::*;
use tantivy::{doc, Index, IndexReader, IndexWriter, ReloadPolicy};
use tauri::{AppHandle, State};

use crate::config::get_search_index_path;
use crate::state::AppState;
use crate::types::SearchResult;
use crate::utils::{
    abs_path_from_id, extract_title, generate_preview, id_from_abs_path, is_visible_notes_entry,
};

// Tantivy search index state
pub struct SearchIndex {
    index: Index,
    reader: IndexReader,
    writer: Mutex<IndexWriter>,
    #[allow(dead_code)]
    schema: Schema,
    id_field: Field,
    title_field: Field,
    content_field: Field,
    modified_field: Field,
}

impl SearchIndex {
    pub fn new(index_path: &PathBuf) -> Result<Self> {
        let mut schema_builder = Schema::builder();
        let id_field = schema_builder.add_text_field("id", STRING | STORED);
        let title_field = schema_builder.add_text_field("title", TEXT | STORED);
        let content_field = schema_builder.add_text_field("content", TEXT | STORED);
        let modified_field = schema_builder.add_i64_field("modified", INDEXED | STORED);
        let schema = schema_builder.build();

        std::fs::create_dir_all(index_path)?;
        let index = Index::create_in_dir(index_path, schema.clone())
            .or_else(|_| Index::open_in_dir(index_path))?;

        let reader = index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommitWithDelay)
            .try_into()?;

        let writer = index.writer(50_000_000)?;

        Ok(Self {
            index,
            reader,
            writer: Mutex::new(writer),
            schema,
            id_field,
            title_field,
            content_field,
            modified_field,
        })
    }

    pub fn index_note(&self, id: &str, title: &str, content: &str, modified: i64) -> Result<()> {
        let mut writer = self
            .writer
            .lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire search writer lock: {}", e))?;

        let id_term = tantivy::Term::from_field_text(self.id_field, id);
        writer.delete_term(id_term);

        writer.add_document(doc!(
            self.id_field => id,
            self.title_field => title,
            self.content_field => content,
            self.modified_field => modified,
        ))?;

        writer.commit()?;
        Ok(())
    }

    pub fn delete_note(&self, id: &str) -> Result<()> {
        let mut writer = self
            .writer
            .lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire search writer lock: {}", e))?;
        let id_term = tantivy::Term::from_field_text(self.id_field, id);
        writer.delete_term(id_term);
        writer.commit()?;
        Ok(())
    }

    pub fn search(&self, query_str: &str, limit: usize) -> Result<Vec<SearchResult>> {
        let searcher = self.reader.searcher();
        let query_parser =
            QueryParser::for_index(&self.index, vec![self.title_field, self.content_field]);

        let query = query_parser
            .parse_query(query_str)
            .or_else(|_| query_parser.parse_query(&format!("{}*", query_str)))?;

        let top_docs = searcher.search(&query, &TopDocs::with_limit(limit))?;

        let mut results = Vec::with_capacity(top_docs.len());
        for (score, doc_address) in top_docs {
            let doc: TantivyDocument = searcher.doc(doc_address)?;

            let id = doc
                .get_first(self.id_field)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let title = doc
                .get_first(self.title_field)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let content = doc
                .get_first(self.content_field)
                .and_then(|v| v.as_str())
                .unwrap_or("");

            let modified = doc
                .get_first(self.modified_field)
                .and_then(|v| v.as_i64())
                .unwrap_or(0);

            let preview = generate_preview(content);

            results.push(SearchResult {
                id,
                title,
                preview,
                modified,
                score,
            });
        }

        Ok(results)
    }

    pub fn rebuild_index(&self, notes_folder: &PathBuf) -> Result<()> {
        let mut writer = self
            .writer
            .lock()
            .map_err(|e| anyhow::anyhow!("Failed to acquire search writer lock: {}", e))?;
        writer.delete_all_documents()?;

        if notes_folder.exists() {
            use walkdir::WalkDir;
            for entry in WalkDir::new(notes_folder)
                .max_depth(10)
                .into_iter()
                .filter_entry(is_visible_notes_entry)
                .flatten()
            {
                let file_path = entry.path();
                if !file_path.is_file() {
                    continue;
                }
                if let Some(id) = id_from_abs_path(notes_folder, file_path) {
                    if let Ok(content) = std::fs::read_to_string(file_path) {
                        let modified = entry
                            .metadata()
                            .ok()
                            .and_then(|m| m.modified().ok())
                            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                            .map(|d| d.as_secs() as i64)
                            .unwrap_or(0);

                        let title = extract_title(&content);

                        writer.add_document(doc!(
                            self.id_field => id.as_str(),
                            self.title_field => title,
                            self.content_field => content.as_str(),
                            self.modified_field => modified,
                        ))?;
                    }
                }
            }
        }

        writer.commit()?;
        Ok(())
    }
}

// --- Tauri commands ---

#[tauri::command]
pub(crate) async fn search_notes(
    query: String,
    state: State<'_, AppState>,
) -> Result<Vec<SearchResult>, String> {
    let trimmed_query = query.trim().to_string();
    if trimmed_query.is_empty() {
        return Ok(vec![]);
    }

    let indexed_result = {
        let index = state
            .search_index
            .lock()
            .map_err(|e| format!("Failed to acquire search index lock: {}", e))?;
        (*index).as_ref().map(|search_index| {
            search_index
                .search(&trimmed_query, 20)
                .map_err(|e| e.to_string())
        })
    };

    match indexed_result {
        Some(Ok(results)) if !results.is_empty() => Ok(results),
        Some(Ok(_)) => fallback_search(&trimmed_query, &state).await,
        Some(Err(e)) => {
            eprintln!(
                "Tantivy search error, falling back to substring search: {}",
                e
            );
            fallback_search(&trimmed_query, &state).await
        }
        None => fallback_search(&trimmed_query, &state).await,
    }
}

// Fallback search when Tantivy index isn't available
async fn fallback_search(
    query: &str,
    state: &State<'_, AppState>,
) -> Result<Vec<SearchResult>, String> {
    let folder = {
        let app_config = state
            .app_config
            .read()
            .map_err(|e| format!("Failed to read app config: {}", e))?;
        app_config.notes_folder.clone()
    };

    let folder = match folder {
        Some(f) => f,
        None => return Ok(vec![]),
    };

    let cache_data: Vec<(String, String, String, i64)> = {
        let cache = state
            .notes_cache
            .read()
            .map_err(|e| format!("Failed to read notes cache: {}", e))?;
        cache
            .values()
            .map(|note| {
                (
                    note.id.clone(),
                    note.title.clone(),
                    note.preview.clone(),
                    note.modified,
                )
            })
            .collect()
    };

    let folder_path = PathBuf::from(&folder);
    let query_lower = query.to_lowercase();
    let mut results: Vec<SearchResult> = Vec::new();

    for (id, title, preview, modified) in cache_data {
        let title_lower = title.to_lowercase();
        let mut score = 0.0f32;

        if title_lower.contains(&query_lower) {
            score += 50.0;
        }

        let file_path = match abs_path_from_id(&folder_path, &id) {
            Ok(p) => p,
            Err(_) => continue,
        };
        if let Ok(content) = tokio::fs::read_to_string(&file_path).await {
            let content_lower = content.to_lowercase();
            if content_lower.contains(&query_lower) {
                if score == 0.0 {
                    score += 10.0;
                } else {
                    score += 5.0;
                }
            }
        }

        if score > 0.0 {
            results.push(SearchResult {
                id,
                title,
                preview,
                modified,
                score,
            });
        }
    }

    results.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    results.truncate(20);

    Ok(results)
}

#[tauri::command]
pub(crate) fn rebuild_search_index(app: AppHandle, state: State<AppState>) -> Result<(), String> {
    let folder = {
        let app_config = state
            .app_config
            .read()
            .map_err(|e| format!("Failed to read app config: {}", e))?;
        app_config
            .notes_folder
            .clone()
            .ok_or("Notes folder not set")?
    };

    let index_path = get_search_index_path(&app).map_err(|e| e.to_string())?;

    let search_index = SearchIndex::new(&index_path).map_err(|e| e.to_string())?;
    search_index
        .rebuild_index(&PathBuf::from(&folder))
        .map_err(|e| e.to_string())?;

    let mut index = state
        .search_index
        .lock()
        .map_err(|e| format!("Failed to acquire search index lock: {}", e))?;
    *index = Some(search_index);

    Ok(())
}
