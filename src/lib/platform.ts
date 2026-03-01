/**
 * Platform detection utilities for cross-platform shortcut labels.
 * On macOS: ⌘, ⌥, ⇧
 * On Windows/Linux: Ctrl, Alt, Shift
 */

const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";

/** Any Apple platform (macOS, iOS, iPadOS) - for shortcuts with ⌘ */
export const isMac = /Mac|iPhone|iPad|iPod/.test(ua);

/** iOS/iPadOS only - for touch-specific UI */
export const isIOS = /iPhone|iPad|iPod/.test(ua);

/** macOS desktop only (not iOS) - for traffic light titlebar padding */
export const isMacDesktop = isMac && !isIOS;

/** Modifier key symbol/label */
export const mod = isMac ? "⌘" : "Ctrl";
export const alt = isMac ? "⌥" : "Alt";
export const shift = isMac ? "⇧" : "Shift";

/**
 * Build a shortcut label string.
 * e.g. shortcut("B") => "⌘B" on Mac, "Ctrl+B" on Windows
 */
export function shortcut(...parts: string[]): string {
  if (isMac) {
    return parts.join("");
  }
  return parts.join("+");
}
