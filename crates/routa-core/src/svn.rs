//! SVN utilities for working copy management.
//! Mirrors the git.rs module structure for consistency.

use serde::{Deserialize, Serialize};
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::process::Command;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

// ─── Encoding ──────────────────────────────────────────────────────

/// Decode SVN CLI output bytes to a Rust String.
///
/// On Windows with CJK locale, SVN outputs in the system codepage (e.g. GBK/CP936).
/// We try UTF-8 first; if that fails we fall back to GBK via `encoding_rs`.
fn decode_svn_output(raw: &[u8]) -> String {
    // Try strict UTF-8 first (works on Unix and Windows UTF-8 locales)
    if let Ok(s) = String::from_utf8(raw.to_vec()) {
        return s;
    }
    // Fall back to GBK (Chinese Windows codepage 936)
    let (cow, _encoding_used, _had_errors) = encoding_rs::GBK.decode(raw);
    cow.into_owned()
}

// ─── Command Builders ──────────────────────────────────────────────

pub fn svn_command() -> Command {
    #[cfg(windows)]
    {
        let mut command = Command::new("svn");
        command.creation_flags(CREATE_NO_WINDOW);
        command
    }
    #[cfg(not(windows))]
    {
        Command::new("svn")
    }
}

pub fn svn_tokio_command() -> tokio::process::Command {
    #[cfg(windows)]
    {
        let mut command = tokio::process::Command::new("svn");
        command.creation_flags(CREATE_NO_WINDOW);
        command
    }
    #[cfg(not(windows))]
    {
        tokio::process::Command::new("svn")
    }
}

// ─── Types ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SvnStatusEntry {
    pub path: String,
    pub status_code: String,
    pub property_status_code: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SvnStatus {
    pub modified: Vec<SvnStatusEntry>,
    pub added: Vec<SvnStatusEntry>,
    pub deleted: Vec<SvnStatusEntry>,
    pub untracked: Vec<SvnStatusEntry>,
    pub missing: Vec<SvnStatusEntry>,
    pub conflicted: Vec<SvnStatusEntry>,
    pub all: Vec<SvnStatusEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SvnLogEntry {
    pub revision: u64,
    pub author: String,
    pub date: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SvnBlameLine {
    pub line_number: usize,
    pub revision: u64,
    pub author: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SvnUpdateResult {
    pub revision: u64,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SvnLogChangedFile {
    /// Action: "A" (added), "M" (modified), "D" (deleted), "R" (replaced)
    pub action: String,
    /// File path
    pub path: String,
    /// Copy-from path (for copies/moves)
    pub copy_from_path: Option<String>,
    /// Copy-from revision (for copies/moves)
    pub copy_from_revision: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SvnLogVerboseEntry {
    pub revision: u64,
    pub author: String,
    pub date: String,
    pub message: String,
    pub files: Vec<SvnLogChangedFile>,
}

// ─── Availability ──────────────────────────────────────────────────

pub fn is_svn_available() -> bool {
    svn_command()
        .arg("--version")
        .arg("--quiet")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

// ─── Status ────────────────────────────────────────────────────────

pub fn get_svn_status(repo_path: &str) -> SvnStatus {
    let output = match svn_command()
        .arg("status")
        .current_dir(repo_path)
        .output()
    {
        Ok(o) => decode_svn_output(&o.stdout),
        Err(_) => return empty_status(),
    };

    let entries = parse_svn_status(&output);
    SvnStatus {
        modified: entries.iter().filter(|e| e.status_code == "M").cloned().collect(),
        added: entries.iter().filter(|e| e.status_code == "A").cloned().collect(),
        deleted: entries.iter().filter(|e| e.status_code == "D").cloned().collect(),
        untracked: entries.iter().filter(|e| e.status_code == "?").cloned().collect(),
        missing: entries.iter().filter(|e| e.status_code == "!").cloned().collect(),
        conflicted: entries.iter().filter(|e| e.status_code == "C").cloned().collect(),
        all: entries,
    }
}

fn parse_svn_status(output: &str) -> Vec<SvnStatusEntry> {
    if output.trim().is_empty() {
        return Vec::new();
    }

    output
        .lines()
        .filter(|line| !line.is_empty())
        .map(|line| {
            let status_code = line.chars().next().unwrap_or(' ').to_string();
            let property_status_code = line.chars().nth(1).unwrap_or(' ').to_string();
            let path = if line.len() > 8 {
                line[8..].trim().to_string()
            } else {
                line.trim().to_string()
            };
            SvnStatusEntry {
                path,
                status_code,
                property_status_code,
            }
        })
        .filter(|e| !e.path.is_empty())
        .collect()
}

fn empty_status() -> SvnStatus {
    SvnStatus {
        modified: Vec::new(),
        added: Vec::new(),
        deleted: Vec::new(),
        untracked: Vec::new(),
        missing: Vec::new(),
        conflicted: Vec::new(),
        all: Vec::new(),
    }
}

// ─── Diff ──────────────────────────────────────────────────────────

pub fn get_svn_diff(repo_path: &str) -> String {
    svn_command()
        .arg("diff")
        .current_dir(repo_path)
        .output()
        .map(|o| decode_svn_output(&o.stdout))
        .unwrap_or_default()
}

pub fn get_svn_file_diff(repo_path: &str, file_path: &str) -> String {
    svn_command()
        .arg("diff")
        .arg(file_path)
        .current_dir(repo_path)
        .output()
        .map(|o| decode_svn_output(&o.stdout))
        .unwrap_or_default()
}

/// Get the diff introduced by a specific revision.
/// Runs `svn diff -c <revision>`.
pub fn get_svn_revision_diff(repo_path: &str, revision: u64) -> String {
    svn_command()
        .arg("diff")
        .arg("-c")
        .arg(revision.to_string())
        .current_dir(repo_path)
        .output()
        .map(|o| decode_svn_output(&o.stdout))
        .unwrap_or_default()
}

// ─── Commit ────────────────────────────────────────────────────────

pub fn svn_commit(repo_path: &str, file_paths: &[String], message: &str) -> Result<u64, String> {
    if file_paths.is_empty() {
        return Err("At least one file must be specified for SVN commit".to_string());
    }

    let mut cmd = svn_command();
    cmd.arg("commit");
    for path in file_paths {
        cmd.arg(path);
    }
    cmd.arg("-m").arg(message).current_dir(repo_path);

    let output = cmd.output().map_err(|e| format!("SVN commit failed: {e}"))?;
    if !output.status.success() {
        let stderr = decode_svn_output(&output.stderr);
        return Err(format!("SVN commit failed: {stderr}"));
    }

    let stdout = decode_svn_output(&output.stdout);
    let revision = parse_revision_from_commit(&stdout)?;
    Ok(revision)
}

fn parse_revision_from_commit(output: &str) -> Result<u64, String> {
    // "Committed revision 42."
    for line in output.lines() {
        if let Some(rest) = line.strip_prefix("Committed revision ") {
            if let Some(num_str) = rest.strip_suffix('.') {
                if let Ok(rev) = num_str.trim().parse::<u64>() {
                    return Ok(rev);
                }
            }
        }
    }
    Err(format!("Could not parse revision from SVN commit output: {output}"))
}

// ─── Update ────────────────────────────────────────────────────────

pub fn svn_update(repo_path: &str) -> SvnUpdateResult {
    let output = svn_command()
        .arg("update")
        .current_dir(repo_path)
        .output();

    match output {
        Ok(o) => {
            let stdout = decode_svn_output(&o.stdout);
            let revision = parse_revision_from_update(&stdout);
            SvnUpdateResult {
                revision,
                summary: stdout.trim().to_string(),
            }
        }
        Err(_) => SvnUpdateResult {
            revision: 0,
            summary: String::new(),
        },
    }
}

fn parse_revision_from_update(output: &str) -> u64 {
    // "Updated to revision 42." or "At revision 42."
    for line in output.lines() {
        if let Some(rest) = line.strip_prefix("Updated to revision ") {
            if let Some(num_str) = rest.strip_suffix('.') {
                if let Ok(rev) = num_str.trim().parse::<u64>() {
                    return rev;
                }
            }
        }
        if let Some(rest) = line.strip_prefix("At revision ") {
            if let Some(num_str) = rest.strip_suffix('.') {
                if let Ok(rev) = num_str.trim().parse::<u64>() {
                    return rev;
                }
            }
        }
    }
    0
}

// ─── Log ───────────────────────────────────────────────────────────

pub fn get_svn_log(repo_path: &str, limit: usize) -> Vec<SvnLogEntry> {
    let output = svn_command()
        .arg("log")
        .arg("-l")
        .arg(limit.to_string())
        .current_dir(repo_path)
        .output();

    match output {
        Ok(o) => parse_svn_log(&decode_svn_output(&o.stdout)),
        Err(_) => Vec::new(),
    }
}

pub fn get_svn_file_log(repo_path: &str, file_path: &str, limit: usize) -> Vec<SvnLogEntry> {
    let output = svn_command()
        .arg("log")
        .arg("-l")
        .arg(limit.to_string())
        .arg(file_path)
        .current_dir(repo_path)
        .output();

    match output {
        Ok(o) => parse_svn_log(&decode_svn_output(&o.stdout)),
        Err(_) => Vec::new(),
    }
}

/// Get verbose SVN log for a specific revision.
/// Runs `svn log -v -r <revision>` and returns file change information.
pub fn get_svn_log_verbose_by_revision(
    repo_path: &str,
    revision: &str,
) -> Vec<SvnLogVerboseEntry> {
    let output = svn_command()
        .arg("log")
        .arg("-v")
        .arg("-r")
        .arg(revision)
        .current_dir(repo_path)
        .output();

    match output {
        Ok(o) => parse_svn_log_verbose(&decode_svn_output(&o.stdout)),
        Err(_) => Vec::new(),
    }
}

fn parse_svn_log(output: &str) -> Vec<SvnLogEntry> {
    if output.trim().is_empty() {
        return Vec::new();
    }

    let separator = "-".repeat(72);
    output
        .split(&separator)
        .filter(|block| !block.trim().is_empty())
        .filter_map(|block| {
            let lines: Vec<&str> = block.trim().lines().collect();
            if lines.is_empty() {
                return None;
            }

            // Parse header: r42 | author | date | N lines
            let header = lines[0];
            let parts: Vec<&str> = header.split('|').collect();
            if parts.len() < 3 {
                return None;
            }

            let revision = parts[0]
                .trim()
                .strip_prefix('r')
                .and_then(|s| s.parse::<u64>().ok())
                .unwrap_or(0);

            let author = parts[1].trim().to_string();
            let date = normalize_svn_date(parts[2].trim());
            let message = lines[1..].join("\n").trim().to_string();

            Some(SvnLogEntry {
                revision,
                author,
                date,
                message,
            })
        })
        .collect()
}

/// Parse verbose `svn log -v` output with file change information.
fn parse_svn_log_verbose(output: &str) -> Vec<SvnLogVerboseEntry> {
    if output.trim().is_empty() {
        return Vec::new();
    }

    let separator = "-".repeat(72);
    output
        .split(&separator)
        .filter(|block| !block.trim().is_empty())
        .filter_map(|block| {
            let lines: Vec<&str> = block.trim().lines().collect();
            if lines.is_empty() {
                return None;
            }

            let header = lines[0];
            let parts: Vec<&str> = header.split('|').collect();
            if parts.len() < 3 {
                return None;
            }

            let revision = parts[0]
                .trim()
                .strip_prefix('r')
                .and_then(|s| s.parse::<u64>().ok())
                .unwrap_or(0);

            let author = parts[1].trim().to_string();
            let date = normalize_svn_date(parts[2].trim());

            // Parse changed paths section
            let mut files: Vec<SvnLogChangedFile> = Vec::new();
            let mut in_changed_paths = false;
            let mut message_start_idx = lines.len();

            for (i, line) in lines.iter().enumerate().skip(1) {
                if line.starts_with("Changed paths:") {
                    in_changed_paths = true;
                    continue;
                }

                if in_changed_paths {
                    // Changed path lines: "   M /trunk/src/foo.ts"
                    // or with copy-from: "   A /trunk/bar (from /trunk/baz:r41)"
                    let trimmed = line.trim_start();
                    if let Some(rest) = trimmed.strip_prefix(|c: char| "AMDR_".contains(c)) {
                        let rest = rest.trim_start();
                        if !rest.is_empty() {
                            // Check for copy-from: "(from /path:rN)"
                            let (path, copy_from) = if let Some(paren) = rest.find(" (from ") {
                                let path_part = rest[..paren].trim().to_string();
                                let from_part = &rest[paren + 7..];
                                let from_part = from_part.trim_end_matches(')');
                                // Split on ":r" to get path and revision
                                if let Some(colon) = from_part.rfind(":r") {
                                    let from_path = from_part[..colon].to_string();
                                    let from_rev = from_part[colon + 2..].to_string();
                                    (path_part, Some((from_path, from_rev)))
                                } else {
                                    (path_part, None)
                                }
                            } else {
                                (rest.to_string(), None)
                            };

                            let action = trimmed.chars().next().unwrap_or('M').to_string();
                            files.push(SvnLogChangedFile {
                                action,
                                path,
                                copy_from_path: copy_from.as_ref().map(|(p, _)| p.clone()),
                                copy_from_revision: copy_from.map(|(_, r)| r),
                            });
                        }
                    } else if line.trim().is_empty() || !line.starts_with(' ') {
                        in_changed_paths = false;
                        message_start_idx = i;
                        break;
                    }
                }
            }

            // Collect message lines
            let mut message_lines: Vec<&str> = Vec::new();
            for line in lines.iter().skip(message_start_idx) {
                if line.trim().is_empty() && !message_lines.is_empty() {
                    break;
                }
                if !line.trim().is_empty() {
                    message_lines.push(line);
                }
            }
            let message = message_lines.join("\n").trim().to_string();

            Some(SvnLogVerboseEntry {
                revision,
                author,
                date,
                message,
                files,
            })
        })
        .collect()
}

/// Normalize SVN date string to ISO 8601 format.
///
/// SVN raw format: "2024-01-15 10:30:00 +0800 (Tue, 15 Jan 2024)"
/// ISO 8601:       "2024-01-15T10:30:00+08:00"
fn normalize_svn_date(raw: &str) -> String {
    // Strip parenthetical timezone name
    let without_parens = raw.split('(').next().unwrap_or(raw).trim();
    // Convert "YYYY-MM-DD HH:MM:SS +HHMM" → "YYYY-MM-DDTHH:MM:SS+HH:MM"
    let re = regex::Regex::new(r"^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$").unwrap();
    if let Some(caps) = re.captures(without_parens) {
        format!(
            "{}T{}{}:{}",
            &caps[1], &caps[2], &caps[3], &caps[4]
        )
    } else {
        without_parens.to_string()
    }
}

// ─── Blame ─────────────────────────────────────────────────────────

pub fn svn_blame(repo_path: &str, file_path: &str) -> Vec<SvnBlameLine> {
    let output = svn_command()
        .arg("blame")
        .arg(file_path)
        .current_dir(repo_path)
        .output();

    match output {
        Ok(o) => parse_svn_blame(&decode_svn_output(&o.stdout)),
        Err(_) => Vec::new(),
    }
}

fn parse_svn_blame(output: &str) -> Vec<SvnBlameLine> {
    if output.trim().is_empty() {
        return Vec::new();
    }

    output
        .lines()
        .enumerate()
        .map(|(index, line)| {
            // SVN blame: <revision> <author> <content>
            let parts: Vec<&str> = line.splitn(3, char::is_whitespace).collect();
            match parts.len() {
                3 => {
                    let revision = parts[0]
                        .trim()
                        .parse::<u64>()
                        .unwrap_or(0);
                    SvnBlameLine {
                        line_number: index + 1,
                        revision,
                        author: parts[1].trim().to_string(),
                        content: parts[2].to_string(),
                    }
                }
                2 => {
                    let revision = parts[0]
                        .trim()
                        .parse::<u64>()
                        .unwrap_or(0);
                    SvnBlameLine {
                        line_number: index + 1,
                        revision,
                        author: parts[1].trim().to_string(),
                        content: String::new(),
                    }
                }
                _ => SvnBlameLine {
                    line_number: index + 1,
                    revision: 0,
                    author: String::new(),
                    content: line.to_string(),
                },
            }
        })
        .collect()
}

// ─── Revert ────────────────────────────────────────────────────────

pub fn svn_revert(repo_path: &str, file_paths: &[String]) -> Result<(), String> {
    let mut cmd = svn_command();
    cmd.arg("revert");
    if file_paths.is_empty() {
        cmd.arg("--recursive").arg(".");
    } else {
        for path in file_paths {
            cmd.arg(path);
        }
    }
    cmd.current_dir(repo_path);

    let output = cmd.output().map_err(|e| format!("SVN revert failed: {e}"))?;
    if !output.status.success() {
        let stderr = decode_svn_output(&output.stderr);
        return Err(format!("SVN revert failed: {stderr}"));
    }
    Ok(())
}

// ─── Add ───────────────────────────────────────────────────────────

pub fn svn_add(repo_path: &str, file_path: &str) -> Result<(), String> {
    let output = svn_command()
        .arg("add")
        .arg(file_path)
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("SVN add failed: {e}"))?;

    if !output.status.success() {
        let stderr = decode_svn_output(&output.stderr);
        return Err(format!("SVN add failed: {stderr}"));
    }
    Ok(())
}

// ─── Info ──────────────────────────────────────────────────────────

pub fn get_svn_revision(repo_path: &str) -> u64 {
    svn_command()
        .arg("info")
        .arg("--show-item")
        .arg("revision")
        .current_dir(repo_path)
        .output()
        .ok()
        .and_then(|o| decode_svn_output(&o.stdout).trim().parse::<u64>().ok())
        .unwrap_or(0)
}

/// Get the SVN repository URL for a working copy.
pub fn get_svn_url(repo_path: &str) -> Option<String> {
    let output = svn_command()
        .arg("info")
        .arg("--show-item")
        .arg("url")
        .current_dir(repo_path)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    Some(decode_svn_output(&output.stdout).trim().to_string())
}

// ─── Branch ────────────────────────────────────────────────────────

/// Status info for SVN (simpler than Git — no ahead/behind tracking).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SvnBranchStatus {
    pub has_uncommitted_changes: bool,
}

/// Get the current branch name from the SVN working copy URL.
///
/// Parses the URL to determine the branch:
/// - `.../trunk` → `"trunk"`
/// - `.../branches/feature-1` → `"feature-1"`
/// - `.../tags/v1.0` → `"v1.0"`
/// - Otherwise returns the last URL path segment.
pub fn get_svn_current_branch(repo_path: &str) -> Option<String> {
    let url = get_svn_url(repo_path)?;
    Some(parse_branch_from_url(&url))
}

/// Parse the branch name from an SVN repository URL.
fn parse_branch_from_url(url: &str) -> String {
    let trimmed = url.trim_end_matches('/');
    let parts: Vec<&str> = trimmed.split('/').collect();
    if parts.len() >= 2 {
        let second_to_last = parts[parts.len() - 2];
        if second_to_last == "branches" || second_to_last == "tags" {
            return parts[parts.len() - 1].to_string();
        }
    }
    if !parts.is_empty() {
        return parts[parts.len() - 1].to_string();
    }
    "unknown".to_string()
}

/// List SVN branches (directories under `^/branches`).
pub fn list_svn_branches(repo_path: &str) -> Vec<String> {
    let output = svn_command()
        .arg("ls")
        .arg("^/branches")
        .current_dir(repo_path)
        .output();
    match output {
        Ok(o) if o.status.success() => decode_svn_output(&o.stdout)
            .lines()
            .filter(|line| !line.is_empty())
            .map(|line| line.trim_end_matches('/').to_string())
            .collect(),
        _ => Vec::new(),
    }
}

/// Switch the working copy to a different SVN branch.
///
/// Uses `svn switch ^/branches/<name>` for branches or `svn switch ^/trunk` for trunk.
pub fn svn_switch_branch(repo_path: &str, branch: &str) -> Result<(), String> {
    let target = if branch == "trunk" {
        "^/trunk".to_string()
    } else {
        format!("^/branches/{branch}")
    };
    let output = svn_command()
        .arg("switch")
        .arg(&target)
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("SVN switch failed: {e}"))?;
    if !output.status.success() {
        let stderr = decode_svn_output(&output.stderr);
        return Err(format!("SVN switch failed: {stderr}"));
    }
    Ok(())
}

/// Get SVN branch status (whether there are uncommitted changes).
pub fn get_svn_branch_status(repo_path: &str) -> SvnBranchStatus {
    let status = get_svn_status(repo_path);
    SvnBranchStatus {
        has_uncommitted_changes: !status.all.is_empty(),
    }
}
