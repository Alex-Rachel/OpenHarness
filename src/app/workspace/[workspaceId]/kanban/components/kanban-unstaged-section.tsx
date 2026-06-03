"use client";

import React from "react";
import { GitCommitHorizontal, Trash2 } from "lucide-react";
import { KanbanFileChangesSection } from "./kanban-file-changes-section";
import type { KanbanFileChangeItem } from "../kanban-file-changes-types";
import type { CodebaseData } from "@/client/hooks/use-workspaces";
import { useHasVcsCapability } from "@/client/hooks/use-vcs-capabilities";

interface KanbanUnstagedSectionProps {
  files: KanbanFileChangeItem[];
  autoCommit: boolean;
  onAutoCommitToggle: (enabled: boolean) => void;
  embedded?: boolean;
  onFileClick?: (file: KanbanFileChangeItem) => void;
  onFileSelect?: (file: KanbanFileChangeItem, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  onStageSelected: () => void;
  onDiscardSelected: () => void;
  loading?: boolean;
  /** Codebase data for VCS capability gating */
  codebase?: CodebaseData;
}

export function KanbanUnstagedSection({
  files,
  autoCommit,
  onAutoCommitToggle,
  embedded = false,
  onFileClick,
  onFileSelect,
  onSelectAll,
  onStageSelected,
  onDiscardSelected,
  loading = false,
  codebase,
}: KanbanUnstagedSectionProps) {
  const canStageUnstage = useHasVcsCapability(codebase, "stageUnstage");

  const selectedCount = files.filter(f => f.selected).length;
  const hasSelection = selectedCount > 0;

  const badge = autoCommit ? (
    <span className="rounded-full border border-[var(--dt-status-success)]/25 bg-[var(--dt-status-success-subtle)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--dt-status-success)]">
      Auto-commit
    </span>
  ) : (
    <span className="text-[9px] font-medium uppercase tracking-wide text-[var(--dt-status-warning)]">
      NEW
    </span>
  );

  const actions = (
    <>
      {/* Stage button — Git only (SVN has no staging area) */}
      {canStageUnstage && (
        <button
          type="button"
          onClick={onStageSelected}
          disabled={!hasSelection || loading}
          className="flex items-center gap-1 rounded-md border border-[var(--dt-status-warning)]/25 bg-[var(--dt-status-warning-subtle)] px-2 py-1 text-[10px] font-medium text-[var(--dt-status-warning)] transition hover:border-desktop-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <GitCommitHorizontal className="h-3 w-3" />
          Stage {hasSelection ? `(${selectedCount})` : "Selected"}
        </button>
      )}

      <button
        type="button"
        onClick={onDiscardSelected}
        disabled={!hasSelection || loading}
        className="flex items-center gap-1 rounded-md border border-desktop-danger-border bg-desktop-danger-subtle px-2 py-1 text-[10px] font-medium text-desktop-danger-text transition hover:border-[var(--dt-danger-border-strong)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Trash2 className="h-3 w-3" />
        {canStageUnstage ? "Discard" : "Revert"} {hasSelection ? `(${selectedCount})` : "Selected"}
      </button>

      {/* Auto-commit checkbox — Git only */}
      {canStageUnstage && (
        <label className="ml-auto flex items-center gap-1.5 text-[10px] text-desktop-text-secondary">
          <input
            type="checkbox"
            checked={autoCommit}
            disabled={true}
            onChange={(e) => onAutoCommitToggle(e.target.checked)}
            className="h-3 w-3 rounded border-desktop-border text-[var(--dt-status-success)] opacity-50 focus:ring-1 focus:ring-[var(--dt-focus-ring)] disabled:cursor-not-allowed"
          />
          <span className="opacity-50">Auto-commit</span>
        </label>
      )}
    </>
  );

  // Section title: "CHANGES" for SVN, "UNSTAGED" for Git
  const sectionTitle = canStageUnstage ? "UNSTAGED" : "CHANGES";

  return (
    <KanbanFileChangesSection
      title={sectionTitle}
      subtitle={files.length > 0 ? `${files.length} file${files.length === 1 ? '' : 's'} with changes` : undefined}
      files={files}
      embedded={embedded}
      showCheckbox={true}
      onFileClick={onFileClick}
      onFileSelect={onFileSelect}
      onSelectAll={onSelectAll}
      actions={actions}
      badge={badge}
      defaultExpanded={true}
    />
  );
}
