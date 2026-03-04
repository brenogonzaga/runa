import { PlusIcon } from "../icons";
import { cn } from "../../lib/utils";

interface FloatingActionButtonProps {
  onClick: () => void;
  title?: string;
  className?: string;
}

export function FloatingActionButton({
  onClick,
  title = "New Note",
  className,
}: FloatingActionButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full shadow-lg",
        "bg-accent text-text-inverse",
        "flex items-center justify-center",
        "hover:scale-105 active:scale-95",
        "transition-transform duration-200",
        "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg",
        "md:hidden",
        className,
      )}
    >
      <PlusIcon className="w-6 h-6 stroke-[1.8]" />
    </button>
  );
}
