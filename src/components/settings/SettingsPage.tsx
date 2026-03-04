import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "../../lib/utils";
import {
  ArrowLeftIcon,
  FolderIcon,
  SwatchIcon,
  KeyboardIcon,
  InfoIcon,
  ChevronDownIcon,
} from "../icons";
import { IconButton } from "../ui";
import { GeneralSettingsSection } from "./GeneralSettingsSection";
import { AppearanceSettingsSection } from "./EditorSettingsSection";
import { ShortcutsSettingsSection } from "./ShortcutsSettingsSection";
import { AboutSettingsSection } from "./AboutSettingsSection";
import { mod, isMac, isMacDesktop } from "../../lib/platform";
import { Button } from "../ui/Button";

interface SettingsPageProps {
  onBack: () => void;
}

type SettingsTab = "general" | "editor" | "shortcuts" | "about";

const tabs: {
  id: SettingsTab;
  labelKey: string;
  icon: typeof FolderIcon;
  shortcut: string;
}[] = [
  { id: "general", labelKey: "navigation.general", icon: FolderIcon, shortcut: "1" },
  { id: "editor", labelKey: "navigation.appearance", icon: SwatchIcon, shortcut: "2" },
  { id: "shortcuts", labelKey: "navigation.shortcuts", icon: KeyboardIcon, shortcut: "3" },
  { id: "about", labelKey: "navigation.about", icon: InfoIcon, shortcut: "4" },
];

export function SettingsPage({ onBack }: SettingsPageProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Reset scroll position when tab changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "1") {
          e.preventDefault();
          setActiveTab("general");
        } else if (e.key === "2") {
          e.preventDefault();
          setActiveTab("editor");
        } else if (e.key === "3") {
          e.preventDefault();
          setActiveTab("shortcuts");
        } else if (e.key === "4") {
          e.preventDefault();
          setActiveTab("about");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="h-full flex flex-col md:flex-row bg-bg w-full">
      {/* ── Desktop sidebar (md+) ──────────────────────────────── */}
      <div className="hidden md:flex w-64 h-full bg-bg-secondary border-r border-border flex-col select-none">
        {/* Drag region */}
        <div
          className={`h-11 shrink-0 ${isMacDesktop ? "pl-22" : ""}`}
          data-tauri-drag-region
        ></div>

        {/* Header with back button and Settings title */}
        <div className="flex items-center justify-between px-3 pb-2 border-b border-border shrink-0">
          <div className="flex items-center gap-1">
            <IconButton onClick={onBack} title={`Back (${mod}${isMac ? "" : "+"},)`}>
              <ArrowLeftIcon className="w-4.5 h-4.5 stroke-[1.5]" />
            </IconButton>
            <div className="font-medium text-base">{t("common.settings")}</div>
          </div>
        </div>

        {/* Navigation tabs */}
        <nav className="flex-1 p-2 flex flex-col gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <Button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                variant={isActive ? "secondary" : "ghost"}
                size="sm"
                className="justify-between gap-2.5 h-10 pr-3.5"
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4.5 h-4.5 stroke-[1.5]" />
                  {t(tab.labelKey)}
                </div>
                <div className="text-xs text-text-muted">
                  <span className="mr-0.5">{mod}</span>
                  {tab.shortcut}
                </div>
              </Button>
            );
          })}
        </nav>
      </div>

      {/* ── Mobile header with dropdown menu (< md) ─────────────────────── */}
      <div className="md:hidden shrink-0 bg-bg-secondary border-b border-border select-none pt-safe">
        <div
          className={cn(
            "flex items-center justify-between min-h-12",
            isMacDesktop && "pl-22",
            !isMacDesktop && "px-3",
          )}
          data-tauri-drag-region
        >
          <div className="titlebar-no-drag flex items-center gap-1">
            <IconButton onClick={onBack} title={t("common.back")}>
              <ArrowLeftIcon className="w-4.5 h-4.5 stroke-[1.5]" />
            </IconButton>
            <span className="font-medium text-base">{t("common.settings")}</span>
          </div>
          {/* Dropdown menu for tab selection */}
          <div className="titlebar-no-drag">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 h-10 px-3">
                  {(() => {
                    const activeTabData = tabs.find((t) => t.id === activeTab);
                    const ActiveIcon = activeTabData?.icon || FolderIcon;
                    return (
                      <>
                        <ActiveIcon className="w-4.5 h-4.5 stroke-[1.5]" />
                        <span>{activeTabData ? t(activeTabData.labelKey) : ""}</span>
                        <ChevronDownIcon className="w-4 h-4 stroke-[1.5] text-text-muted" />
                      </>
                    );
                  })()}
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="min-w-44 bg-bg border border-border rounded-lg shadow-lg py-1 z-50"
                  sideOffset={5}
                  align="end"
                >
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <DropdownMenu.Item
                        key={tab.id}
                        className={`px-3 py-2.5 text-sm cursor-pointer outline-none flex items-center gap-2.5 ${
                          isActive
                            ? "bg-bg-muted text-text"
                            : "text-text hover:bg-bg-muted focus:bg-bg-muted"
                        }`}
                        onSelect={() => setActiveTab(tab.id)}
                      >
                        <Icon className="w-4.5 h-4.5 stroke-[1.5]" />
                        {t(tab.labelKey)}
                      </DropdownMenu.Item>
                    );
                  })}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col bg-bg overflow-hidden">
        {/* Drag region — desktop only (mobile header above handles it) */}
        <div className="hidden md:block h-11 shrink-0" data-tauri-drag-region></div>

        {/* Content - centered with max width */}
        <div ref={scrollContainerRef} className="flex-1 overflow-auto scrollbar-gutter-stable">
          <div className="w-full max-w-3xl mx-auto px-4 md:px-6 pb-6">
            {activeTab === "general" && <GeneralSettingsSection />}
            {activeTab === "editor" && <AppearanceSettingsSection />}
            {activeTab === "shortcuts" && <ShortcutsSettingsSection />}
            {activeTab === "about" && <AboutSettingsSection />}
          </div>
        </div>
      </div>
    </div>
  );
}
