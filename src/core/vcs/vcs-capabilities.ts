/**
 * VCS Capabilities — capability set per VCS type for feature gating.
 *
 * Each VCS type maps to a fixed set of capabilities it supports.
 * UI and API layers consume these via getVcsCapabilities() to decide
 * which features to render or allow.
 */

import type { VcsType, VcsCapability } from "./vcs-types";

/** All capabilities supported by Git. */
const GIT_CAPABILITIES: VcsCapability[] = [
  "fileBrowse", "fileEdit", "diff", "commitHistory", "stageUnstage",
  "commit", "branchManagement", "pullUpdate", "push", "rebase",
  "reset", "worktree", "blame", "logGraph", "remoteAuth",
];

/** Capabilities supported by SVN. */
const SVN_CAPABILITIES: VcsCapability[] = [
  "fileBrowse", "fileEdit", "diff", "commitHistory",
  "commit", "pullUpdate", "push", "blame", "remoteAuth",
];

/** Capabilities for non-VCS directories (plain folders). */
const NONE_CAPABILITIES: VcsCapability[] = [
  "fileBrowse", "fileEdit",
];

/** Map from VcsType to its capability list. */
const VCS_CAPABILITY_MAP: Record<VcsType, VcsCapability[]> = {
  git: GIT_CAPABILITIES,
  svn: SVN_CAPABILITIES,
  none: NONE_CAPABILITIES,
};

/**
 * Get the set of VCS capabilities for a given VCS type.
 * Defaults to Git capabilities for backward compatibility when vcsType is undefined.
 */
export function getVcsCapabilities(vcsType?: VcsType | null): Set<VcsCapability> {
  const resolved = vcsType ?? "git";
  const caps = VCS_CAPABILITY_MAP[resolved] ?? GIT_CAPABILITIES;
  return new Set(caps);
}

/**
 * Check if a specific capability is supported for a given VCS type.
 * Convenience wrapper around getVcsCapabilities().
 */
export function hasVcsCapability(
  vcsType: VcsType | undefined | null,
  capability: VcsCapability,
): boolean {
  return getVcsCapabilities(vcsType).has(capability);
}
