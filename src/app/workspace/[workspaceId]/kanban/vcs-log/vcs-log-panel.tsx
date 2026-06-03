"use client";

import React, { useCallback, useState } from "react";
import type { CodebaseData } from "@/client/hooks/use-workspaces";
import type { VcsLogEntry } from "@/core/vcs/vcs-unified-types";
import { GitLogPanel } from "../git-log";
import { SvnLogView } from "./svn-log-view";
import { VcsCommitDetailPanel } from "./vcs-commit-detail-panel";
import { VcsLogToolbar } from "./vcs-log-toolbar";
import type { VcsLogPanelProps } from "./types";

/**
 * VcsLogPanel — unified log panel that dispatches to GitLogPanel or SvnLogView
 * based on the codebase's vcsType.
 *
 * For Git: renders the existing GitLogPanel with commit graph.
 * For SVN: renders a flat revision list + shared detail panel.
 */
export function VcsLogPanel({
  adapter,
  repoPath,
  codebases,
  onSelectRepoPath,
  title,
  vcsType = "git",
  className,
}: VcsLogPanelProps) {
  const [selectedEntry, setSelectedEntry] = useState<VcsLogEntry | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    setSelectedEntry(null);
  }, []);

  // ─── Git: delegate to existing GitLogPanel ───────────────────────
  if (vcsType === "git") {
    // The existing GitLogPanel expects a GitLogAdapter — our VcsLogAdapter
    // is compatible since it implements the same getLog/getCommitDetail interface.
    return (
      <GitLogPanel
        adapter={adapter as never} // GitLogPanel has its own adapter type
        repoPath={repoPath}
        codebases={codebases as CodebaseData[]}
        onSelectRepoPath={onSelectRepoPath}
        title={title}
        className={className}
      />
    );
  }

  // ─── SVN: custom flat list + detail panel ────────────────────────
  return (
    <div
      className={`flex h-full flex-col ${className ?? ""}`}
      data-testid="vcs-log-panel"
    >
      <VcsLogToolbar
        vcsType={vcsType}
        onRefresh={handleRefresh}
      />

      <div className="flex min-h-0 flex-1">
        {/* Revision list */}
        <div className="w-80 shrink-0 border-r border-desktop-border">
          <SvnLogView
            key={refreshKey}
            adapter={adapter}
            repoPath={repoPath}
            selectedId={selectedEntry?.id}
            onSelectEntry={setSelectedEntry}
          />
        </div>

        {/* Detail panel */}
        <div className="min-w-0 flex-1">
          <VcsCommitDetailPanel
            adapter={adapter}
            repoPath={repoPath}
            commitId={selectedEntry?.id ?? null}
            vcsType={vcsType}
            logEntry={selectedEntry}
          />
        </div>
      </div>
    </div>
  );
}
