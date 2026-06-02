/**
 * SVN Utilities — core SVN operations for working copy management.
 *
 * Provides status, diff, commit, update, log, blame, revert, and add operations.
 * All operations shell out to the `svn` CLI via svnExec().
 */

import { svnExec } from "./svn-exec";

// ─── Types ─────────────────────────────────────────────────────────

export interface SvnStatusEntry {
  path: string;
  /** SVN status code: M=modified, A=added, D=deleted, R=replaced, C=conflicted, X=external, I=ignored, ? =untracked, !=missing */
  statusCode: string;
  /** Property status code */
  propertyStatusCode: string;
}

export interface SvnStatus {
  modified: SvnStatusEntry[];
  added: SvnStatusEntry[];
  deleted: SvnStatusEntry[];
  untracked: SvnStatusEntry[];
  missing: SvnStatusEntry[];
  conflicted: SvnStatusEntry[];
  all: SvnStatusEntry[];
}

export interface SvnLogEntry {
  revision: number;
  author: string;
  date: string;
  message: string;
}

export interface SvnBlameLine {
  lineNumber: number;
  revision: number;
  author: string;
  content: string;
}

export interface SvnUpdateResult {
  revision: number;
  summary: string;
}

// ─── Availability ──────────────────────────────────────────────────

/**
 * Check if the `svn` CLI is installed and available on the system PATH.
 */
export function isSvnAvailable(): boolean {
  try {
    svnExec(["--version", "--quiet"]);
    return true;
  } catch {
    return false;
  }
}

// ─── Status ────────────────────────────────────────────────────────

/**
 * Get SVN status of a working copy.
 * Runs `svn status` and parses the output into structured entries.
 */
export function getSvnStatus(repoPath: string): SvnStatus {
  const output = svnExec(["status"], { cwd: repoPath });
  const entries = parseSvnStatus(output);

  return {
    modified: entries.filter((e) => e.statusCode === "M"),
    added: entries.filter((e) => e.statusCode === "A"),
    deleted: entries.filter((e) => e.statusCode === "D"),
    untracked: entries.filter((e) => e.statusCode === "?"),
    missing: entries.filter((e) => e.statusCode === "!"),
    conflicted: entries.filter((e) => e.statusCode === "C"),
    all: entries,
  };
}

/**
 * Parse `svn status` output into structured entries.
 *
 * SVN status output format (per line):
 *   <file-status><prop-status><lock-status><hist-status><switch?><repo-lock> <path>
 * Example:
 *   M       src/foo.ts
 *   ?       newfile.ts
 *   A  +    merged.ts
 */
function parseSvnStatus(output: string): SvnStatusEntry[] {
  if (!output.trim()) return [];

  return output
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      const statusCode = line.charAt(0);
      const propertyStatusCode = line.charAt(1);
      // Path starts after column 7 (status fields are fixed-width)
      const path = line.substring(8).trim();
      return { path, statusCode, propertyStatusCode };
    })
    .filter((entry) => entry.path.length > 0);
}

// ─── Diff ──────────────────────────────────────────────────────────

/**
 * Get SVN diff for all changes in the working copy.
 * Runs `svn diff` and returns unified diff output.
 */
export function getSvnDiff(repoPath: string): string {
  try {
    return svnExec(["diff"], { cwd: repoPath });
  } catch (e) {
    // svn diff returns non-zero if there are no changes
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("E155") || msg.includes("no changes")) {
      return "";
    }
    throw e;
  }
}

/**
 * Get SVN diff for a single file.
 */
export function getSvnFileDiff(repoPath: string, filePath: string): string {
  try {
    return svnExec(["diff", filePath], { cwd: repoPath });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("E155") || msg.includes("no changes")) {
      return "";
    }
    throw e;
  }
}

// ─── Commit ────────────────────────────────────────────────────────

/**
 * Commit specified files with a message.
 * Runs `svn commit <files> -m "<message>"`.
 *
 * Note: SVN commits are pushed to the remote immediately (no separate push step).
 *
 * @returns The new revision number from the commit output
 */
export function svnCommit(
  repoPath: string,
  filePaths: string[],
  message: string,
): number {
  if (!filePaths.length) {
    throw new Error("At least one file must be specified for SVN commit");
  }

  const output = svnExec(["commit", ...filePaths, "-m", message], { cwd: repoPath });

  // Parse revision from output: "Committed revision 42."
  const match = output.match(/Committed revision (\d+)/);
  if (!match) {
    throw new Error(`Could not parse revision from SVN commit output: ${output}`);
  }
  return parseInt(match[1], 10);
}

// ─── Update ────────────────────────────────────────────────────────

/**
 * Update the working copy to the latest revision.
 * Runs `svn update`.
 */
export function svnUpdate(repoPath: string): SvnUpdateResult {
  const output = svnExec(["update"], { cwd: repoPath });

  // Parse revision from output: "Updated to revision 42." or "At revision 42."
  const match = output.match(/(?:Updated to|At) revision (\d+)/);
  const revision = match ? parseInt(match[1], 10) : 0;

  return {
    revision,
    summary: output.trim(),
  };
}

// ─── Log ───────────────────────────────────────────────────────────

/**
 * Get SVN log entries.
 * Runs `svn log -l <limit>` and parses the output.
 */
export function getSvnLog(repoPath: string, limit: number = 25): SvnLogEntry[] {
  const output = svnExec(["log", "-l", String(limit)], { cwd: repoPath });
  return parseSvnLog(output);
}

/**
 * Get SVN log for a specific file.
 */
export function getSvnFileLog(
  repoPath: string,
  filePath: string,
  limit: number = 25,
): SvnLogEntry[] {
  const output = svnExec(["log", "-l", String(limit), filePath], { cwd: repoPath });
  return parseSvnLog(output);
}

/**
 * Parse `svn log` output into structured entries.
 *
 * SVN log output format:
 *   ------------------------------------------------------------------------
 *   r42 | author | 2024-01-15 10:30:00 +0000 (Mon, 15 Jan 2024) | 1 line
 *
 *   Commit message here
 *   ------------------------------------------------------------------------
 */
function parseSvnLog(output: string): SvnLogEntry[] {
  if (!output.trim()) return [];

  const separator = "-".repeat(72);
  const blocks = output.split(separator).filter((block) => block.trim().length > 0);

  return blocks
    .map((block) => {
      const lines = block.trim().split("\n");
      if (lines.length < 2) return null;

      // Parse header line: r42 | author | date | N lines
      const headerMatch = lines[0].match(
        /^r(\d+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/,
      );
      if (!headerMatch) return null;

      const revision = parseInt(headerMatch[1], 10);
      const author = headerMatch[2].trim();
      const date = headerMatch[3].trim();
      // Message is everything after the header line, skip empty separator line
      const message = lines.slice(1).join("\n").trim();

      return { revision, author, date, message };
    })
    .filter((entry): entry is SvnLogEntry => entry !== null);
}

// ─── Blame ─────────────────────────────────────────────────────────

/**
 * Get SVN blame (annotate) for a file.
 * Runs `svn blame <file>` and returns line-by-line authorship.
 */
export function svnBlame(repoPath: string, filePath: string): SvnBlameLine[] {
  const output = svnExec(["blame", filePath], { cwd: repoPath });
  return parseSvnBlame(output);
}

/**
 * Parse `svn blame` output.
 *
 * SVN blame output format (per line):
 *   <revision> <author> <content>
 * Example:
 *   42 john const foo = "bar";
 */
function parseSvnBlame(output: string): SvnBlameLine[] {
  if (!output.trim()) return [];

  return output
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line, index) => {
      // SVN blame format: revision-padded author-padded content
      // Try to parse: number, then username, then rest
      const match = line.match(/^\s*(\d+|\-+)\s+(\S+)\s?(.*)/);
      if (!match) {
        return { lineNumber: index + 1, revision: 0, author: "", content: line };
      }
      const revisionStr = match[1].trim();
      return {
        lineNumber: index + 1,
        revision: revisionStr === "-" ? 0 : parseInt(revisionStr, 10),
        author: match[2],
        content: match[3] || "",
      };
    });
}

// ─── Revert ────────────────────────────────────────────────────────

/**
 * Revert local changes in the working copy.
 * - With specific file paths: `svn revert <files>`
 * - With empty array: `svn revert --recursive .` (revert all)
 */
export function svnRevert(repoPath: string, filePaths: string[]): void {
  if (filePaths.length === 0) {
    svnExec(["revert", "--recursive", "."], { cwd: repoPath });
  } else {
    svnExec(["revert", ...filePaths], { cwd: repoPath });
  }
}

// ─── Add ───────────────────────────────────────────────────────────

/**
 * Schedule a file for addition to version control.
 * Runs `svn add <file>`.
 */
export function svnAdd(repoPath: string, filePath: string): void {
  svnExec(["add", filePath], { cwd: repoPath });
}

// ─── Info ──────────────────────────────────────────────────────────

/**
 * Get the current revision of the working copy.
 * Runs `svn info --show-item revision`.
 */
export function getSvnRevision(repoPath: string): number {
  try {
    const output = svnExec(["info", "--show-item", "revision"], { cwd: repoPath });
    return parseInt(output.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

/**
 * Get the repository root URL.
 * Runs `svn info --show-item repos-root-url`.
 */
export function getSvnRepoRootUrl(repoPath: string): string {
  try {
    return svnExec(["info", "--show-item", "repos-root-url"], { cwd: repoPath }).trim();
  } catch {
    return "";
  }
}
