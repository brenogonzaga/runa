import { useEffect, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import {  IconButton } from "../ui";
import { ArrowUpIcon, ArrowDownIcon, XIcon } from "../icons";
import { shift } from "../../lib/platform";
import { Input } from "../ui/Input";

interface SearchToolbarProps {
  query: string;
  onChange: (query: string) => void;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
  currentMatch: number;
  totalMatches: number;
  inputRef: RefObject<HTMLInputElement | null>;
}

export function SearchToolbar({
  query,
  onChange,
  onNext,
  onPrevious,
  onClose,
  currentMatch,
  totalMatches,
  inputRef,
}: SearchToolbarProps) {
  const { t } = useTranslation();

  // Auto-focus input on mount
  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [inputRef]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) {
        onPrevious();
      } else {
        onNext();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === "Tab") {
      // Allow tab navigation within toolbar
      e.stopPropagation();
    }
  };

  return (
    <div className="flex items-center gap-1 bg-bg border border-border rounded-lg shadow-lg p-1 max-w-[calc(100vw-3rem)]">
      <Input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("placeholders.find")}
        className="w-28 sm:w-44 md:w-55 h-8 text-sm min-w-0"
        onKeyDown={handleKeyDown}
      />

      <span className="text-xs text-text-muted whitespace-nowrap px-1 min-w-17">
        {totalMatches > 0 ? `${currentMatch}/${totalMatches}` : t("search.notFound")}
      </span>

      <div className="flex items-center gap-px ml-1">
        <IconButton
          onClick={onPrevious}
          disabled={totalMatches === 0}
          title={`${t("tooltips.previousMatch")} (${shift}↵)`}
        >
          <ArrowUpIcon className="w-4.5 h-4.5 stroke-[1.5]" />
        </IconButton>

        <IconButton
          onClick={onNext}
          disabled={totalMatches === 0}
          title={`${t("tooltips.nextMatch")} (↵)`}
        >
          <ArrowDownIcon className="w-4.5 h-4.5 stroke-[1.5]" />
        </IconButton>

        <IconButton onClick={onClose} title={`${t("common.close")} (Esc)`}>
          <XIcon className="w-4.5 h-4.5 stroke-[1.5]" />
        </IconButton>
      </div>
    </div>
  );
}
