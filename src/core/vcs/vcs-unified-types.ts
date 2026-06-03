/**
 * VCS Unified Types — cross-VCS data structures for the unified API and UI layers.
 *
 * These types normalize Git and SVN data into a common shape so that
 * API routes and UI components can operate without knowing the underlying VCS.
 * VCS-specific fields (e.g. Git refs, graph edges) are optional.
 */

// ─── Log Entries ───────────────────────────────────────────────────

/** A single log entry — works for both Git commits and SVN revisions. */
export interface VcsLogEntry {
  /** Unique identifier: SHA (Git) or "r<N>" (SVN) */
  id: string;
  /** Short display identifier: short SHA (Git) or "r<N>" (SVN) */
  shortId: string;
  author: string;
  authorEmail?: string;
  /** ISO 8601 date string */
  date: string;
  message: string;
  summary: string;
  /** Parent identifiers: SHA[] (Git) or ["r<N>"] (SVN) */
  parents?: string[];

  // Git-specific (optional)
  refs?: VcsRef[];
  graphEdges?: VcsGraphEdge[];
}

export interface VcsRef {
  name: string;
  remote?: string;
  kind: "head" | "local" | "remote" | "tag";
  commitId: string;
  isCurrent?: boolean;
}

export interface VcsGraphEdge {
  fromLane: number;
  toLane: number;
  isMerge?: boolean;
}

// ─── Commit Detail ─────────────────────────────────────────────────

/** Detailed view of a single commit/revision. */
export interface VcsCommitDetail {
  id: string;
  shortId: string;
  author: string;
  authorEmail?: string;
  date: string;
  message: string;
  /** Files changed in this commit/revision */
  files: VcsFileChange[];
  /** Full unified diff patch (optional — may be lazily loaded) */
  patch?: string;
}

export type VcsFileChangeStatus =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied";

export interface VcsFileChange {
  path: string;
  previousPath?: string;
  status: VcsFileChangeStatus;
  additions?: number;
  deletions?: number;
}

// ─── Status ────────────────────────────────────────────────────────

export type VcsStatusCode =
  | "modified"
  | "added"
  | "deleted"
  | "untracked"
  | "missing"
  | "conflicted"
  | "renamed"
  | "copied"
  | "typechange";

export interface VcsStatusEntry {
  path: string;
  status: VcsStatusCode;
  /** Original status code from VCS (e.g. "M", "?", "D") */
  rawCode?: string;
}

export interface VcsStatus {
  modified: VcsStatusEntry[];
  added: VcsStatusEntry[];
  deleted: VcsStatusEntry[];
  untracked: VcsStatusEntry[];
  missing: VcsStatusEntry[];
  conflicted: VcsStatusEntry[];
  /** Git-only: staged changes */
  staged?: VcsStatusEntry[];
}

// ─── Info ──────────────────────────────────────────────────────────

/** Repository metadata — returned by /vcs/info */
export interface VcsRepoInfo {
  vcsType: "git" | "svn" | "none";
  /** SVN: repository root URL. Git: remote origin URL */
  repoUrl?: string;
  /** SVN: current working copy revision */
  revision?: number;
  /** SVN: last changed author */
  lastChangedAuthor?: string;
  /** SVN: last changed date (ISO 8601) */
  lastChangedDate?: string;
  /** SVN: last changed revision */
  lastChangedRevision?: number;
  /** Git: current branch */
  branch?: string;
  /** Git: last commit info */
  lastCommit?: {
    sha: string;
    author: string;
    date: string;
    message: string;
  };
}

// ─── Blame ─────────────────────────────────────────────────────────

export interface VcsBlameLine {
  lineNumber: number;
  /** Revision or SHA */
  revision: string;
  author: string;
  content: string;
}

// ─── Log Query / Page ──────────────────────────────────────────────

export interface VcsLogQuery {
  repoPath: string;
  /** Filter by branches (Git-only, ignored for SVN) */
  branches?: string[];
  /** Text search */
  search?: string;
  limit?: number;
  skip?: number;
}

export interface VcsLogPage {
  commits: VcsLogEntry[];
  total: number;
  hasMore: boolean;
}
