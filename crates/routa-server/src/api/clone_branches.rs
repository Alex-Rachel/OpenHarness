//! Branch Management API - /api/clone/branches
//!
//! GET   /api/clone/branches?repoPath=... - Get branch info
//! POST  /api/clone/branches - Fetch remote branches then return all
//! PATCH /api/clone/branches - Checkout a branch
//! DELETE /api/clone/branches - Delete a local branch
//!
//! Supports both Git and SVN repositories.

use std::path::Path;
use axum::{extract::Query, routing::get, Json, Router};
use serde::Deserialize;

use crate::api::repo_context::resolve_repo_dir_or_error;
use crate::error::ServerError;
use crate::git;
use crate::state::AppState;
use crate::svn;
use crate::vcs::{self, VcsType};

pub fn router() -> Router<AppState> {
    Router::new().route(
        "/",
        get(get_branches)
            .post(fetch_branches)
            .patch(checkout)
            .delete(delete_branch),
    )
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BranchQuery {
    repo_path: Option<String>,
}

/// Detect the VCS type of the resolved repo path.
fn detect_vcs(repo_path: &str) -> VcsType {
    vcs::detect_vcs_type(Path::new(repo_path)).unwrap_or(VcsType::Git)
}

// ─── GET ──────────────────────────────────────────────────────────────

async fn get_branches(
    Query(query): Query<BranchQuery>,
) -> Result<Json<serde_json::Value>, ServerError> {
    let repo_path = query
        .repo_path
        .ok_or_else(|| ServerError::BadRequest("Missing repoPath".into()))?;
    let repo_path = resolve_repo_dir_or_error(&repo_path, "repoPath ")?
        .to_string_lossy()
        .to_string();

    let vcs_type = detect_vcs(&repo_path);

    match vcs_type {
        VcsType::Svn => get_branches_svn(&repo_path).await,
        _ => get_branches_git(&repo_path).await,
    }
}

async fn get_branches_git(repo_path: &str) -> Result<Json<serde_json::Value>, ServerError> {
    let (current, local, remote, status) = tokio::task::spawn_blocking({
        let rp = repo_path.to_string();
        move || {
            let current = git::get_current_branch(&rp).unwrap_or_else(|| "unknown".into());
            let local = git::list_local_branches(&rp);
            let remote = git::list_remote_branches(&rp);
            let status = git::get_branch_status(&rp, &current);
            (current, local, remote, status)
        }
    })
    .await
    .map_err(|e| ServerError::Internal(e.to_string()))?;

    Ok(Json(serde_json::json!({
        "current": current,
        "local": local,
        "remote": remote,
        "status": status,
    })))
}

async fn get_branches_svn(repo_path: &str) -> Result<Json<serde_json::Value>, ServerError> {
    let rp = repo_path.to_string();
    let (current, branches, has_changes) = tokio::task::spawn_blocking(move || {
        let current = svn::get_svn_current_branch(&rp).unwrap_or_else(|| "unknown".into());
        let branches = svn::list_svn_branches(&rp);
        let status = svn::get_svn_branch_status(&rp);
        (current, branches, status.has_uncommitted_changes)
    })
    .await
    .map_err(|e| ServerError::Internal(e.to_string()))?;

    Ok(Json(serde_json::json!({
        "current": current,
        "local": [],
        "remote": branches,
        "status": {
            "ahead": 0,
            "behind": 0,
            "hasUncommittedChanges": has_changes,
        },
    })))
}

// ─── POST (fetch) ─────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FetchBranchesBody {
    repo_path: Option<String>,
}

async fn fetch_branches(
    Json(body): Json<FetchBranchesBody>,
) -> Result<Json<serde_json::Value>, ServerError> {
    let repo_path = body
        .repo_path
        .ok_or_else(|| ServerError::BadRequest("Missing repoPath".into()))?;
    let repo_path = resolve_repo_dir_or_error(&repo_path, "repoPath ")?
        .to_string_lossy()
        .to_string();

    let vcs_type = detect_vcs(&repo_path);

    match vcs_type {
        VcsType::Svn => fetch_branches_svn(&repo_path).await,
        _ => fetch_branches_git(&repo_path).await,
    }
}

async fn fetch_branches_git(repo_path: &str) -> Result<Json<serde_json::Value>, ServerError> {
    let (current, local, remote, status) = tokio::task::spawn_blocking({
        let rp = repo_path.to_string();
        move || {
            git::fetch_remote(&rp);
            let current = git::get_current_branch(&rp).unwrap_or_else(|| "unknown".into());
            let local = git::list_local_branches(&rp);
            let remote = git::list_remote_branches(&rp);
            let status = git::get_branch_status(&rp, &current);
            (current, local, remote, status)
        }
    })
    .await
    .map_err(|e| ServerError::Internal(e.to_string()))?;

    Ok(Json(serde_json::json!({
        "current": current,
        "local": local,
        "remote": remote,
        "status": status,
    })))
}

async fn fetch_branches_svn(repo_path: &str) -> Result<Json<serde_json::Value>, ServerError> {
    let rp = repo_path.to_string();
    let (current, branches, has_changes) = tokio::task::spawn_blocking(move || {
        // SVN: run update first (equivalent of git fetch + merge)
        svn::svn_update(&rp);
        let current = svn::get_svn_current_branch(&rp).unwrap_or_else(|| "unknown".into());
        let branches = svn::list_svn_branches(&rp);
        let status = svn::get_svn_branch_status(&rp);
        (current, branches, status.has_uncommitted_changes)
    })
    .await
    .map_err(|e| ServerError::Internal(e.to_string()))?;

    Ok(Json(serde_json::json!({
        "current": current,
        "local": [],
        "remote": branches,
        "status": {
            "ahead": 0,
            "behind": 0,
            "hasUncommittedChanges": has_changes,
        },
    })))
}

// ─── PATCH (checkout / reset) ─────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CheckoutBody {
    repo_path: Option<String>,
    branch: Option<String>,
    pull: Option<bool>,
    action: Option<String>,
}

async fn checkout(Json(body): Json<CheckoutBody>) -> Result<Json<serde_json::Value>, ServerError> {
    let repo_path = body
        .repo_path
        .ok_or_else(|| ServerError::BadRequest("Missing repoPath".into()))?;
    let repo_path = resolve_repo_dir_or_error(&repo_path, "repoPath ")?
        .to_string_lossy()
        .to_string();

    let vcs_type = detect_vcs(&repo_path);

    if body.action.as_deref() == Some("reset") {
        return match vcs_type {
            VcsType::Svn => reset_svn(&repo_path).await,
            _ => reset_git(&repo_path).await,
        };
    }

    let branch = body
        .branch
        .ok_or_else(|| ServerError::BadRequest("Missing branch".into()))?;
    let do_pull = body.pull.unwrap_or(false);

    match vcs_type {
        VcsType::Svn => checkout_svn(&repo_path, &branch, do_pull).await,
        _ => checkout_git(&repo_path, &branch, do_pull).await,
    }
}

async fn reset_git(repo_path: &str) -> Result<Json<serde_json::Value>, ServerError> {
    let (branch_info, status, repo_status) = tokio::task::spawn_blocking({
        let rp = repo_path.to_string();
        move || {
            git::reset_local_changes(&rp).map_err(ServerError::Internal)?;
            let branch_info = git::get_branch_info(&rp);
            let status = git::get_branch_status(&rp, &branch_info.current);
            let repo_status = git::get_repo_status(&rp);
            Ok::<_, ServerError>((branch_info, status, repo_status))
        }
    })
    .await
    .map_err(|e| ServerError::Internal(e.to_string()))??;

    Ok(Json(serde_json::json!({
        "success": true,
        "action": "reset",
        "branch": branch_info.current,
        "branches": branch_info.branches,
        "status": status,
        "repoStatus": repo_status,
    })))
}

async fn reset_svn(repo_path: &str) -> Result<Json<serde_json::Value>, ServerError> {
    let rp = repo_path.to_string();
    let result = tokio::task::spawn_blocking(move || -> Result<_, ServerError> {
        svn::svn_revert(&rp, &[]).map_err(ServerError::Internal)?;
        let current = svn::get_svn_current_branch(&rp).unwrap_or_else(|| "unknown".into());
        let status = svn::get_svn_branch_status(&rp);
        Ok((current, status.has_uncommitted_changes))
    })
    .await
    .map_err(|e| ServerError::Internal(e.to_string()))??;

    Ok(Json(serde_json::json!({
        "success": true,
        "action": "reset",
        "branch": result.0,
        "branches": [],
        "status": {
            "ahead": 0,
            "behind": 0,
            "hasUncommittedChanges": result.1,
        },
        "repoStatus": { "modified": 0, "untracked": 0 },
    })))
}

async fn checkout_git(
    repo_path: &str,
    branch: &str,
    do_pull: bool,
) -> Result<Json<serde_json::Value>, ServerError> {
    let (success, info, status) = tokio::task::spawn_blocking({
        let rp = repo_path.to_string();
        let br = branch.to_string();
        move || {
            let ok = git::checkout_branch(&rp, &br);
            if ok && do_pull {
                let _ = git::pull_branch(&rp);
            }
            let info = git::get_branch_info(&rp);
            let status = git::get_branch_status(&rp, &info.current);
            (ok, info, status)
        }
    })
    .await
    .map_err(|e| ServerError::Internal(e.to_string()))?;

    if !success {
        return Err(ServerError::Internal(format!(
            "Failed to checkout branch '{branch}'"
        )));
    }

    Ok(Json(serde_json::json!({
        "success": true,
        "branch": info.current,
        "branches": info.branches,
        "status": status,
    })))
}

async fn checkout_svn(
    repo_path: &str,
    branch: &str,
    do_pull: bool,
) -> Result<Json<serde_json::Value>, ServerError> {
    let rp = repo_path.to_string();
    let br = branch.to_string();
    let result = tokio::task::spawn_blocking(move || -> Result<_, String> {
        svn::svn_switch_branch(&rp, &br)?;
        if do_pull {
            svn::svn_update(&rp);
        }
        let current = svn::get_svn_current_branch(&rp).unwrap_or_else(|| "unknown".into());
        let branches = svn::list_svn_branches(&rp);
        let status = svn::get_svn_branch_status(&rp);
        Ok((current, branches, status.has_uncommitted_changes))
    })
    .await
    .map_err(|e| ServerError::Internal(e.to_string()))?
    .map_err(ServerError::Internal)?;

    Ok(Json(serde_json::json!({
        "success": true,
        "branch": result.0,
        "branches": result.1,
        "status": {
            "ahead": 0,
            "behind": 0,
            "hasUncommittedChanges": result.2,
        },
    })))
}

// ─── DELETE ───────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeleteBranchBody {
    repo_path: Option<String>,
    branch: Option<String>,
}

async fn delete_branch(
    Json(body): Json<DeleteBranchBody>,
) -> Result<Json<serde_json::Value>, ServerError> {
    let repo_path = body
        .repo_path
        .ok_or_else(|| ServerError::BadRequest("Missing repoPath".into()))?;
    let branch = body
        .branch
        .ok_or_else(|| ServerError::BadRequest("Missing branch".into()))?;
    let repo_path = resolve_repo_dir_or_error(&repo_path, "repoPath ")?
        .to_string_lossy()
        .to_string();

    let vcs_type = detect_vcs(&repo_path);

    // Branch deletion is a Git-only operation
    if vcs_type == VcsType::Svn {
        return Err(ServerError::BadRequest(
            "Branch deletion is not supported for SVN repositories".into(),
        ));
    }

    let branch_info = tokio::task::spawn_blocking({
        let rp = repo_path.to_string();
        let br = branch.clone();
        move || {
            git::delete_branch(&rp, &br)?;
            Ok::<_, String>(git::get_branch_info(&rp))
        }
    })
    .await
    .map_err(|e| ServerError::Internal(e.to_string()))?
    .map_err(|message| {
        if message.contains("current branch") {
            ServerError::Conflict(message)
        } else if message.contains("not found") {
            ServerError::NotFound(message)
        } else {
            ServerError::Internal(message)
        }
    })?;

    Ok(Json(serde_json::json!({
        "success": true,
        "deletedBranch": branch,
        "current": branch_info.current,
        "branches": branch_info.branches,
    })))
}
