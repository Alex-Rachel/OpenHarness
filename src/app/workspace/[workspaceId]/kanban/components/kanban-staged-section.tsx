"use client";

import React from "react";
import { ChevronDown, Download, GitCommitHorizontal } from "lucide-react";
import { KanbanFileChangesSection } from "./kanban-file-changes-section";
import type { KanbanFileChangeItem } from "../kanban-file-changes-types";
import type { CodebaseData } from "@/client/hooks/use-workspaces";
import { useHasVcsCapability } from "@/client/hooks/use-vcs-capabilities";

interface KanbanStagedSectionProps {
  files: KanbanFileChangeItem[];
  onFileClick?: (file: KanbanFileChangeItem) => void;
  onFileSelect?: (file: KanbanFileChangeItem, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  onUnstageSelected: () => void;
  onCommit: () => void;
  onExport: () => void;
  loading?: boolean;
  /** Codebase data for VCS capability gating */
  codebase?: CodebaseData;
}

export function KanbanStagedSection({
  files,
  onFileClick,
  onFileSelect,
  onSelectAll,
  onUnstageSelected,
  onCommit,
  onExport,
  loading = false,
  codebase,
}: KanbanStagedSectionProps) {
  const canStageUnstage = useHasVcsCapability(codebase, "stageUnstage");
  if (!canStageUnstage) return null;
  const selectedCount = files.filter(f => f.selected).length;
  const hasSelection = selectedCount > 0;
  const hasFiles = files.length > 0;

  const badge = (
    <span className="text-[9px] font-medium uppercase tracking-wide text-[var(--dt-status-success)]">
      APPROVED
    </span>
  );

  const actions = (
    <>
      <button
        type="button"
        onClick={onUnstageSelected}
        disabled={!hasSelection || loading}
        className="flex items-center gap-1 rounded-md border border-desktop-border bg-desktop-surface px-2 py-1 text-[10px] font-medium text-desktop-text-secondary transition hover:bg-desktop-surface-muted hover:text-desktop-text-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        Unstage {hasSelection ? `(${selectedCount})` : "Selected"}
      </button>

      <button
        type="button"
        onClick={onCommit}
        disabled={!hasFiles || loading}
        className="flex items-center gap-1 rounded-md border border-[var(--dt-status-success)]/25 bg-[var(--dt-status-success-subtle)] px-2 py-1 text-[10px] font-medium text-[var(--dt-status-success)] transition hover:border-desktop-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        <GitCommitHorizontal className="h-3 w-3" />
        <ChevronDown className="h-3 w-3" />
        Commit
      </button>

      <button
        type="button"
        onClick={onExport}
        disabled={!hasFiles || loading}
        className="flex items-center gap-1 rounded-md border border-[var(--dt-status-info)]/25 bg-[var(--dt-status-info-subtle)] px-2 py-1 text-[10px] font-medium text-[var(--dt-status-info)] transition hover:border-desktop-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Download className="h-3 w-3" />
        Export
      </button>
    </>
  );

  return (
    <KanbanFileChangesSection
      title="STAGED"
      subtitle={files.length > 0 ? `${files.length} file${files.length === 1 ? '' : 's'} ready to commit` : undefined}
      files={files}
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
