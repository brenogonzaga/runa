import { useCallback, memo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useGit } from "../../context/GitContext";
import {  IconButton } from "../ui";
import {
  GitBranchIcon,
  GitBranchDeletedIcon,
  GitCommitIcon,
  RefreshCwIcon,
  SpinnerIcon,
  SettingsIcon,
} from "../icons";
import { cn } from "../../lib/utils";
import { mod, isMac } from "../../lib/platform";
import { isMobilePlatform } from "../../services/notes";
import { Button } from "../ui/Button";
import { Tooltip } from "../ui/Tooltip";

interface FooterProps {
  onOpenSettings?: () => void;
}

export const Footer = memo(function Footer({ onOpenSettings }: FooterProps) {
  const { t } = useTranslation();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    isMobilePlatform().then(setIsMobile);
  }, []);

  const {
    status,
    isLoading,
    isSyncing,
    isCommitting,
    gitAvailable,
    sync,
    initRepo,
    commit,
    lastError,
    clearError,
  } = useGit();

  const handleCommit = useCallback(async () => {
    if (isCommitting) return;
    try {
      const success = await commit("Quick commit from Runa");
      if (success) {
        toast.success(t("toasts.changesCommitted"));
      } else {
        toast.error(t("toasts.commitFailed"));
      }
    } catch {
      toast.error(t("toasts.commitFailed"));
    }
  }, [commit, isCommitting, t]);

  const handleSync = useCallback(async () => {
    if (isSyncing) return;
    const result = await sync();
    if (result.ok) {
      toast.success(result.message);
    } else {
      toast.error(result.error);
    }
  }, [sync, isSyncing]);

  const handleEnableGit = useCallback(async () => {
    const success = await initRepo();
    if (success) {
      toast.success(t("toasts.gitInitialized"));
    } else {
      toast.error(t("toasts.gitInitFailed"));
    }
  }, [initRepo, t]);

  // Git status section
  const renderGitStatus = () => {
    if (!gitAvailable) {
      return null;
    }

    // Not a git repo - show init option
    if (status && !status.isRepo) {
      return (
        <Tooltip content={t("tooltips.initGitRepo")}>
          <Button
            onClick={handleEnableGit}
            variant="ghost"
            className="text-xs h-auto p-0 hover:bg-transparent"
          >
            {t("buttons.enableGit")}
          </Button>
        </Tooltip>
      );
    }

    // Show spinner only when loading and no error to display
    if (isLoading && !lastError) {
      return <SpinnerIcon className="w-3 h-3 text-text-muted animate-spin" />;
    }

    const hasChanges = status ? status.changedCount > 0 : false;

    return (
      <div className="flex items-center gap-1.5">
        {/* Branch icon with name on hover */}
        {status?.currentBranch ? (
          <Tooltip content={t("tooltips.branch") + " " + status.currentBranch}>
            <span className="text-text-muted flex items-center">
              <GitBranchIcon className="w-4.5 h-4.5 stroke-[1.5]" />
            </span>
          </Tooltip>
        ) : status ? (
          <Tooltip content={t("tooltips.noBranch")}>
            <span className="text-text-muted flex items-center">
              <GitBranchDeletedIcon className="w-4.5 h-4.5 stroke-[1.5] opacity-50" />
            </span>
          </Tooltip>
        ) : null}

        {/* Changes indicator */}
        {hasChanges && (
          <Tooltip content={t("tooltips.uncommittedChanges")}>
            <span className="text-xs text-text-muted/70">{t("status.filesChanged")}</span>
          </Tooltip>
        )}

        {/* Error indicator */}
        {lastError && (
          <Tooltip content={lastError}>
            <Button
              onClick={clearError}
              variant="link"
              className="text-xs h-auto p-0 text-orange-500 hover:text-orange-600 hover:no-underline"
            >
              {t("status.errorOccurred")}
            </Button>
          </Tooltip>
        )}
      </div>
    );
  };

  // Determine what buttons to show
  const hasChanges = (status?.changedCount ?? 0) > 0;
  const showCommitButton = gitAvailable && status?.isRepo && hasChanges;
  const behindCount = Math.max(status?.behindCount ?? 0, 0);
  const aheadCount = Math.max(status?.aheadCount ?? 0, 0);
  const syncCount = behindCount + aheadCount;
  const showSyncButton = status?.hasRemote && status?.hasUpstream;

  const syncTooltip = isSyncing
    ? t("tooltips.syncing")
    : behindCount > 0 && aheadCount > 0
      ? t("status.pullPush", { pull: behindCount, push: aheadCount })
      : behindCount > 0
        ? t("status.commitsToPull") + `: ${behindCount}`
        : aheadCount > 0
          ? t("status.commitsToPush") + `: ${aheadCount}`
          : t("tooltips.syncedRemote");

  return (
    <div className="shrink-0 border-t border-border">
      {/* Footer bar with git status and action buttons */}
      <div
        className="pl-4 pr-3 pt-2 flex items-center justify-between"
        style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom, 0px))" }}
      >
        {/* Git status - desktop only */}
        {!isMobile && renderGitStatus()}
        {isMobile && <div />}
        <div className="flex items-center gap-px">
          {/* Sync button — pulls then pushes, always visible when upstream is configured (desktop only) */}
          {!isMobile && showSyncButton && (
            <Tooltip content={syncTooltip}>
              <IconButton
                onClick={handleSync}
                disabled={isSyncing}
                aria-label={t("editor.sync")}
              >
                {isSyncing ? (
                  <SpinnerIcon className="w-4.5 h-4.5 stroke-[1.5] animate-spin" />
                ) : (
                  <span className="relative flex items-center">
                    <RefreshCwIcon
                      className={cn(
                        "w-4.5 h-4.5 stroke-[1.5]",
                        syncCount === 0 && "opacity-50",
                      )}
                    />
                    {syncCount > 0 && (
                      <span className="absolute -top-1.25 -right-1.25 min-w-3.5 h-3.5 flex items-center justify-center rounded-full bg-accent text-text-inverse text-[9px] font-bold leading-none px-0.5">
                        {syncCount}
                      </span>
                    )}
                  </span>
                )}
              </IconButton>
            </Tooltip>
          )}
          {/* Commit button - desktop only */}
          {!isMobile && showCommitButton && (
            <IconButton
              onClick={handleCommit}
              disabled={isCommitting}
              title={t("tooltips.quickCommit")}
            >
              {isCommitting ? (
                <SpinnerIcon className="w-4.5 h-4.5 stroke-[1.5] animate-spin" />
              ) : (
                <GitCommitIcon className="w-4.5 h-4.5 stroke-[1.5]" />
              )}
            </IconButton>
          )}
          <IconButton
            onClick={onOpenSettings}
            title={`Settings (${mod}${isMac ? "" : "+"}, to toggle)`}
          >
            <SettingsIcon className="w-4.5 h-4.5 stroke-[1.5]" />
          </IconButton>
        </div>
      </div>
    </div>
  );
});
