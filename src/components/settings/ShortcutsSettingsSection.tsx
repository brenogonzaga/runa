import { useTranslation } from "react-i18next";
import { mod } from "../../lib/platform";

interface Shortcut {
  keys: string[];
  descriptionKey: string;
  category: string;
}

const shortcuts: Shortcut[] = [
  {
    keys: [mod, "W"],
    descriptionKey: "shortcutsDescriptions.closeWindow",
    category: "Navigation",
  },
  {
    keys: [mod, "P"],
    descriptionKey: "shortcutsDescriptions.openCommandPalette",
    category: "Navigation",
  },
  {
    keys: [mod, "N"],
    descriptionKey: "shortcutsDescriptions.createNewNote",
    category: "Notes",
  },
  {
    keys: [mod, "R"],
    descriptionKey: "shortcutsDescriptions.reloadNote",
    category: "Notes",
  },
  {
    keys: [mod, ","],
    descriptionKey: "shortcutsDescriptions.openSettings",
    category: "Navigation",
  },
  {
    keys: [mod, "\\"],
    descriptionKey: "shortcutsDescriptions.toggleSidebar",
    category: "Navigation",
  },
  {
    keys: [mod, "K"],
    descriptionKey: "shortcutsDescriptions.addEditLink",
    category: "Editor",
  },
  {
    keys: [mod, "Shift", "C"],
    descriptionKey: "shortcutsDescriptions.openExportMenu",
    category: "Editor",
  },
  {
    keys: [mod, "F"],
    descriptionKey: "shortcutsDescriptions.findInNote",
    category: "Editor",
  },
  {
    keys: [mod, "Shift", "M"],
    descriptionKey: "shortcutsDescriptions.toggleMarkdownSource",
    category: "Editor",
  },
  {
    keys: [mod, "Shift", "Enter"],
    descriptionKey: "shortcutsDescriptions.enterFocusMode",
    category: "Editor",
  },
  {
    keys: [mod, "Shift", "F"],
    descriptionKey: "shortcutsDescriptions.searchNotes",
    category: "Navigation",
  },
];

// Group shortcuts by category
const groupedShortcuts = shortcuts.reduce(
  (acc, shortcut) => {
    const category = shortcut.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(shortcut);
    return acc;
  },
  {} as Record<string, Shortcut[]>,
);

// Render individual key as keyboard button
function KeyboardKey({ keyLabel }: { keyLabel: string }) {
  return (
    <kbd className="text-xs px-1.5 py-0.5 rounded-md bg-bg-muted text-text min-w-6.5 inline-flex items-center justify-center">
      {keyLabel}
    </kbd>
  );
}

// Render shortcut keys
function ShortcutKeys({ keys }: { keys: string[] }) {
  return (
    <div className="flex items-center gap-1.5">
      {keys.map((key, index) => (
        <KeyboardKey key={index} keyLabel={key} />
      ))}
    </div>
  );
}

export function ShortcutsSettingsSection() {
  const { t } = useTranslation();
  const categoryOrder = ["Navigation", "Notes", "Editor"];

  return (
    <div className="space-y-4 sm:space-y-8 pb-4 sm:pb-8">
      {categoryOrder.map((category, idx) => {
        const categoryShortcuts = groupedShortcuts[category];
        if (!categoryShortcuts) return null;

        return (
          <div key={category}>
            {idx > 0 && <div className="border-t border-border border-dashed" />}
            <section>
              <h2 className="text-xl font-medium pt-8 mb-4">{category}</h2>
              <div className="space-y-3">
                {categoryShortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4"
                  >
                    <span className="text-sm text-text font-medium">
                      {t(shortcut.descriptionKey)}
                    </span>
                    <ShortcutKeys keys={shortcut.keys} />
                  </div>
                ))}
              </div>
            </section>
          </div>
        );
      })}
    </div>
  );
}
