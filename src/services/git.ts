import { invoke } from "@tauri-apps/api/core";
import { isMobilePlatform } from "./notes";

export interface GitStatus {
  isRepo: boolean;
  hasRemote: boolean;
  hasUpstream: boolean;
  remoteUrl: string | null;
  changedCount: number;
  aheadCount: number;
  behindCount: number;
  currentBranch: string | null;
  error: string | null;
}

export interface GitResult {
  success: boolean;
  message: string | null;
  error: string | null;
}

const defaultGitStatus: GitStatus = {
  isRepo: false,
  hasRemote: false,
  hasUpstream: false,
  remoteUrl: null,
  changedCount: 0,
  aheadCount: -1,
  behindCount: -1,
  currentBranch: null,
  error: null,
};

const notAvailableResult: GitResult = {
  success: false,
  message: null,
  error: "Git is not available on mobile",
};

export async function isGitAvailable(): Promise<boolean> {
  try {
    const isMobile = await isMobilePlatform();
    if (isMobile) return false;
    return invoke("git_is_available");
  } catch {
    return false;
  }
}

export async function getGitStatus(): Promise<GitStatus> {
  try {
    const isMobile = await isMobilePlatform();
    if (isMobile) return defaultGitStatus;
    return invoke("git_get_status");
  } catch {
    return defaultGitStatus;
  }
}

export async function initGitRepo(): Promise<void> {
  const isMobile = await isMobilePlatform();
  if (isMobile) throw new Error("Git is not available on mobile");
  return invoke("git_init_repo");
}

export async function gitCommit(message: string): Promise<GitResult> {
  const isMobile = await isMobilePlatform();
  if (isMobile) return notAvailableResult;
  return invoke("git_commit", { message });
}

export async function gitPush(): Promise<GitResult> {
  const isMobile = await isMobilePlatform();
  if (isMobile) return notAvailableResult;
  return invoke("git_push");
}

export async function gitFetch(): Promise<GitResult> {
  const isMobile = await isMobilePlatform();
  if (isMobile) return notAvailableResult;
  return invoke("git_fetch");
}

export async function gitPull(): Promise<GitResult> {
  const isMobile = await isMobilePlatform();
  if (isMobile) return notAvailableResult;
  return invoke("git_pull");
}

export async function addRemote(url: string): Promise<GitResult> {
  const isMobile = await isMobilePlatform();
  if (isMobile) return notAvailableResult;
  return invoke("git_add_remote", { url });
}

export async function pushWithUpstream(): Promise<GitResult> {
  const isMobile = await isMobilePlatform();
  if (isMobile) return notAvailableResult;
  return invoke("git_push_with_upstream");
}
