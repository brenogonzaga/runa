import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { NoteMetadata } from "../../types/note";
import {
  emptyTrash,
  listTrash,
  permanentlyDeleteNote,
  restoreNote,
} from "../../services/notes";
import { Button } from "../ui/Button";
import { RestoreIcon, TrashIcon, XIcon } from "../icons";
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

interface TrashModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNoteRestored?: () => void;
}

export function TrashModal({ isOpen, onClose, onNoteRestored }: TrashModalProps) {
  const { t } = useTranslation();
  const [trashedNotes, setTrashedNotes] = useState<NoteMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [emptyTrashDialogOpen, setEmptyTrashDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTrash();
    }
  }, [isOpen]);

  const loadTrash = async () => {
    setLoading(true);
    try {
      const notes = await listTrash();
      setTrashedNotes(notes);
    } catch (error) {
      console.error("Failed to load trash:", error);
      toast.error(t("toasts.trashLoadError"));
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await restoreNote(id);
      toast.success(t("toasts.noteRestored"));
      await loadTrash();
      onNoteRestored?.();
    } catch (error) {
      console.error("Failed to restore note:", error);
      toast.error(t("toasts.restoreError"));
    }
  };

  const handlePermanentDelete = (id: string, title: string) => {
    setNoteToDelete({ id, title });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!noteToDelete) return;

    try {
      await permanentlyDeleteNote(noteToDelete.id);
      toast.success(t("toasts.notePermanentlyDeleted"));
      await loadTrash();
      setDeleteDialogOpen(false);
      setNoteToDelete(null);
    } catch (error) {
      console.error("Failed to permanently delete note:", error);
      toast.error(t("toasts.deleteError"));
    }
  };

  const handleEmptyTrash = () => {
    if (trashedNotes.length === 0) return;
    setEmptyTrashDialogOpen(true);
  };

  const handleEmptyTrashConfirm = async () => {
    try {
      await emptyTrash();
      toast.success(t("toasts.trashEmptied"));
      setTrashedNotes([]);
      setEmptyTrashDialogOpen(false);
    } catch (error) {
      console.error("Failed to empty trash:", error);
      toast.error(t("toasts.emptyTrashError"));
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={onClose}
      >
        <div
          className="bg-bg w-full max-w-2xl max-h-[80vh] rounded-lg shadow-xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <TrashIcon className="w-5 h-5" />
              <h2 className="text-lg font-semibold text-text">{t("trash.title")}</h2>
              <span className="text-sm text-text-muted">({trashedNotes.length})</span>
            </div>
            <div className="flex items-center gap-2">
              {trashedNotes.length > 0 && (
                <Button variant="ghost" size="sm" onClick={handleEmptyTrash}>
                  {t("trash.emptyTrash")}
                </Button>
              )}
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-bg-muted transition-colors"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <div className="text-center text-text-muted py-8">{t("trash.loading")}</div>
            ) : trashedNotes.length === 0 ? (
              <div className="text-center text-text-muted py-12">
                <TrashIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>{t("trash.empty")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {trashedNotes.map((note) => (
                  <div
                    key={note.id}
                    className="border border-border rounded-lg p-4 hover:bg-bg-muted transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-text truncate">{note.title}</h3>
                        <p className="text-sm text-text-muted line-clamp-2 mt-1">
                          {note.preview}
                        </p>
                        <p className="text-xs text-text-muted mt-2">
                          {new Date(note.modified * 1000).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRestore(note.id)}
                          title={t("trash.restore")}
                        >
                          <RestoreIcon className="w-4 h-4 mr-1" />
                          {t("trash.restore")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePermanentDelete(note.id, note.title)}
                          title={t("trash.deletePermanently")}
                        >
                          <TrashIcon className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Single Note Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dialogs.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {noteToDelete &&
                t("dialogs.permanentDeleteConfirm", { title: noteToDelete.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("dialogs.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              {t("dialogs.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Empty Trash Confirmation Dialog */}
      <AlertDialog open={emptyTrashDialogOpen} onOpenChange={setEmptyTrashDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dialogs.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("dialogs.emptyTrashConfirm", { count: trashedNotes.length })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("dialogs.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleEmptyTrashConfirm}>
              {t("trash.emptyTrash")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
