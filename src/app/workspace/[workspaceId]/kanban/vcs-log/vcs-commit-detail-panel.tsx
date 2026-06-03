"use client";

import React, { useEffect, useState } from "react";
import { useTranslation } from "@/i18n";
import {
  FilePlus2,
  Pencil,
  Trash2,
  ArrowRightLeft,
  Copy,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import type { VcsCommitDetail, VcsFileChange } from "@/core/vcs/vcs-unified-types";
import type { VcsLogAdapter } from "./types";

interface VcsCommitDetailPanelProps {
  adapter: VcsLogAdapter;
  repoPath: string;
  commitId: string | null;
  vcsType?: "git" | "svn" | "none";
  /** Optional log entry metadata — used to show author/date/message
   *  when the diff endpoint doesn't return these fields (e.g. SVN). */
  logEntry?: import("@/core/vcs/vcs-unified-types").VcsLogEntry | null;
}

const FILE_STATUS_ICON: Record<string, React.ElementType> = {
  added: FilePlus2,
  modified: Pencil,
  deleted: Trash2,
  renamed: ArrowRightLeft,
  copied: Copy,
};

const FILE_STATUS_COLOR: Record<string, string> = {
  added: "text-desktop-text-success",
  modified: "text-desktop-text-warning",
  deleted: "text-desktop-danger-text",
  renamed: "text-desktop-text-info",
  copied: "text-desktop-text-info",
};

/**
 * Shared commit/revision detail panel — works for both Git and SVN.
 * Displays: author, date, message, file changes, expandable diff.
 */
export function VcsCommitDetailPanel({
  adapter,
  repoPath,
  commitId,
  logEntry,
}: VcsCommitDetailPanelProps) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<VcsCommitDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);

  useEffect(() => {
    if (!commitId) {
      setDetail(null);
      return;
    }

    setLoading(true);
    setError(null);

    adapter
      .getCommitDetail(repoPath, commitId)
      .then((d) => {
        // Merge log entry metadata when the diff endpoint omits them (SVN)
        if (logEntry) {
          if (!d.author && logEntry.author) d.author = logEntry.author;
          if (!d.date && logEntry.date) d.date = logEntry.date;
          if (!d.message && logEntry.message) d.message = logEntry.message;
        }
        setDetail(d);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load detail");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [adapter, repoPath, commitId]);

  if (!commitId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-desktop-text-secondary">
        {t?.gitLog?.selectCommit ?? "选择一个提交查看详情"}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-desktop-text-secondary">
        <span className="animate-pulse">加载中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-desktop-danger-text">
        {error}
      </div>
    );
  }

  if (!detail) return null;

  return (
    <div className="flex h-full flex-col overflow-y-auto desktop-scrollbar-thin" data-testid="vcs-commit-detail">
      {/* Header */}
      <div className="border-b border-desktop-border px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-desktop-text-secondary">
          <span className="rounded bg-desktop-surface-muted px-1.5 py-0.5 font-mono">
            {detail.shortId}
          </span>
          <span>·</span>
          <span>{detail.author}</span>
          <span>·</span>
          <span>{formatDate(detail.date)}</span>
        </div>
        <div className="mt-2 whitespace-pre-wrap text-sm text-desktop-text-primary">
          {detail.message}
        </div>
      </div>

      {/* File changes */}
      <div className="flex-1 px-2 py-2">
        <div className="mb-2 px-2 text-xs font-medium text-desktop-text-secondary">
          {t?.gitLog?.changedFiles ?? "文件变更"} ({detail.files.length})
        </div>

        {detail.files.length === 0 && (
          <div className="px-2 py-4 text-center text-xs text-desktop-text-secondary">
            {"无文件变更"}
          </div>
        )}

        {detail.files.map((file) => (
          <FileChangeItem
            key={file.path}
            file={file}
            expanded={expandedFile === file.path}
            onToggle={() => setExpandedFile(expandedFile === file.path ? null : file.path)}
            patch={detail.patch}
          />
        ))}
      </div>
    </div>
  );
}

// ─── File Change Item ──────────────────────────────────────────────

function FileChangeItem({
  file,
  expanded,
  onToggle,
  patch,
}: {
  file: VcsFileChange;
  expanded: boolean;
  onToggle: () => void;
  patch?: string;
}) {
  const Icon = FILE_STATUS_ICON[file.status] ?? Pencil;
  const colorClass = FILE_STATUS_COLOR[file.status] ?? "text-desktop-text-secondary";
  const ChevronIcon = expanded ? ChevronDown : ChevronRight;

  return (
    <div className="border-b border-desktop-border/50 last:border-b-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-desktop-surface-hover"
      >
        <ChevronIcon className="h-3.5 w-3.5 shrink-0 text-desktop-text-secondary" />
        <Icon className={`h-3.5 w-3.5 shrink-0 ${colorClass}`} />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-desktop-text-primary">
          {file.path}
        </span>
        {file.previousPath && (
          <span className="shrink-0 text-xs text-desktop-text-secondary">
            ← {file.previousPath}
          </span>
        )}
      </button>

      {expanded && patch && (
        <div className="max-h-48 overflow-y-auto border-t border-desktop-border/30 bg-desktop-surface-muted px-2 py-1">
          <pre className="whitespace-pre-wrap break-words font-mono text-xs text-desktop-text-primary">
            {extractFilePatch(patch, file.path)}
          </pre>
        </div>
      )}
    </div>
  );
}

/** Extract the diff hunk for a specific file from a full patch */
function extractFilePatch(patch: string, filePath: string): string {
  const lines = patch.split("\n");
  const result: string[] = [];
  let inFile = false;

  for (const line of lines) {
    // Git diff header: diff --git a/path b/path
    // SVN diff header: Index: path
    if (
      line.startsWith(`diff --git`) ||
      line.startsWith("Index: ") ||
      line.startsWith("--- ") ||
      line.startsWith("+++ ")
    ) {
      if (line.includes(filePath)) {
        inFile = true;
        result.push(line);
        continue;
      } else if (inFile) {
        break;
      }
      continue;
    }

    if (inFile) {
      result.push(line);
    }
  }

  return result.length > 0 ? result.join("\n") : patch;
}

/** Format ISO date to readable string */
function formatDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoDate;
  }
}
