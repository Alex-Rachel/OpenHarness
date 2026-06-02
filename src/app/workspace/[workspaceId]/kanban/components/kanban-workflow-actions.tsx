"use client";

import React from "react";
import { RotateCcw, Archive } from "lucide-react";

interface KanbanWorkflowActionsProps {
  targetBranch?: string;
  onReset: () => void;
  onArchive: () => void;
  loading?: boolean;
}

export function KanbanWorkflowActions({
  targetBranch = "main",
  onReset,
  onArchive,
  loading = false,
}: KanbanWorkflowActionsProps) {
  return (
    <section className="space-y-2 rounded-[var(--dt-radius-lg)] border border-desktop-border bg-desktop-surface-muted p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-desktop-text-primary">
        Workflow Actions
      </div>

      <div className="space-y-2">
        {/* Reset Action */}
        <button
          type="button"
          onClick={onReset}
          disabled={loading}
          className="flex w-full items-start gap-3 rounded-[var(--dt-radius-md)] border border-desktop-border bg-desktop-surface p-3 text-left shadow-[var(--dt-shadow-sm)] transition hover:border-desktop-accent hover:bg-desktop-surface-elevated disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-[var(--dt-status-info)]" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-desktop-text-primary">
              Reset and continue working
            </div>
            <div className="mt-0.5 text-xs text-desktop-text-secondary">
              Reset branch to {targetBranch} and keep working
            </div>
          </div>
        </button>

        {/* Archive Action */}
        <button
          type="button"
          onClick={onArchive}
          disabled={loading}
          className="flex w-full items-start gap-3 rounded-[var(--dt-radius-md)] border border-desktop-border bg-desktop-surface p-3 text-left shadow-[var(--dt-shadow-sm)] transition hover:border-desktop-accent hover:bg-desktop-surface-elevated disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Archive className="mt-0.5 h-4 w-4 shrink-0 text-desktop-accent" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-desktop-text-primary">
              Archive and start new space
            </div>
            <div className="mt-0.5 text-xs text-desktop-text-secondary">
              Continue working on this repo in a fresh workspace
            </div>
          </div>
        </button>
      </div>
    </section>
  );
}
