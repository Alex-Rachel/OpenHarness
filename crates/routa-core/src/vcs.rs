//! VCS Detection & Capabilities — version control abstraction.
//!
//! Provides:
//!   - VCS type detection from directory contents (no CLI invocation)
//!   - Capability sets per VCS type for feature gating

use std::collections::HashSet;
use std::path::Path;

// ─── VCS Type ──────────────────────────────────────────────────────

/// Supported version control system types.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VcsType {
    Git,
    Svn,
    None,
}

impl std::fmt::Display for VcsType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            VcsType::Git => write!(f, "git"),
            VcsType::Svn => write!(f, "svn"),
            VcsType::None => write!(f, "none"),
        }
    }
}

impl Default for VcsType {
    fn default() -> Self {
        VcsType::Git
    }
}

// ─── VCS Capability ────────────────────────────────────────────────

/// Capabilities a VCS can provide. Used by API and UI for feature gating.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum VcsCapability {
    FileBrowse,
    FileEdit,
    Diff,
    CommitHistory,
    StageUnstage,
    Commit,
    BranchManagement,
    PullUpdate,
    Push,
    Rebase,
    Reset,
    Worktree,
    Blame,
    LogGraph,
    RemoteAuth,
}

impl std::fmt::Display for VcsCapability {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            VcsCapability::FileBrowse => "fileBrowse",
            VcsCapability::FileEdit => "fileEdit",
            VcsCapability::Diff => "diff",
            VcsCapability::CommitHistory => "commitHistory",
            VcsCapability::StageUnstage => "stageUnstage",
            VcsCapability::Commit => "commit",
            VcsCapability::BranchManagement => "branchManagement",
            VcsCapability::PullUpdate => "pullUpdate",
            VcsCapability::Push => "push",
            VcsCapability::Rebase => "rebase",
            VcsCapability::Reset => "reset",
            VcsCapability::Worktree => "worktree",
            VcsCapability::Blame => "blame",
            VcsCapability::LogGraph => "logGraph",
            VcsCapability::RemoteAuth => "remoteAuth",
        };
        write!(f, "{s}")
    }
}

/// Get the set of VCS capabilities for a given VCS type.
/// Defaults to Git capabilities for backward compatibility.
pub fn get_vcs_capabilities(vcs_type: Option<VcsType>) -> HashSet<VcsCapability> {
    match vcs_type.unwrap_or(VcsType::Git) {
        VcsType::Git => [
            VcsCapability::FileBrowse, VcsCapability::FileEdit, VcsCapability::Diff,
            VcsCapability::CommitHistory, VcsCapability::StageUnstage, VcsCapability::Commit,
            VcsCapability::BranchManagement, VcsCapability::PullUpdate, VcsCapability::Push,
            VcsCapability::Rebase, VcsCapability::Reset, VcsCapability::Worktree,
            VcsCapability::Blame, VcsCapability::LogGraph, VcsCapability::RemoteAuth,
        ].into_iter().collect(),
        VcsType::Svn => [
            VcsCapability::FileBrowse, VcsCapability::FileEdit, VcsCapability::Diff,
            VcsCapability::CommitHistory, VcsCapability::Commit,
            VcsCapability::PullUpdate, VcsCapability::Push,
            VcsCapability::Blame, VcsCapability::RemoteAuth,
        ].into_iter().collect(),
        VcsType::None => [
            VcsCapability::FileBrowse, VcsCapability::FileEdit,
        ].into_iter().collect(),
    }
}

/// Check if a specific capability is supported for a given VCS type.
pub fn has_vcs_capability(vcs_type: Option<VcsType>, capability: VcsCapability) -> bool {
    get_vcs_capabilities(vcs_type).contains(&capability)
}

// ─── VCS Detection ─────────────────────────────────────────────────

/// Detect the VCS type of a directory by checking for metadata subdirectories.
///
/// Detection order: .git/ → .svn/ → "none"
/// Git takes priority when both directories are present.
///
/// Returns `None` if the path does not exist or is not a directory.
pub fn detect_vcs_type(dir: &Path) -> Option<VcsType> {
    if !dir.exists() || !dir.is_dir() {
        return None;
    }

    // Git takes priority
    if dir.join(".git").exists() {
        return Some(VcsType::Git);
    }

    // SVN working copy
    if dir.join(".svn").exists() {
        return Some(VcsType::Svn);
    }

    // Valid directory without VCS metadata
    Some(VcsType::None)
}

/// Resolve a VcsType, defaulting to Git for backward compatibility.
/// Use this when reading from a Codebase record where vcs_type may be null.
pub fn resolve_vcs_type(vcs_type: Option<&str>) -> VcsType {
    match vcs_type {
        Some("git") => VcsType::Git,
        Some("svn") => VcsType::Svn,
        Some("none") => VcsType::None,
        _ => VcsType::Git,
    }
}

// ─── Tests ─────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detect_git_directory() {
        let temp = tempfile::tempdir().unwrap();
        std::fs::create_dir(temp.path().join(".git")).unwrap();
        assert_eq!(detect_vcs_type(temp.path()), Some(VcsType::Git));
    }

    #[test]
    fn detect_svn_directory() {
        let temp = tempfile::tempdir().unwrap();
        std::fs::create_dir(temp.path().join(".svn")).unwrap();
        assert_eq!(detect_vcs_type(temp.path()), Some(VcsType::Svn));
    }

    #[test]
    fn detect_plain_directory() {
        let temp = tempfile::tempdir().unwrap();
        assert_eq!(detect_vcs_type(temp.path()), Some(VcsType::None));
    }

    #[test]
    fn git_takes_priority_over_svn() {
        let temp = tempfile::tempdir().unwrap();
        std::fs::create_dir(temp.path().join(".git")).unwrap();
        std::fs::create_dir(temp.path().join(".svn")).unwrap();
        assert_eq!(detect_vcs_type(temp.path()), Some(VcsType::Git));
    }

    #[test]
    fn nonexistent_path_returns_none() {
        assert_eq!(detect_vcs_type(Path::new("/nonexistent/path123")), None);
    }

    #[test]
    fn resolve_defaults_to_git() {
        assert_eq!(resolve_vcs_type(None), VcsType::Git);
        assert_eq!(resolve_vcs_type(Some("unknown")), VcsType::Git);
    }

    #[test]
    fn git_has_all_capabilities() {
        let caps = get_vcs_capabilities(Some(VcsType::Git));
        assert_eq!(caps.len(), 15);
    }

    #[test]
    fn svn_has_partial_capabilities() {
        let caps = get_vcs_capabilities(Some(VcsType::Svn));
        assert!(caps.contains(&VcsCapability::Commit));
        assert!(caps.contains(&VcsCapability::Diff));
        assert!(!caps.contains(&VcsCapability::StageUnstage));
        assert!(!caps.contains(&VcsCapability::BranchManagement));
        assert!(!caps.contains(&VcsCapability::Worktree));
        assert_eq!(caps.len(), 9);
    }

    #[test]
    fn none_has_minimal_capabilities() {
        let caps = get_vcs_capabilities(Some(VcsType::None));
        assert!(caps.contains(&VcsCapability::FileBrowse));
        assert!(caps.contains(&VcsCapability::FileEdit));
        assert!(!caps.contains(&VcsCapability::Commit));
        assert_eq!(caps.len(), 2);
    }
}
