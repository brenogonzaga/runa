import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { useNotes } from "../../context/NotesContext";
import { useTheme } from "../../context/ThemeContext";
import { useGit } from "../../context/GitContext";
import { Button } from "../ui";
import { Input } from "../ui";
import {
  FolderIcon,
  FoldersIcon,
  ExternalLinkIcon,
  SpinnerIcon,
  CloudPlusIcon,
  ChevronRightIcon,
} from "../icons";
import type { Settings } from "../../types/note";
import { isMobilePlatform } from "../../services/notes";

// Format remote URL for display - extract user/repo from full URL
function formatRemoteUrl(url: string | null): string {
  if (!url) return "Connected";
  // Extract repo path from URL
  // SSH: git@github.com:user/repo.git
  // HTTPS: https://github.com/user/repo.git
  const sshMatch = url.match(/:([^/]+\/[^/]+?)(?:\.git)?$/);
  const httpsMatch = url.match(/\/([^/]+\/[^/]+?)(?:\.git)?$/);
  return sshMatch?.[1] || httpsMatch?.[1] || url;
}

// Convert git remote URL to a browsable web URL
function getRemoteWebUrl(url: string | null): string | null {
  if (!url) return null;
  // SSH: git@github.com:user/repo.git -> https://github.com/user/repo
  const sshMatch = url.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
  if (sshMatch) {
    return `https://${sshMatch[1]}/${sshMatch[2]}`;
  }
  // HTTPS: https://github.com/user/repo.git -> https://github.com/user/repo
  const httpsMatch = url.match(/^(https?:\/\/.+?)(?:\.git)?$/);
  if (httpsMatch) {
    return httpsMatch[1];
  }
  return null;
}

export function GeneralSettingsSection() {
  const { t } = useTranslation();
  const { notesFolder, setNotesFolder } = useNotes();
  const { reloadSettings } = useTheme();
  const {
    status,
    gitAvailable,
    initRepo,
    isLoading,
    addRemote,
    pushWithUpstream,
    isAddingRemote,
    isPushing,
    lastError,
    clearError,
  } = useGit();

  const [isMobile, setIsMobile] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState("");
  const [showRemoteInput, setShowRemoteInput] = useState(false);
  const [noteTemplate, setNoteTemplate] = useState<string>("Untitled");
  const [previewNoteName, setPreviewNoteName] = useState<string>("Untitled");

  // Detect mobile platform
  useEffect(() => {
    isMobilePlatform().then(setIsMobile);
  }, []);

  // Load template from settings on mount
  useEffect(() => {
    const loadTemplate = async () => {
      try {
        const settings = await invoke<Settings>("get_settings");
        const template = settings.defaultNoteName || "Untitled";
        setNoteTemplate(template);

        // Update preview
        const preview = await invoke<string>("preview_note_name", { template });
        setPreviewNoteName(preview);
      } catch (error) {
        console.error("Failed to load template:", error);
      }
    };
    loadTemplate();
  }, []);

  // Update preview when template changes (debounced)
  useEffect(() => {
    const updatePreview = async () => {
      try {
        const preview = await invoke<string>("preview_note_name", {
          template: noteTemplate,
        });
        setPreviewNoteName(preview);
      } catch (error) {
        setPreviewNoteName("Invalid template");
      }
    };

    const timer = setTimeout(updatePreview, 300);
    return () => clearTimeout(timer);
  }, [noteTemplate]);

  const handleSaveTemplate = async () => {
    try {
      const settings = await invoke<Settings>("get_settings");
      await invoke("update_settings", {
        newSettings: {
          ...settings,
          defaultNoteName: noteTemplate || undefined,
        },
      });
      toast.success(t("toasts.defaultNameSaved"));
    } catch (error) {
      console.error("Failed to save default name:", error);
      toast.error(t("toasts.defaultNameFailed"));
    }
  };

  const handleChangeFolder = async () => {
    try {
      const selected = await invoke<string | null>("open_folder_dialog", {
        defaultPath: notesFolder || null,
      });

      if (selected) {
        await setNotesFolder(selected);
        // Reload theme/font settings from the new folder's .runa/settings.json
        await reloadSettings();
      }
    } catch (err) {
      console.error("Failed to select folder:", err);
      toast.error(t("toasts.folderSelectFailed"));
    }
  };

  const handleOpenFolder = async () => {
    if (!notesFolder) return;
    try {
      await invoke("open_in_file_manager", { path: notesFolder });
    } catch (err) {
      console.error("Failed to open folder:", err);
      toast.error(t("toasts.folderOpenFailed"));
    }
  };

  const handleOpenUrl = async (url: string) => {
    try {
      await invoke("open_url_safe", { url });
    } catch (err) {
      console.error("Failed to open URL:", err);
      toast.error(err instanceof Error ? err.message : t("toasts.urlOpenFailed"));
    }
  };

  // Format path for display - truncate middle if too long
  const formatPath = (path: string | null): string => {
    if (!path) return t("common.notSet");
    const maxLength = 50;
    if (path.length <= maxLength) return path;

    // Show start and end of path
    const start = path.slice(0, 20);
    const end = path.slice(-25);
    return `${start}...${end}`;
  };

  const handleAddRemote = async () => {
    // Guard against concurrent submissions
    if (isAddingRemote) return;
    if (!remoteUrl.trim()) return;
    const success = await addRemote(remoteUrl.trim());
    if (success) {
      setRemoteUrl("");
      setShowRemoteInput(false);
    }
  };

  const handlePushWithUpstream = async () => {
    await pushWithUpstream();
  };

  const handleCancelRemote = () => {
    setShowRemoteInput(false);
    setRemoteUrl("");
    clearError();
  };

  return (
    <div className="space-y-4 sm:space-y-8 py-4 sm:py-8">
      {/* Folder Location */}
      <section className="pb-2">
        <h2 className="text-xl font-medium mb-0.5">{t("sections.folderLocation")}</h2>
        <p className="text-sm text-text-muted mb-4">{t("sections.folderDescription")}</p>
        <div className="flex items-center gap-2.5 p-2.5 rounded-[10px] border border-border mb-2.5">
          <div className="p-2 rounded-md bg-bg-muted">
            <FolderIcon className="w-4.5 h-4.5 stroke-[1.5] text-text-muted" />
          </div>
          <p className="text-sm text-text-muted truncate" title={notesFolder || undefined}>
            {formatPath(notesFolder)}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
          {/* Change folder - desktop only */}
          {!isMobile && (
            <Button
              onClick={handleChangeFolder}
              variant="outline"
              size="md"
              className="gap-1.25"
            >
              <FoldersIcon className="w-4.5 h-4.5 stroke-[1.5]" />
              {t("buttons.changeFolder")}
            </Button>
          )}
          {!isMobile && notesFolder && (
            <Button
              onClick={handleOpenFolder}
              variant="ghost"
              size="md"
              className="gap-1.25 text-text"
            >
              {t("buttons.openFolder")}
            </Button>
          )}
        </div>
      </section>

      {/* Git Section - desktop only */}
      {!isMobile && (
        <>
          {/* Divider */}
          <div className="border-t border-border border-dashed" />

          <section className="pb-2">
            <h2 className="text-xl font-medium mb-0.5">{t("sections.versionControl")}</h2>
            <p className="text-sm text-text-muted mb-4">{t("sections.gitDescription")}</p>
            {!gitAvailable ? (
              <div className="bg-bg-secondary rounded-[10px] border border-border p-4">
                <p className="text-sm text-text-muted">
                  {t("git.notAvailable")}{" "}
                  <a
                    href="https://git-scm.com/downloads"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-text-muted border-b border-text-muted/50 hover:text-text hover:border-text cursor-pointer transition-colors"
                  >
                    {t("git.installGit")}
                  </a>{" "}
                  {t("git.toEnableVersionControl")}
                </p>
              </div>
            ) : isLoading ? (
              <div className="rounded-[10px] border border-border p-4 flex items-center justify-center">
                <SpinnerIcon className="w-4.5 h-4.5 stroke-[1.5] animate-spin text-text-muted" />
              </div>
            ) : !status?.isRepo ? (
              <div className="bg-bg-secondary rounded-[10px] border border-border p-4">
                <p className="text-sm text-text-muted mb-2">
                  Enable Git to track changes to your notes with version control. Your changes
                  will be tracked automatically and you can commit and push from the sidebar.
                </p>
                <Button onClick={initRepo} disabled={isLoading} variant="outline" size="md">
                  {t("buttons.initGit")}
                </Button>
              </div>
            ) : (
              <>
                <div className="rounded-[10px] border border-border p-4 space-y-2.5">
                  {/* Branch status */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text font-medium">{t("git.status")}</span>
                    <span className="text-sm text-text-muted">
                      {status.currentBranch
                        ? t("status.onBranch", { branch: status.currentBranch })
                        : t("status.gitEnabled")}
                    </span>
                  </div>

                  {/* Remote configuration */}
                  {status.hasRemote ? (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                        <span className="text-sm text-text font-medium">{t("git.remote")}</span>
                        {getRemoteWebUrl(status.remoteUrl) ? (
                          <button
                            onClick={() => handleOpenUrl(getRemoteWebUrl(status.remoteUrl)!)}
                            className="flex items-center gap-0.75 text-sm text-text-muted hover:text-text truncate transition-colors cursor-pointer"
                            title={status.remoteUrl || undefined}
                          >
                            <span className="truncate">
                              {formatRemoteUrl(status.remoteUrl)}
                            </span>
                            <ExternalLinkIcon className="w-3.25 h-3.25 shrink-0" />
                          </button>
                        ) : (
                          <span
                            className="text-sm text-text-muted truncate"
                            title={status.remoteUrl || undefined}
                          >
                            {formatRemoteUrl(status.remoteUrl)}
                          </span>
                        )}
                      </div>

                      {/* Upstream tracking status */}
                      {status.hasUpstream ? (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                          <span className="text-sm text-text font-medium">
                            {t("git.tracking")}
                          </span>
                          <span className="text-sm text-text-muted">
                            origin/{status.currentBranch}
                          </span>
                        </div>
                      ) : (
                        status.currentBranch && (
                          <div className="pt-3 border-t border-border border-dashed space-y-0.5">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                              <span className="text-sm text-text font-medium">
                                {t("git.tracking")}
                              </span>
                              <span className="text-sm font-medium text-amber-500">
                                {t("status.notSetUp")}
                              </span>
                            </div>
                            <p className="text-sm text-text-muted mb-2">
                              {t("git.pushTrackingDescription", {
                                branch: status.currentBranch,
                              })}
                            </p>
                            <Button
                              onClick={handlePushWithUpstream}
                              disabled={isPushing}
                              size="sm"
                              className="mb-1.5"
                            >
                              {isPushing ? (
                                <>
                                  <SpinnerIcon className="w-3.25 h-3.25 mr-2 animate-spin" />
                                  {t("buttons.pushing")}
                                </>
                              ) : (
                                t("buttons.pushAndTrack", { branch: status.currentBranch })
                              )}
                            </Button>
                          </div>
                        )
                      )}
                    </>
                  ) : (
                    <div className="pt-3 border-t border-border border-dashed space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                        <span className="text-sm text-text font-medium">{t("git.remote")}</span>
                        <span className="text-sm font-medium text-orange-500">
                          {t("status.notConnected")}
                        </span>
                      </div>

                      {showRemoteInput ? (
                        <div className="space-y-2">
                          <Input
                            type="text"
                            value={remoteUrl}
                            onChange={(e) => setRemoteUrl(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleAddRemote();
                              if (e.key === "Escape") handleCancelRemote();
                            }}
                            placeholder="https://github.com/user/repo.git"
                            autoFocus
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              onClick={handleAddRemote}
                              disabled={isAddingRemote || !remoteUrl.trim()}
                              size="sm"
                            >
                              {isAddingRemote ? (
                                <>
                                  <SpinnerIcon className="w-3 h-3 mr-2 animate-spin" />
                                  {t("buttons.connecting")}
                                </>
                              ) : (
                                t("buttons.connect")
                              )}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={handleCancelRemote}>
                              {t("common.cancel")}
                            </Button>
                          </div>
                          <RemoteInstructions />
                        </div>
                      ) : (
                        <>
                          <Button
                            onClick={() => setShowRemoteInput(true)}
                            variant="outline"
                            size="md"
                          >
                            <CloudPlusIcon className="w-4 h-4 stroke-[1.7] mr-1.5" />
                            {t("buttons.addRemote")}
                          </Button>
                          <RemoteInstructions />
                        </>
                      )}
                    </div>
                  )}

                  {/* Changes count */}
                  {status.changedCount > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 pt-3 border-t border-border border-dashed">
                      <span className="text-sm text-text font-medium">
                        {t("status.changesToCommit")}
                      </span>
                      <span className="text-sm text-text-muted">
                        {t(
                          status.changedCount === 1
                            ? "git.filesChanged"
                            : "git.filesChanged_plural",
                          { count: status.changedCount },
                        )}
                      </span>
                    </div>
                  )}

                  {/* Commits to push */}
                  {status.aheadCount > 0 && status.hasUpstream && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                      <span className="text-sm text-text font-medium">
                        {t("status.commitsToPush")}
                      </span>
                      <span className="text-sm text-text-muted">
                        {t(status.aheadCount === 1 ? "git.commits" : "git.commits_plural", {
                          count: status.aheadCount,
                        })}
                      </span>
                    </div>
                  )}

                  {/* Commits to pull */}
                  {status.behindCount > 0 && status.hasUpstream && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                      <span className="text-sm text-text font-medium">
                        {t("status.commitsToPull")}
                      </span>
                      <span className="text-sm text-text-muted">
                        {t(status.behindCount === 1 ? "git.commits" : "git.commits_plural", {
                          count: status.behindCount,
                        })}
                      </span>
                    </div>
                  )}

                  {/* Error display */}
                  {lastError && (
                    <div className="pt-3 border-t border-border">
                      <div className="bg-red-500/10 border border-red-500/20 rounded-md p-3">
                        <p className="text-sm text-red-500">{lastError}</p>
                        {(lastError.includes("Authentication") ||
                          lastError.includes("SSH")) && (
                          <a
                            href="https://docs.github.com/en/authentication/connecting-to-github-with-ssh"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-red-400 hover:text-red-300 underline mt-1 inline-block"
                          >
                            {t("git.learnSsh")}
                          </a>
                        )}
                        <Button
                          onClick={clearError}
                          variant="link"
                          className="block text-xs h-auto p-0 mt-2 text-red-400 hover:text-red-300"
                        >
                          {t("buttons.dismiss")}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </>
      )}

      {/* Divider */}
      <div className="border-t border-border border-dashed" />

      {/* New Note Template */}
      <section className="pb-2">
        <h2 className="text-xl font-medium mb-0.5">{t("sections.defaultNoteName")}</h2>
        <p className="text-sm text-text-muted mb-4">{t("sections.defaultNoteDescription")}</p>

        <div className="space-y-2">
          <div>
            <Input
              type="text"
              value={noteTemplate}
              onChange={(e) => setNoteTemplate(e.target.value)}
              onBlur={handleSaveTemplate}
              placeholder={t("placeholders.untitled")}
            />
          </div>
          <div className="text-2xs text-text-muted font-mono p-2 rounded-md bg-bg-muted mb-4">
            {t("sections.preview")}: {previewNoteName}
          </div>

          {/* Template Tags Reference */}
          <details className="text-sm">
            <summary className="cursor-pointer text-text-muted hover:text-text select-none flex items-center gap-1 font-medium">
              <ChevronRightIcon className="w-3.5 h-3.5 stroke-2 transition-transform [[open]>&]:rotate-90" />
              {t("sections.templateTags")}
            </summary>
            <div className="mt-2 space-y-1.5 pl-2 text-text-muted">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-xs">
                <code>{"{timestamp}"}</code>
                <span>1739586000</span>
                <code>{"{date}"}</code>
                <span>2026-02-15</span>
                <code>{"{time}"}</code>
                <span>14-30-45</span>
                <code>{"{year}"}</code>
                <span>2026</span>
                <code>{"{month}"}</code>
                <span>02</span>
                <code>{"{day}"}</code>
                <span>15</span>
                <code>{"{counter}"}</code>
                <span>1, 2, 3...</span>
              </div>
              <p className="text-xs mt-2 pt-2 border-t border-border">
                Examples: <code>Note-{"{year}-{month}-{day}"}</code>
              </p>
            </div>
          </details>
        </div>
      </section>
    </div>
  );
}

function RemoteInstructions() {
  const { t } = useTranslation();
  return (
    <div className="text-sm text-text-muted space-y-1.5 pt-2 pb-1.5">
      <p className="font-medium">{t("git.remoteInstructions.title")}</p>
      <ol className="list-decimal list-inside space-y-0.5 pl-1">
        <li>{t("git.remoteInstructions.step1")}</li>
        <li>{t("git.remoteInstructions.step2")}</li>
        <li>{t("git.remoteInstructions.step3")}</li>
      </ol>
      <p className="text-text-muted/70 pt-1">{t("git.remoteInstructions.example")}</p>
    </div>
  );
}
