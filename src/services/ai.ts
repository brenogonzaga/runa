import { invoke } from "@tauri-apps/api/core";
import { isMobilePlatform } from "./notes";

export type AiProvider = "claude" | "codex";

export interface AiExecutionResult {
  success: boolean;
  output: string;
  error: string | null;
}

export async function checkClaudeCli(): Promise<boolean> {
  try {
    const isMobile = await isMobilePlatform();
    if (isMobile) return false;
    return invoke("ai_check_claude_cli");
  } catch {
    return false;
  }
}

export async function executeClaudeEdit(
  filePath: string,
  prompt: string,
): Promise<AiExecutionResult> {
  const isMobile = await isMobilePlatform();
  if (isMobile) {
    return {
      success: false,
      output: "",
      error: "AI editing is not available on mobile",
    };
  }
  return invoke("ai_execute_claude", { filePath, prompt });
}

export async function checkCodexCli(): Promise<boolean> {
  try {
    const isMobile = await isMobilePlatform();
    if (isMobile) return false;
    return invoke("ai_check_codex_cli");
  } catch {
    return false;
  }
}

export async function executeCodexEdit(
  filePath: string,
  prompt: string,
): Promise<AiExecutionResult> {
  const isMobile = await isMobilePlatform();
  if (isMobile) {
    return {
      success: false,
      output: "",
      error: "AI editing is not available on mobile",
    };
  }
  return invoke("ai_execute_codex", { filePath, prompt });
}
