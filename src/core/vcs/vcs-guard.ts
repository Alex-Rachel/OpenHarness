/**
 * VCS Guard — capability enforcement utility for API route handlers.
 *
 * Provides a single entry point to load a codebase by ID and verify that
 * its VCS type supports a required capability. Used as an early-return
 * guard in Next.js API routes to reject operations that the detected
 * VCS (SVN, plain directory, etc.) cannot perform.
 */

import type { VcsCapability, VcsType } from "./vcs-types";
import { hasVcsCapability } from "./vcs-capabilities";
import { resolveVcsType } from "./vcs-detect";
import type { Codebase } from "../models/codebase";

/** Human-readable labels for capabilities, used in error messages. */
const CAPABILITY_LABELS: Record<VcsCapability, string> = {
  stageUnstage: "Stage/unstage",
  rebase: "Rebase",
  reset: "Reset",
  worktree: "Worktree management",
  fileBrowse: "File browsing",
  fileEdit: "File editing",
  diff: "Diff",
  commitHistory: "Commit history",
  commit: "Commit",
  branchManagement: "Branch management",
  pullUpdate: "Pull/update",
  push: "Push",
  blame: "Blame",
  logGraph: "Log graph",
  remoteAuth: "Remote authentication",
  info: "Repository info",
  add: "Add to version control",
};

/**
 * Result of a VCS capability guard check.
 *
 * - `allowed = true`  → the codebase supports the capability; `codebase` is set.
 * - `allowed = false` → capability not supported; `errorMessage` describes why.
 */
export interface VcsGuardResult {
  allowed: boolean;
  codebase?: Codebase;
  errorMessage?: string;
}

/**
 * Check whether a codebase's VCS type supports a required capability.
 *
 * Loads the codebase from the store, resolves its VCS type (defaulting to
 * "git" for backward compatibility), and checks the capability map.
 *
 * Returns a {@link VcsGuardResult} that API handlers can branch on:
 * ```ts
 * const guard = await requireVcsCapability(codebaseId, "rebase", store);
 * if (!guard.allowed) {
 *   return NextResponse.json({ error: guard.errorMessage }, { status: 400 });
 * }
 * // proceed with guard.codebase
 * ```
 *
 * @param codebaseId  - The codebase ID to look up
 * @param capability  - The required VCS capability
 * @param store       - A codebase store with an async `get(id)` method
 * @returns A {@link VcsGuardResult} indicating whether the capability is supported
 */
export async function requireVcsCapability(
  codebaseId: string,
  capability: VcsCapability,
  store: { get(id: string): Promise<Codebase | undefined | null> },
): Promise<VcsGuardResult> {
  const codebase = await store.get(codebaseId);

  if (!codebase) {
    return {
      allowed: false,
      errorMessage: "Codebase not found",
    };
  }

  const vcsType: VcsType = resolveVcsType(codebase.vcsType);

  if (!hasVcsCapability(vcsType, capability)) {
    const label = CAPABILITY_LABELS[capability] ?? capability;
    return {
      allowed: false,
      errorMessage: `${label} requires a Git repository, but this codebase uses "${vcsType}"`,
    };
  }

  return { allowed: true, codebase };
}
