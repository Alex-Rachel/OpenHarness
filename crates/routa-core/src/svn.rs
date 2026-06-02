//! SVN utilities for working copy management.
//! Mirrors the git.rs module structure for consistency.

use serde::{Deserialize, Serialize};
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::process::Command;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

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
        Ok(o) => String::from_utf8_lossy(&o.stdout).to_string(),
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
        .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
        .unwrap_or_default()
}

pub fn get_svn_file_diff(repo_path: &str, file_path: &str) -> String {
    svn_command()
        .arg("diff")
        .arg(file_path)
        .current_dir(repo_path)
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
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
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("SVN commit failed: {stderr}"));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
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
            let stdout = String::from_utf8_lossy(&o.stdout).to_string();
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
        Ok(o) => parse_svn_log(&String::from_utf8_lossy(&o.stdout)),
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
        Ok(o) => parse_svn_log(&String::from_utf8_lossy(&o.stdout)),
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
            let date = parts[2].trim().to_string();
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

// ─── Blame ─────────────────────────────────────────────────────────

pub fn svn_blame(repo_path: &str, file_path: &str) -> Vec<SvnBlameLine> {
    let output = svn_command()
        .arg("blame")
        .arg(file_path)
        .current_dir(repo_path)
        .output();

    match output {
        Ok(o) => parse_svn_blame(&String::from_utf8_lossy(&o.stdout)),
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
        let stderr = String::from_utf8_lossy(&output.stderr);
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
        let stderr = String::from_utf8_lossy(&output.stderr);
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
        .and_then(|o| String::from_utf8_lossy(&o.stdout).trim().parse::<u64>().ok())
        .unwrap_or(0)
}
