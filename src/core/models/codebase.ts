/**
 * Codebase model
 *
 * Represents a code repository or directory associated with a Workspace.
 * A Workspace can have multiple Codebases (e.g., microservices).
 *
 * Source types:
 *   - "local" (default): repoPath points to a local directory
 *   - "github": repoPath points to extracted temp dir, sourceUrl has the GitHub origin
 *   - "svn": repoPath points to an SVN working copy
 *   - "none": repoPath points to a plain directory without VCS
 *
 * VCS types (auto-detected from directory contents):
 *   - "git": directory contains .git/
 *   - "svn": directory contains .svn/
 *   - "none": plain directory, no VCS metadata
 */

export type CodebaseSourceType = "local" | "github" | "svn" | "none";

/** Actual version control system detected in the directory. */
export type VcsType = "git" | "svn" | "none";

export interface Codebase {
  id: string;
  workspaceId: string;
  repoPath: string;
  branch?: string;
  label?: string;
  isDefault: boolean;
  /** Where the codebase comes from. Defaults to "local" for backward compat. */
  sourceType?: CodebaseSourceType;
  /** Original URL for non-local sources (e.g. "https://github.com/owner/repo") */
  sourceUrl?: string;
  /** Auto-detected VCS type. Defaults to "git" for backward compat when undefined. */
  vcsType?: VcsType;
  createdAt: Date;
  updatedAt: Date;
}

export function createCodebase(params: {
  id: string;
  workspaceId: string;
  repoPath: string;
  branch?: string;
  label?: string;
  isDefault?: boolean;
  sourceType?: CodebaseSourceType;
  sourceUrl?: string;
  vcsType?: VcsType;
}): Codebase {
  const now = new Date();
  return {
    id: params.id,
    workspaceId: params.workspaceId,
    repoPath: params.repoPath,
    branch: params.branch,
    label: params.label,
    isDefault: params.isDefault ?? false,
    sourceType: params.sourceType,
    sourceUrl: params.sourceUrl,
    vcsType: params.vcsType,
    createdAt: now,
    updatedAt: now,
  };
}
