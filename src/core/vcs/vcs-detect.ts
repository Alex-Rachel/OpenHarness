/**
 * VCS Detection — auto-detect version control type from directory contents.
 *
 * Uses lightweight filesystem checks (no CLI process invocation):
 *   - .git/ directory → "git"
 *   - .svn/ directory → "svn"
 *   - valid directory with neither → "none"
 */

import path from "path";
import type { VcsType } from "./vcs-types";

/**
 * Detect the VCS type of a directory by checking for metadata subdirectories.
 *
 * Detection order: .git/ → .svn/ → "none"
 * Git takes priority when both directories are present.
 *
 * @param dirPath - Absolute path to the directory to inspect
 * @returns The detected VcsType, or undefined if the path is invalid
 */
export function detectVcsType(dirPath: string): VcsType | undefined {
  const bridge = getServerBridge();
  const fs = bridge.fs;

  if (!fs.existsSync(dirPath)) {
    return undefined;
  }

  // Git takes priority — check .git/ first
  if (fs.existsSync(path.join(dirPath, ".git"))) {
    return "git";
  }

  // SVN working copy
  if (fs.existsSync(path.join(dirPath, ".svn"))) {
    return "svn";
  }

  // Valid directory without VCS metadata
  return "none";
}

/**
 * Resolve a VcsType, defaulting to "git" for backward compatibility.
 * Use this when reading from a Codebase record where vcsType may be null.
 */
export function resolveVcsType(vcsType?: string | null): VcsType {
  if (vcsType === "git" || vcsType === "svn" || vcsType === "none") {
    return vcsType;
  }
  return "git";
}

// Inline import to avoid circular dependencies at module level
function getServerBridge() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("../platform").getServerBridge();
}
