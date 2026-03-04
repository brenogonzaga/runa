import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { NoteMetadata } from "../../types/note";
import { getBacklinks } from "../../services/notes";
import { cn, cleanTitle } from "../../lib/utils";
import { LinkIcon, XIcon } from "../icons";

interface BacklinksPanelProps {
  noteId: string | null;
  onNoteClick: (id: string) => void;
  onClose?: () => void;
}

export function BacklinksPanel({ noteId, onNoteClick, onClose }: BacklinksPanelProps) {
  const { t } = useTranslation();
  const [backlinks, setBacklinks] = useState<NoteMetadata[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!noteId) {
      setBacklinks([]);
      return;
    }

    const loadBacklinks = async () => {
      setLoading(true);
      try {
        const links = await getBacklinks(noteId);
        setBacklinks(links);
      } catch (error) {
        console.error("Failed to load backlinks:", error);
        setBacklinks([]);
      } finally {
        setLoading(false);
      }
    };

    loadBacklinks();
  }, [noteId]);

  if (!noteId) {
    return (
      <div className="w-full h-full border-l border-border bg-bg flex items-center justify-center">
        <p className="text-text-muted text-sm">{t("backlinks.selectNote")}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full border-l border-border bg-bg flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <LinkIcon className="w-4 h-4 text-text-muted" />
          <h3 className="text-sm font-semibold text-text">{t("backlinks.title")}</h3>
          <span className="text-xs text-text-muted">({backlinks.length})</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-bg-muted transition-colors md:hidden"
          >
            <XIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="text-center text-text-muted text-sm py-8">{t("common.loading")}</div>
        ) : backlinks.length === 0 ? (
          <div className="text-center text-text-muted text-sm py-8">
            <LinkIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>{t("backlinks.empty")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {backlinks.map((backlink) => (
              <button
                key={backlink.id}
                onClick={() => onNoteClick(backlink.id)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border border-border",
                  "hover:bg-bg-muted transition-colors cursor-pointer",
                )}
              >
                <h4 className="text-sm font-medium text-text mb-1">
                  {cleanTitle(backlink.title)}
                </h4>
                {backlink.preview && (
                  <p className="text-xs text-text-muted line-clamp-2">{backlink.preview}</p>
                )}
                <p className="text-2xs text-text-muted mt-1.5">
                  {new Date(backlink.modified * 1000).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
