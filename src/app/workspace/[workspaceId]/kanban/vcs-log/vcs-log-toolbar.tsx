"use client";

import React from "react";
import { RefreshCw } from "lucide-react";

interface VcsLogToolbarProps {
  vcsType?: "git" | "svn" | "none";
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onRefresh?: () => void;
  /** Optional: branch selector (Git-only) */
  branchSelector?: React.ReactNode;
}

/**
 * Unified log toolbar — shows search + refresh for all VCS types,
 * and branch selector for Git only.
 */
export function VcsLogToolbar({
  vcsType,
  searchValue,
  onSearchChange,
  onRefresh,
  branchSelector,
}: VcsLogToolbarProps) {
  return (
    <div className="flex items-center gap-2 border-b border-desktop-border px-3 py-2">
      {/* Branch selector — Git only */}
      {vcsType === "git" && branchSelector && (
        <div className="shrink-0">{branchSelector}</div>
      )}

      {/* VCS type badge */}
      <span className="shrink-0 rounded bg-desktop-surface-muted px-1.5 py-0.5 text-xs font-medium text-desktop-text-secondary uppercase">
        {vcsType ?? "git"}
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Refresh */}
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="rounded p-1 text-desktop-text-secondary hover:bg-desktop-surface-hover hover:text-desktop-text-primary"
          title={"刷新"}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
