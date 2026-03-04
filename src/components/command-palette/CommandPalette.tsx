import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { useNotes } from "../../context/NotesContext";
import { useTheme } from "../../context/ThemeContext";
import { useGit } from "../../context/GitContext";
import * as notesService from "../../services/notes";
import { downloadPdf, downloadMarkdown } from "../../services/pdf";
import type { Settings } from "../../types/note";
import type { Editor } from "@tiptap/react";
import { CommandItem } from "../ui";
import { cleanTitle } from "../../lib/utils";
import { plainTextFromMarkdown } from "../../lib/plainText";
import { duplicateNote } from "../../services/notes";
import {
  CopyIcon,
  DownloadIcon,
  SettingsIcon,
  SwatchIcon,
  GitCommitIcon,
  RefreshCwIcon,
  AddNoteIcon,
  TrashIcon,
  PinIcon,
  ClaudeIcon,
  ZenIcon,
  MarkdownIcon,
  CodexIcon,
  FolderIcon,
} from "../icons";
import { mod, shift } from "../../lib/platform";
import type { AiProvider } from "../../services/ai";
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

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  icon?: ReactNode;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
  onOpenTrash?: () => void;
  onOpenAiModal?: (provider: AiProvider) => void;
  focusMode?: boolean;
  onToggleFocusMode?: () => void;
  editorRef?: React.RefObject<Editor | null>;
}

export function CommandPalette({
  open,
  onClose,
  onOpenSettings,
  onOpenTrash,
  onOpenAiModal,
  focusMode,
  onToggleFocusMode,
  editorRef,
}: CommandPaletteProps) {
  const {
    notes,
    selectNote,
    createNote,
    deleteNote,
    currentNote,
    refreshNotes,
    pinNote,
    unpinNote,
    notesFolder,
  } = useNotes();

  const handleNewNote = createNote;
  const { theme, setTheme } = useTheme();
  const { status, gitAvailable, commit, sync, isSyncing } = useGit();
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [localSearchResults, setLocalSearchResults] = useState<
    { id: string; title: string; preview: string; modified: number }[]
  >([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load settings when palette opens or current note changes
  useEffect(() => {
    if (open) {
      notesService.getSettings().then(setSettings);
    }
  }, [open, currentNote?.id]);

  // Memoize commands array
  const commands = useMemo<Command[]>(() => {
    const baseCommands: Command[] = [
      {
        id: "new-note",
        label: t("commands.newNote"),
        shortcut: `${mod} N`,
        icon: <AddNoteIcon className="w-4.5 h-4.5 stroke-[1.5]" />,
        action: () => {
          handleNewNote();
          onClose();
        },
      },
    ];

    // Add note-specific commands if a note is selected
    if (currentNote) {
      const isPinned = settings?.pinnedNoteIds?.includes(currentNote.id) || false;

      baseCommands.push(
        {
          id: isPinned ? "unpin-note" : "pin-note",
          label: isPinned ? t("commands.unpinCurrent") : t("commands.pinCurrent"),
          icon: <PinIcon className="w-5 h-5 stroke-[1.3]" />,
          action: async () => {
            try {
              if (isPinned) {
                await unpinNote(currentNote.id);
              } else {
                await pinNote(currentNote.id);
              }
              onClose();
            } catch (error) {
              console.error("Failed to pin/unpin note:", error);
              toast.error(isPinned ? t("toasts.unpinFailed") : t("toasts.pinFailed"));
            }
          },
        },
        {
          id: "ai-edit",
          label: t("commands.editWithClaude"),
          icon: <ClaudeIcon className="w-4.5 h-4.5 fill-text-muted" />,
          action: () => {
            onOpenAiModal?.("claude");
            onClose();
          },
        },
        {
          id: "ai-edit-codex",
          label: t("commands.editWithCodex"),
          icon: <CodexIcon className="w-4.5 h-4.5 fill-text-muted" />,
          action: () => {
            onOpenAiModal?.("codex");
            onClose();
          },
        },
        {
          id: "duplicate-note",
          label: t("commands.duplicateCurrent"),
          icon: <CopyIcon className="w-4.5 h-4.5 stroke-[1.5]" />,
          action: async () => {
            try {
              const newNote = await duplicateNote(currentNote.id);
              await refreshNotes();
              selectNote(newNote.id);
              onClose();
            } catch (error) {
              console.error("Failed to duplicate note:", error);
            }
          },
        },
        {
          id: "delete-note",
          label: t("commands.deleteCurrent"),
          icon: <TrashIcon className="w-4.5 h-4.5 stroke-[1.5]" />,
          action: () => {
            setNoteToDelete(currentNote.id);
            setDeleteDialogOpen(true);
          },
        },
        {
          id: "copy-markdown",
          label: t("commands.copyMarkdown"),
          icon: <CopyIcon className="w-4.5 h-4.5 stroke-[1.5]" />,
          action: async () => {
            try {
              await invoke("copy_to_clipboard", { text: currentNote.content });
              toast.success(t("toasts.copiedMarkdown"));
              onClose();
            } catch (error) {
              console.error("Failed to copy markdown:", error);
              toast.error(t("toasts.copyFailed"));
            }
          },
        },
        {
          id: "copy-plain",
          label: t("commands.copyPlainText"),
          icon: <CopyIcon className="w-4.5 h-4.5 stroke-[1.5]" />,
          action: async () => {
            try {
              const plainText = plainTextFromMarkdown(currentNote.content);
              await invoke("copy_to_clipboard", { text: plainText });
              toast.success(t("toasts.copiedPlainText"));
              onClose();
            } catch (error) {
              console.error("Failed to copy plain text:", error);
              toast.error(t("toasts.copyFailed"));
            }
          },
        },
        {
          id: "copy-html",
          label: t("commands.copyHtml"),
          icon: <CopyIcon className="w-4.5 h-4.5 stroke-[1.5]" />,
          action: async () => {
            try {
              if (!editorRef?.current) {
                toast.error(t("toasts.editorNotAvailable"));
                return;
              }
              const html = editorRef.current.getHTML();
              await invoke("copy_to_clipboard", { text: html });
              toast.success(t("toasts.copiedHtml"));
              onClose();
            } catch (error) {
              console.error("Failed to copy HTML:", error);
              toast.error(t("toasts.copyFailed"));
            }
          },
        },
        {
          id: "download-pdf",
          label: t("commands.printAsPdf"),
          icon: <DownloadIcon className="w-4.5 h-4.5 stroke-[1.5]" />,
          action: async () => {
            try {
              if (!editorRef?.current || !currentNote) {
                toast.error(t("toasts.editorNotAvailable"));
                return;
              }
              await downloadPdf(editorRef.current, currentNote.title);
              // Note: window.print() opens the print dialog but doesn't wait for user action
              // No success toast needed - the print dialog provides its own feedback
              onClose();
            } catch (error) {
              console.error("Failed to open print dialog:", error);
              toast.error(t("toasts.printFailed"));
            }
          },
        },
        {
          id: "download-markdown",
          label: t("commands.exportMarkdown"),
          icon: <DownloadIcon className="w-4.5 h-4.5 stroke-[1.5]" />,
          action: async () => {
            try {
              if (!currentNote) {
                toast.error(t("toasts.noNoteSelected"));
                return;
              }
              // Use live editor content with nbsp cleanup, fall back to saved content
              let markdown = currentNote.content;
              const editorInstance = editorRef?.current;
              if (editorInstance) {
                const manager = editorInstance.storage.markdown?.manager;
                if (manager) {
                  markdown = manager.serialize(editorInstance.getJSON());
                  markdown = markdown.replace(/&nbsp;|&#160;/g, " ");
                } else {
                  markdown = editorInstance.getText();
                }
              }
              const saved = await downloadMarkdown(markdown, currentNote.title);
              if (saved) {
                toast.success(t("toasts.markdownSaved"));
                onClose();
              }
            } catch (error) {
              console.error("Failed to download markdown:", error);
              toast.error(t("toasts.markdownSaveFailed"));
            }
          },
        },
      );
    }

    // Add git commands if git is available and initialized
    if (gitAvailable && status?.isRepo) {
      const hasChanges = (status?.changedCount ?? 0) > 0;
      const canSync = status?.hasRemote && status?.hasUpstream && !isSyncing;

      if (hasChanges) {
        baseCommands.push({
          id: "git-commit",
          label: t("commands.gitCommit"),
          icon: <GitCommitIcon className="w-4.5 h-4.5 stroke-[1.5]" />,
          action: async () => {
            const success = await commit("Quick commit from Runa");
            if (success) {
              toast.success(t("toasts.changesCommitted"));
            } else {
              toast.error(t("toasts.commitFailed"));
            }
            onClose();
          },
        });
      }

      if (canSync) {
        baseCommands.push({
          id: "git-sync",
          label: t("commands.gitSync"),
          icon: <RefreshCwIcon className="w-4.5 h-4.5 stroke-[1.5]" />,
          action: async () => {
            const result = await sync();
            if (result.ok) {
              toast.success(result.message);
            } else {
              toast.error(result.error);
            }
            onClose();
          },
        });
      }
    }

    // Focus mode and source toggle
    baseCommands.push(
      {
        id: "focus-mode",
        label: focusMode ? t("commands.exitFocus") : t("commands.enterFocus"),
        shortcut: `${mod} ${shift} Enter`,
        icon: <ZenIcon className="w-4.5 h-4.5 stroke-[1.5]" />,
        action: () => {
          onToggleFocusMode?.();
          onClose();
        },
      },
      {
        id: "toggle-source",
        label: t("commands.toggleMarkdown"),
        shortcut: `${mod} ${shift} M`,
        icon: <MarkdownIcon className="w-4.5 h-4.5 stroke-[1.5]" />,
        action: () => {
          window.dispatchEvent(new CustomEvent("toggle-source-mode"));
          onClose();
        },
      },
    );

    // Open notes folder
    if (notesFolder) {
      baseCommands.push({
        id: "open-folder",
        label: t("commands.openNotesFolder"),
        icon: <FolderIcon className="w-4.5 h-4.5 stroke-[1.5]" />,
        action: async () => {
          try {
            await invoke("open_in_file_manager", { path: notesFolder });
            onClose();
          } catch (error) {
            console.error("Failed to open folder:", error);
            toast.error(t("toasts.folderOpenFailed"));
          }
        },
      });
    }

    // Settings and theme commands at the bottom
    baseCommands.push({
      id: "settings",
      label: t("common.settings"),
      shortcut: `${mod} ,`,
      icon: <SettingsIcon className="w-4.5 h-4.5 stroke-[1.5]" />,
      action: () => {
        onOpenSettings?.();
        onClose();
      },
    });

    // Trash command
    if (onOpenTrash) {
      baseCommands.push({
        id: "open-trash",
        label: t("commands.openTrash"),
        icon: <TrashIcon className="w-4.5 h-4.5 stroke-[1.5]" />,
        action: () => {
          onOpenTrash();
          onClose();
        },
      });
    }

    baseCommands.push(
      {
        id: "theme-light",
        label: t("commands.switchToLight"),
        icon: <SwatchIcon className="w-4.5 h-4.5 stroke-[1.5]" />,
        action: () => {
          setTheme("light");
          onClose();
        },
      },
      {
        id: "theme-dark",
        label: t("commands.switchToDark"),
        icon: <SwatchIcon className="w-4.5 h-4.5 stroke-[1.5]" />,
        action: () => {
          setTheme("dark");
          onClose();
        },
      },
      {
        id: "theme-system",
        label: t("commands.switchToSystem"),
        icon: <SwatchIcon className="w-4.5 h-4.5 stroke-[1.5]" />,
        action: () => {
          setTheme("system");
          onClose();
        },
      },
    );

    return baseCommands;
  }, [
    createNote,
    currentNote,
    deleteNote,
    onClose,
    onOpenSettings,
    onOpenTrash,
    onOpenAiModal,
    setTheme,
    theme,
    gitAvailable,
    status,
    commit,
    sync,
    isSyncing,
    selectNote,
    refreshNotes,
    settings,
    pinNote,
    unpinNote,
    focusMode,
    onToggleFocusMode,
    notesFolder,
    t,
  ]);

  // Debounced search using Tantivy (local state, doesn't affect sidebar)
  useEffect(() => {
    if (!open) return;

    const trimmed = query.trim();
    if (!trimmed) {
      setLocalSearchResults([]);
      return;
    }

    // Debounce search calls
    const timer = setTimeout(async () => {
      try {
        const results = await invoke<
          {
            id: string;
            title: string;
            preview: string;
            modified: number;
            score: number;
          }[]
        >("search_notes", { query: trimmed });
        setLocalSearchResults(results);
      } catch (err) {
        console.error("Search failed:", err);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query, open]);

  // Clear local search when palette closes
  useEffect(() => {
    if (!open) {
      setLocalSearchResults([]);
    }
  }, [open]);

  // Use search results when searching, otherwise show all notes
  const filteredNotes = useMemo(() => {
    if (!query.trim()) return notes;
    return localSearchResults;
  }, [query, notes, localSearchResults]);

  // Memoize filtered commands
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const queryLower = query.toLowerCase();
    return commands.filter((cmd) => cmd.label.toLowerCase().includes(queryLower));
  }, [query, commands]);

  // Memoize all items (commands first, then notes)
  const allItems = useMemo(
    () => [
      ...filteredCommands.map((cmd) => ({
        type: "command" as const,
        id: cmd.id,
        label: cmd.label,
        shortcut: cmd.shortcut,
        icon: cmd.icon,
        action: cmd.action,
      })),
      ...filteredNotes.slice(0, 10).map((note) => ({
        type: "note" as const,
        id: note.id,
        label: cleanTitle(note.title),
        preview: note.preview,
        action: () => {
          selectNote(note.id);
          onClose();
        },
      })),
    ],
    [filteredNotes, filteredCommands, selectNote, onClose],
  );

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedItem = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedItem?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [selectedIndex]);

  const handleDeleteConfirm = useCallback(async () => {
    if (noteToDelete) {
      try {
        await deleteNote(noteToDelete);
        setNoteToDelete(null);
        setDeleteDialogOpen(false);
        onClose();
      } catch (error) {
        console.error("Failed to delete note:", error);
        toast.error(t("toasts.deleteFailed"));
      }
    }
  }, [noteToDelete, deleteNote, onClose]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          e.stopPropagation();
          if (allItems[selectedIndex]) {
            allItems[selectedIndex].action();
          }
          break;
        case "Escape":
          e.preventDefault();
          e.stopPropagation();
          onClose();
          break;
      }
    },
    [allItems, selectedIndex, onClose],
  );

  if (!open) return null;

  const commandsCount = filteredCommands.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start md:items-center justify-center pt-4 md:py-11 px-4 pointer-events-none"
      style={{ paddingTop: "max(1rem, env(safe-area-inset-top, 1rem))" }}
    >
      {/* Palette */}
      <div className="relative w-full h-full max-h-[80dvh] md:max-h-108 max-w-2xl bg-bg rounded-xl shadow-2xl overflow-hidden border border-border animate-slide-down flex flex-col pointer-events-auto">
        {/* Search input */}
        <div className="border-b border-border flex-none">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("placeholders.searchOrCommand")}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="w-full px-4.5 py-3.5 text-[17px] bg-transparent outline-none text-text placeholder-text-muted/50"
          />
        </div>

        {/* Results */}
        <div ref={listRef} className="overflow-y-auto h-full p-2.5 flex-1">
          {allItems.length === 0 ? (
            <div className="text-sm font-medium opacity-50 text-text-muted p-2">
              {t("emptyState.noResults")}
            </div>
          ) : (
            <>
              {/* Commands section */}
              {filteredCommands.length > 0 && (
                <div className="space-y-0.5 mb-5">
                  <div className="text-sm font-medium text-text-muted px-2.5 py-1.5">
                    {t("sections.commands")}
                  </div>
                  {filteredCommands.map((cmd, i) => {
                    return (
                      <div key={cmd.id} data-index={i}>
                        <CommandItem
                          label={cmd.label}
                          shortcut={cmd.shortcut}
                          icon={cmd.icon}
                          isSelected={selectedIndex === i}
                          onClick={cmd.action}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Notes section */}
              {filteredNotes.length > 0 && (
                <div className="space-y-0.5">
                  <div className="text-sm font-medium text-text-muted px-2.5 py-1.5">
                    {t("common.notes")}
                  </div>
                  {filteredNotes.slice(0, 10).map((note, i) => {
                    const title = cleanTitle(note.title);
                    const firstLetter = title.charAt(0).toUpperCase();
                    // Clean subtitle: treat whitespace-only or &nbsp; as empty
                    const cleanSubtitle = note.preview
                      ?.replace(/&nbsp;/g, " ")
                      .replace(/\u00A0/g, " ")
                      .trim();
                    const index = commandsCount + i;
                    return (
                      <div key={note.id} data-index={index}>
                        <CommandItem
                          label={title}
                          subtitle={cleanSubtitle}
                          iconText={firstLetter}
                          variant="note"
                          isSelected={selectedIndex === index}
                          onClick={allItems[index].action}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
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
    </div>
  );
}
