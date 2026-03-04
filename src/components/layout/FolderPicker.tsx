import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import { useNotes } from "../../context/NotesContext";
import { useTheme } from "../../context/ThemeContext";
import { SpinnerIcon } from "../icons";
import { isMobilePlatform } from "../../services/notes";
import { isMacDesktop } from "../../lib/platform";
import { Button } from "../ui/Button";

export function FolderPicker() {
  const { t } = useTranslation();
  const { setNotesFolder } = useNotes();
  const { reloadSettings } = useTheme();
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    isMobilePlatform().then(setIsMobile);
  }, []);

  const handleSelectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Choose Notes Folder",
      });

      if (selected && typeof selected === "string") {
        await setNotesFolder(selected);
        // Reload theme/font settings from the new folder's .runa/settings.json
        await reloadSettings();
      }
    } catch (err) {
      console.error("Failed to select folder:", err);
    }
  };

  // Mobile: show loading state while the system auto-configures the default folder
  if (isMobile === null || isMobile) {
    return (
      <div className="h-full flex flex-col bg-bg-secondary">
        <div
          className={`pt-safe md:pt-0 md:h-11 shrink-0 ${isMacDesktop ? "pl-22" : ""}`}
          data-tauri-drag-region
        />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center p-4 sm:p-8 max-w-lg select-none">
            <SpinnerIcon className="w-8 h-8 mx-auto text-text-muted animate-spin mb-4" />
            <p className="text-text-muted">{t("status.settingUp")}</p>
          </div>
        </div>
      </div>
    );
  }

  // Desktop: show folder picker UI
  return (
    <div className="h-full flex flex-col bg-bg-secondary">
      {/* Draggable title bar area - safe area for mobile, fixed height for desktop */}
      <div
        className={`pt-safe md:pt-0 md:h-11 shrink-0 ${isMacDesktop ? "pl-22" : ""}`}
        data-tauri-drag-region
      />

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center p-4 sm:p-8 max-w-lg select-none">
          <img
            src="/runa.png"
            alt="Folders"
            className="w-48 h-auto mx-auto invert dark:invert-0 mb-2 animate-fade-in-up"
            style={{ animationDelay: "0ms" }}
          />

          <h1
            className="text-2xl sm:text-3xl text-text font-serif mb-2 tracking-[-0.01em] animate-fade-in-up"
            style={{ animationDelay: "100ms" }}
          >
            {t("folderPicker.welcome", { appName: "Runa" })}
          </h1>
          <p
            className="text-text-muted mb-6 animate-fade-in-up"
            style={{ animationDelay: "100ms" }}
          >
            {t("folderPicker.description")}
          </p>
          <div className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
            <Button onClick={handleSelectFolder} size="xl">
              {t("buttons.chooseFolder")}
            </Button>
          </div>

          <p
            className="mt-2 text-xs text-text-muted/60 animate-fade-in-up"
            style={{ animationDelay: "300ms" }}
          >
            {t("folderPicker.changeLater")}
          </p>
        </div>
      </div>
    </div>
  );
}
