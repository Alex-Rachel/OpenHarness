"use client";

import React from "react";
import { ArrowDown, RotateCcw } from "lucide-react";
import type { CodebaseData } from "@/client/hooks/use-workspaces";
import { useVcsCapabilities } from "@/client/hooks/use-vcs-capabilities";

interface KanbanGitOperationButtonsProps {
  targetBranch?: string;
  ahead?: number;
  behind?: number;
  onPull: () => void;
  onRebase: () => void;
  loading?: boolean;
  /** Codebase data for VCS capability gating */
  codebase?: CodebaseData;
}

export function KanbanGitOperationButtons({
  targetBranch = "main",
  behind = 0,
  onPull,
  onRebase,
  loading = false,
  codebase,
}: KanbanGitOperationButtonsProps) {
  const capabilities = useVcsCapabilities(codebase);
  const canPullUpdate = capabilities.has("pullUpdate");
  const canRebase = capabilities.has("rebase");

  // Hide entire component if neither operation is available
  if (!canPullUpdate && !canRebase) return null;

  return (
    <div className="flex items-center gap-2 border-t border-desktop-border px-3 py-2">
      {/* Pull Button */}
      {canPullUpdate && behind > 0 && (
        <button
          type="button"
          onClick={onPull}
          disabled={loading}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-[var(--dt-status-info)]/25 bg-[var(--dt-status-info-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--dt-status-info)] transition hover:border-desktop-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ArrowDown className="h-3.5 w-3.5" />
          Pull {behind} commit{behind === 1 ? "" : "s"} ↑
        </button>
      )}

      {/* Rebase Button */}
      {canRebase && (
        <button
          type="button"
          onClick={onRebase}
          disabled={loading}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-desktop-border bg-desktop-surface px-3 py-1.5 text-xs font-medium text-desktop-text-secondary transition hover:border-desktop-accent hover:bg-desktop-surface-muted hover:text-desktop-text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Rebase onto {targetBranch} ↻
        </button>
      )}
    </div>
  );
}
