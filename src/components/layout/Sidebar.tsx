import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { useNotes } from "../../context/NotesContext";
import { NoteList } from "../notes/NoteList";
import { Footer } from "./Footer";
import { IconButton } from "../ui";
import { PlusIcon, XIcon, SearchIcon, SearchOffIcon, RefreshCwIcon, TrashIcon } from "../icons";
import { mod, shift, isMac, isMacDesktop } from "../../lib/platform";
import { usePullToRefresh } from "../../lib/usePullToRefresh";
import { Input } from "../ui/Input";

interface SidebarProps {
  onOpenSettings?: () => void;
  onNoteClick?: () => void;
  onOpenTrash?: () => void;
}

export function Sidebar({ onOpenSettings, onNoteClick, onOpenTrash }: SidebarProps) {
  const { t } = useTranslation();
  const {
    createNote,
    notes,
    search,
    searchQuery,
    clearSearch,
    availableTags,
    selectedTag,
    setTagFilter,
  } = useNotes();

  const handleNewNote = createNote;

  const [searchOpen, setSearchOpen] = useState(false);
  const [inputValue, setInputValue] = useState(searchQuery);
  const debounceRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Pull-to-refresh for mobile
  const {
    pullDistance,
    isRefreshing,
    isPulling,
    willRefresh,
    handlers: pullHandlers,
  } = usePullToRefresh({
    onRefresh: async () => {
      // Refresh the current search or note list
      if (searchQuery) {
        await search(searchQuery);
      }
    },
    threshold: 60,
    maxPull: 100,
  });

  // Sync input with search query
  useEffect(() => {
    setInputValue(searchQuery);
  }, [searchQuery]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInputValue(value);

      // Debounce search
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = window.setTimeout(() => {
        search(value);
      }, 220);
    },
    [search],
  );

  const toggleSearch = useCallback(() => {
    setSearchOpen((prev) => !prev);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setInputValue("");
    clearSearch();
  }, [clearSearch]);

  // Auto-focus search input when opened
  useEffect(() => {
    if (searchOpen) {
      // Small delay to ensure the input is rendered
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }
  }, [searchOpen]);

  // Global shortcut hook: open and focus sidebar search
  useEffect(() => {
    const handleOpenSidebarSearch = () => {
      setSearchOpen(true);
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    };

    window.addEventListener("open-sidebar-search", handleOpenSidebarSearch);
    return () => window.removeEventListener("open-sidebar-search", handleOpenSidebarSearch);
  }, []);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (inputValue) {
          // First escape: clear search
          setInputValue("");
          clearSearch();
        } else {
          // Second escape: close search
          closeSearch();
        }
      }
    },
    [inputValue, clearSearch, closeSearch],
  );

  const handleClearSearch = useCallback(() => {
    setInputValue("");
    clearSearch();
  }, [clearSearch]);

  return (
    <div className="w-full h-full bg-bg-secondary md:border-r border-border flex flex-col select-none">
      {/* Drag region with header: macOS traffic-light space on desktop, safe-area inset on mobile */}
      <div
        className={cn(
          "flex items-center justify-between pt-safe md:pt-0 min-h-12 md:h-11 border-b border-border shrink-0",
          isMacDesktop ? "pl-22 pr-3" : "pl-4 pr-3",
        )}
        data-tauri-drag-region
      >
        <div className="titlebar-no-drag flex items-center gap-1">
          <div className="font-medium text-base hidden sm:block">{t("common.notes")}</div>
          <div className="text-text-muted font-medium text-2xs min-w-4.75 h-4.75 flex items-center justify-center px-1 bg-bg-muted rounded-sm mt-0.5 pt-px">
            {notes.length}
          </div>
        </div>
        <div className="titlebar-no-drag flex items-center gap-px">
          <IconButton
            onClick={toggleSearch}
            title={`${t("tooltips.searchNotes")} (${mod}${isMac ? "" : "+"}${shift}${isMac ? "" : "+"}F)`}
          >
            {searchOpen ? (
              <SearchOffIcon className="w-4.25 h-4.25 stroke-[1.5]" />
            ) : (
              <SearchIcon className="w-4.25 h-4.25 stroke-[1.5]" />
            )}
          </IconButton>
          <IconButton onClick={onOpenTrash} title={t("commands.openTrash")}>
            <TrashIcon className="w-4.25 h-4.25 stroke-[1.5]" />
          </IconButton>
          <IconButton
            variant="ghost"
            onClick={handleNewNote}
            title={`${t("buttons.newNote")} (${mod}${isMac ? "" : "+"}N)`}
          >
            <PlusIcon className="w-5.25 h-5.25 stroke-[1.4]" />
          </IconButton>
        </div>
      </div>
      {/* Scrollable area with search and notes */}
      <div className="flex-1 overflow-y-auto relative" {...pullHandlers}>
        {/* Pull-to-refresh indicator (mobile only) */}
        {(isPulling || isRefreshing) && (
          <div
            className="md:hidden absolute top-0 left-0 right-0 flex items-center justify-center transition-all duration-200 ease-out"
            style={{
              height: `${Math.min(pullDistance, 60)}px`,
              opacity: Math.min(pullDistance / 60, 1),
            }}
          >
            <div
              className={`w-5 h-5 ${isRefreshing || willRefresh ? "animate-spin" : ""}`}
              style={{
                transform: `rotate(${pullDistance * 2}deg)`,
              }}
            >
              <RefreshCwIcon className="w-full h-full stroke-[1.5] text-text-muted" />
            </div>
          </div>
        )}
        {/* Search - sticky at top */}
        {searchOpen && (
          <div className="sticky top-0 z-10 px-2 pt-2 bg-bg-secondary">
            <div className="relative">
              <Input
                ref={searchInputRef}
                type="text"
                value={inputValue}
                onChange={handleSearchChange}
                onKeyDown={handleSearchKeyDown}
                placeholder={t("placeholders.searchNotes")}
                className="h-9 pr-8 text-sm"
              />
              {inputValue && (
                <button
                  onClick={handleClearSearch}
                  tabIndex={-1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                >
                  <XIcon className="w-4.5 h-4.5 stroke-[1.5]" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tags filter */}
        {availableTags.length > 0 && (
          <div className="px-2 pt-2 pb-1">
            <div className="flex flex-wrap gap-1.5">
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setTagFilter(selectedTag === tag ? null : tag)}
                  className={cn(
                    "inline-flex items-center px-2 py-1 text-2xs font-medium rounded transition-colors",
                    selectedTag === tag
                      ? "bg-accent text-white"
                      : "bg-bg-muted text-text-muted hover:bg-bg-emphasis hover:text-text",
                  )}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Note list */}
        <NoteList onNoteClick={onNoteClick} />
      </div>

      {/* Footer with git status, commit, and settings */}
      <Footer onOpenSettings={onOpenSettings} />
    </div>
  );
}
