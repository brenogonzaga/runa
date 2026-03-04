import { invoke } from "@tauri-apps/api/core";
import type { Note, NoteMetadata, Settings } from "../types/note";

export async function getNotesFolder(): Promise<string | null> {
  return invoke("get_notes_folder");
}

export async function setNotesFolder(path: string): Promise<void> {
  return invoke("set_notes_folder", { path });
}

export async function getDefaultNotesFolder(): Promise<string | null> {
  return invoke("get_default_notes_folder");
}

export async function isMobilePlatform(): Promise<boolean> {
  return invoke("is_mobile_platform");
}

export async function listNotes(): Promise<NoteMetadata[]> {
  return invoke("list_notes");
}

export async function readNote(id: string): Promise<Note> {
  return invoke("read_note", { id });
}

export async function saveNote(id: string | null, content: string): Promise<Note> {
  return invoke("save_note", { id, content });
}

export async function deleteNote(id: string): Promise<void> {
  return invoke("delete_note", { id });
}

export async function listTrash(): Promise<NoteMetadata[]> {
  return invoke("list_trash");
}

export async function restoreNote(id: string): Promise<void> {
  return invoke("restore_note", { id });
}

export async function emptyTrash(): Promise<void> {
  return invoke("empty_trash");
}

export async function permanentlyDeleteNote(id: string): Promise<void> {
  return invoke("permanently_delete_note", { id });
}

export async function getBacklinks(noteId: string): Promise<NoteMetadata[]> {
  return invoke("get_backlinks", { noteId });
}

export async function createNote(): Promise<Note> {
  return invoke("create_note");
}

export async function duplicateNote(id: string): Promise<Note> {
  // Read the original note, then create a new one with the same content
  const original = await readNote(id);
  const newNote = await createNote();
  // Save with the original content (title will be extracted from content)
  const duplicatedContent = original.content.replace(
    /^# (.+)$/m,
    (_, title) => `# ${title} (Copy)`,
  );
  return saveNote(newNote.id, duplicatedContent || original.content);
}

export async function getSettings(): Promise<Settings> {
  return invoke("get_settings");
}

export async function updateSettings(settings: Settings): Promise<void> {
  return invoke("update_settings", { newSettings: settings });
}

export interface SearchResult {
  id: string;
  title: string;
  preview: string;
  modified: number;
  score: number;
  tags?: string[];
}

export async function searchNotes(query: string): Promise<SearchResult[]> {
  return invoke("search_notes", { query });
}

export async function startFileWatcher(): Promise<void> {
  // File watcher is only available on desktop
  try {
    const isMobile = await isMobilePlatform();
    if (isMobile) {
      return; // No file watcher on mobile
    }
    return invoke("start_file_watcher");
  } catch {
    // Command may not exist on mobile builds
    console.debug("File watcher not available on this platform");
  }
}

// Template management
export async function listTemplates(): Promise<import("../types/note").TemplateMetadata[]> {
  return invoke("list_templates");
}

export async function createNoteFromTemplate(
  templateName: string,
  noteTitle?: string,
): Promise<NoteMetadata> {
  return invoke("create_note_from_template", { templateName, noteTitle });
}

export async function saveTemplate(name: string, content: string): Promise<void> {
  return invoke("save_template", { name, content });
}

export async function deleteTemplate(name: string): Promise<void> {
  return invoke("delete_template", { name });
}
