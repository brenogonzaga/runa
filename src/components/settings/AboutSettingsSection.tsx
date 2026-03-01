import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { showUpdateToast } from "../../App";
import { Button } from "../ui";
import { RefreshCwIcon, SpinnerIcon, GithubIcon } from "../icons";

export function AboutSettingsSection() {
  const { t } = useTranslation();
  const [appVersion, setAppVersion] = useState<string>("");
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  useEffect(() => {
    getVersion()
      .then(setAppVersion)
      .catch(() => {});
  }, []);

  const handleCheckForUpdates = async () => {
    setCheckingUpdate(true);
    const result = await showUpdateToast();
    setCheckingUpdate(false);
    if (result === "no-update") {
      toast.success(t("toasts.latestVersion"));
    } else if (result === "error") {
      toast.error(t("toasts.updateCheckFailed"));
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

  return (
    <div className="space-y-4 sm:space-y-8 py-4 sm:py-8">
      {/* Version */}
      <section className="pb-2">
        <h2 className="text-xl font-medium mb-0.5">{t("sections.version")}</h2>
        <p className="text-sm text-text-muted mb-4">
          {t("sections.versionInfo", { version: appVersion || "..." })}
        </p>
        <Button
          onClick={handleCheckForUpdates}
          disabled={checkingUpdate}
          variant="outline"
          size="md"
          className="gap-1.25"
        >
          {checkingUpdate ? (
            <>
              <SpinnerIcon className="w-4.5 h-4.5 stroke-[1.5] animate-spin" />
              {t("buttons.checking")}
            </>
          ) : (
            <>
              <RefreshCwIcon className="w-4.5 h-4.5 stroke-[1.5]" />
              {t("buttons.checkUpdates")}
            </>
          )}
        </Button>
      </section>

      {/* Divider */}
      <div className="border-t border-border border-dashed" />

      {/* About Section */}
      <section className="pb-2">
        <h2 className="text-xl font-medium mb-1">{t("sections.aboutRuna")}</h2>
        <p className="text-sm text-text-muted mb-4">
          {t("about.description")}{" "}
          <button
            onClick={() => handleOpenUrl("https://www.brenogonzaga.com/runa")}
            className="text-text-muted border-b border-text-muted/50 hover:text-text hover:border-text cursor-pointer transition-colors"
          >
            {t("about.ourWebsite")}
          </button>
          .
        </p>
        <p className="text-sm text-text-muted mb-4">
          {t("about.forkedFrom")}{" "}
          <button
            onClick={() => handleOpenUrl("https://github.com/erictli/scratch")}
            className="text-text-muted border-b border-text-muted/50 hover:text-text hover:border-text cursor-pointer transition-colors"
          >
            {t("about.originalProject")}
          </button>
          {", "}
          {t("about.maintainedBy")}{" "}
          <button
            onClick={() => handleOpenUrl("https://brenogonzaga.com")}
            className="text-text-muted border-b border-text-muted/50 hover:text-text hover:border-text cursor-pointer transition-colors"
          >
            {t("about.authorName")}
          </button>{" "}
          {t("about.withMoralSupport")}
        </p>
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2">
          <Button
            onClick={() => handleOpenUrl("https://github.com/brenogonzaga/runa")}
            variant="outline"
            size="md"
            className="gap-1.25"
          >
            <GithubIcon className="w-4.5 h-4.5 stroke-[1.5]" />
            {t("buttons.viewOnGitHub")}
          </Button>
          <Button
            onClick={() => handleOpenUrl("https://github.com/brenogonzaga/runa/issues")}
            variant="ghost"
            size="md"
            className="gap-1.25 text-text"
          >
            {t("buttons.submitFeedback")}
          </Button>
        </div>
      </section>
    </div>
  );
}
