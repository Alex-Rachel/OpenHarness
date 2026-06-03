/**
 * VCS Types — shared type definitions for version control system abstraction.
 *
 * Defines VcsType (the kind of VCS detected in a directory),
 * VcsCapability (the operations each VCS supports), and type guards.
 */

/** Supported version control system types. */
export type VcsType = "git" | "svn" | "none";

/**
 * Capabilities a VCS can provide.
 * Used by UI and API layers to gate feature availability.
 */
export type VcsCapability =
  | "fileBrowse"       // List and read files
  | "fileEdit"         // Create, modify, delete files
  | "diff"             // Show changes between working copy and base
  | "commitHistory"    // View commit/log history
  | "stageUnstage"     // Stage/unstage changes (Git staging area)
  | "commit"           // Commit changes
  | "branchManagement" // Create/switch/delete branches
  | "pullUpdate"       // Pull (Git) or update (SVN) from remote
  | "push"             // Push to remote
  | "rebase"           // Rebase commits
  | "reset"            // Reset to previous state
  | "worktree"         // Worktree isolation for parallel agents
  | "blame"            // Line-level authorship (annotate/blame)
  | "logGraph"         // Graph-style commit log visualization
  | "remoteAuth"       // Remote repository authentication
  | "info"             // Repository metadata (svn info / git log -1)
  | "add";             // Add files to version control (svn add / git add)

/** Type guard for VcsType */
export function isVcsType(value: string): value is VcsType {
  return value === "git" || value === "svn" || value === "none";
}

/** Type guard for VcsCapability */
export function isVcsCapability(value: string): value is VcsCapability {
  return [
    "fileBrowse", "fileEdit", "diff", "commitHistory", "stageUnstage",
    "commit", "branchManagement", "pullUpdate", "push", "rebase",
    "reset", "worktree", "blame", "logGraph", "remoteAuth",
    "info", "add",
  ].includes(value);
}
