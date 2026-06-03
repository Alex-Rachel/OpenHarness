/**
 * VCS Log — shared types for the unified log viewer.
 *
 * These types are decoupled from Git/SVN specifics so the panel
 * can be backed by any VcsLogAdapter implementation.
 */

import type { VcsLogEntry, VcsCommitDetail } from "@/core/vcs/vcs-unified-types";

// ─── Adapter Interface ─────────────────────────────────────────────

export interface VcsLogQuery {
  repoPath: string;
  /** Text / hash / revision search */
  search?: string;
  /** Number of entries to return per page */
  limit?: number;
  /** Offset for pagination (skip N entries) */
  skip?: number;
  /** Branch filter (Git-only, ignored for SVN) */
  branches?: string[];
}

export interface VcsLogPage {
  commits: VcsLogEntry[];
  total: number;
  hasMore: boolean;
}

export interface VcsLogAdapter {
  /** Fetch a page of log entries */
  getLog(query: VcsLogQuery): Promise<VcsLogPage>;

  /** Fetch detail (changed files + diff) for a single commit/revision */
  getCommitDetail(repoPath: string, id: string): Promise<VcsCommitDetail>;
}

// ─── Component Props ───────────────────────────────────────────────

export interface VcsLogPanelProps {
  /** VCS log adapter — Git or SVN implementation */
  adapter: VcsLogAdapter;
  /** Repository working copy path */
  repoPath: string;
  /** Available codebases (for repo picker) */
  codebases?: Array<{
    id: string;
    repoPath: string;
    label?: string;
    vcsType?: string | null;
  }>;
  /** Callback when user picks a different repo */
  onSelectRepoPath?: (path: string) => void;
  /** Panel title */
  title?: string;
  /** VCS type — used to switch between Git graph and SVN flat list */
  vcsType?: "git" | "svn" | "none";
  /** Additional CSS class */
  className?: string;
}
