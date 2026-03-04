import { useCallback, useMemo, memo, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { Menu, MenuItem, PredefinedMenuItem } from "@tauri-apps/api/menu";
import { useNotes } from "../../context/NotesContext";
import { ListItem } from "../ui";
import { cleanTitle } from "../../lib/utils";
import * as notesService from "../../services/notes";
import type { Settings } from "../../types/note";
import type { TFunction } from "i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/AlertDialog";

function formatDate(timestamp: number, t: TFunction): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();

  // Get start of today, yesterday, etc. (midnight local time)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);

  // Today: show time
  if (date >= startOfToday) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  // Yesterday
  if (date >= startOfYesterday) {
    return t("dateFormats.yesterday");
  }

  // Calculate days ago
  const daysAgo = Math.floor((startOfToday.getTime() - date.getTime()) / 86400000) + 1;

  // 2-6 days ago: show "X days ago"
  if (daysAgo <= 6) {
    return t("dateFormats.daysAgo", { count: daysAgo });
  }

  // This year: show month and day
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  // Different year: show full date
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Memoized note item component
interface NoteItemProps {
  id: string;
  title: string;
  preview?: string;
  modified: number;
  isSelected: boolean;
  isPinned: boolean;
  tags?: string[];
  onSelect: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  t: TFunction;
}

const NoteItem = memo(function NoteItem({
  id,
  title,
  preview,
  modified,
  isSelected,
  isPinned,
  tags,
  onSelect,
  onContextMenu,
  t,
}: NoteItemProps) {
  const handleClick = useCallback(() => onSelect(id), [onSelect, id]);
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => onContextMenu(e, id),
    [onContextMenu, id],
  );

  const folder = id.includes("/") ? id.substring(0, id.lastIndexOf("/")) : null;
  const displayPreview = folder
    ? preview
      ? `${folder}/ · ${preview}`
      : `${folder}/`
    : preview;

  return (
    <ListItem
      title={cleanTitle(title)}
      subtitle={displayPreview}
      meta={formatDate(modified, t)}
      isSelected={isSelected}
      isPinned={isPinned}
      tags={tags}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    />
  );
});

interface NoteListProps {
  onNoteClick?: () => void;
}

export function NoteList({ onNoteClick }: NoteListProps = {}) {
  const { t } = useTranslation();
  const {
    notes,
    selectedNoteId,
    selectNote,
    deleteNote,
    duplicateNote,
    pinNote,
    unpinNote,
    isLoading,
    searchQuery,
    searchResults,
    selectedTag,
  } = useNotes();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Wrapper for selectNote that also triggers mobile navigation
  const handleSelectNote = useCallback(
    (id: string) => {
      onNoteClick?.();
      selectNote(id);
    },
    [selectNote, onNoteClick],
  );

  // Load settings when notes change
  useEffect(() => {
    notesService
      .getSettings()
      .then(setSettings)
      .catch((error) => {
        console.error("Failed to load settings:", error);
      });
  }, [notes]);

  // Calculate pinned IDs set for efficient lookup
  const pinnedIds = useMemo(() => new Set(settings?.pinnedNoteIds || []), [settings]);

  const handleDeleteConfirm = useCallback(async () => {
    if (noteToDelete) {
      try {
        await deleteNote(noteToDelete);
        setNoteToDelete(null);
        setDeleteDialogOpen(false);
      } catch (error) {
        console.error("Failed to delete note:", error);
      }
    }
  }, [noteToDelete, deleteNote]);

  const handleContextMenu = useCallback(
    async (e: React.MouseEvent, noteId: string) => {
      e.preventDefault();
      const isPinned = pinnedIds.has(noteId);

      const menu = await Menu.new({
        items: [
          await MenuItem.new({
            text: isPinned ? t("contextMenu.unpin") : t("contextMenu.pin"),
            action: async () => {
              try {
                await (isPinned ? unpinNote(noteId) : pinNote(noteId));
                // Refresh settings after pin/unpin
                const newSettings = await notesService.getSettings();
                setSettings(newSettings);
              } catch (error) {
                console.error("Failed to pin/unpin note:", error);
              }
            },
          }),
          await MenuItem.new({
            text: t("contextMenu.duplicate"),
            action: () => duplicateNote(noteId),
          }),
          await MenuItem.new({
            text: t("contextMenu.copyFilepath"),
            action: async () => {
              try {
                const folder = await notesService.getNotesFolder();
                if (folder) {
                  const filepath = `${folder}/${noteId}.md`;
                  await invoke("copy_to_clipboard", { text: filepath });
                  toast.success(t("toasts.filepathCopied"));
                }
              } catch (error) {
                console.error("Failed to copy filepath:", error);
              }
            },
          }),
          await PredefinedMenuItem.new({ item: "Separator" }),
          await MenuItem.new({
            text: t("contextMenu.delete"),
            action: () => {
              setNoteToDelete(noteId);
              setDeleteDialogOpen(true);
            },
          }),
        ],
      });

      await menu.popup();
    },
    [pinnedIds, pinNote, unpinNote, duplicateNote, t],
  );

  // Memoize display items to prevent recalculation on every render
  const displayItems = useMemo(() => {
    if (searchQuery.trim()) {
      // If searching, show search results
      return searchResults.map((r) => ({
        id: r.id,
        title: r.title,
        preview: r.preview,
        modified: r.modified,
        tags: r.tags,
      }));
    }
    // Filter by selected tag if active
    if (selectedTag) {
      return notes.filter((note) => note.tags?.includes(selectedTag));
    }
    return notes;
  }, [searchQuery, searchResults, notes, selectedTag]);

  // Listen for focus request from editor (when Escape is pressed)
  useEffect(() => {
    const handleFocusNoteList = () => {
      containerRef.current?.focus();
    };

    window.addEventListener("focus-note-list", handleFocusNoteList);
    return () => window.removeEventListener("focus-note-list", handleFocusNoteList);
  }, []);

  if (isLoading && notes.length === 0) {
    return (
      <div className="p-4 text-center text-text-muted select-none">{t("common.loading")}</div>
    );
  }

  if (searchQuery.trim() && displayItems.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-text-muted select-none">
        {t("emptyState.noResults")}
      </div>
    );
  }

  if (displayItems.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-text-muted select-none">
        {t("emptyState.noNotes")}
      </div>
    );
  }

  return (
    <>
      <div ref={containerRef} tabIndex={0} className="flex flex-col gap-1 p-1.5 outline-none">
        {displayItems.map((item) => (
          <NoteItem
            key={item.id}
            id={item.id}
            title={item.title}
            preview={item.preview}
            modified={item.modified}
            isSelected={selectedNoteId === item.id}
            isPinned={pinnedIds.has(item.id)}
            tags={item.tags}
            onSelect={handleSelectNote}
            onContextMenu={handleContextMenu}
            t={t}
          />
        ))}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dialogs.deleteNote")}</AlertDialogTitle>
            <AlertDialogDescription>{t("dialogs.deleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
