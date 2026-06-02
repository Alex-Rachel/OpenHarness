"use client";

import { useEffect, useMemo, useState } from "react";
import type { CodebaseData } from "@/client/hooks/use-workspaces";
import { desktopAwareFetch } from "@/client/utils/diagnostics";
import { useTranslation } from "@/i18n";
import type { GitHubIssueListItemInfo, GitHubPRListItemInfo, TaskInfo } from "../types";

type ImportTab = "issues" | "pulls";

interface GitHubIssuesResponse {
  repo: string;
  codebase?: {
    id: string;
    label: string;
  };
  issues: GitHubIssueListItemInfo[];
}

interface GitHubPullsResponse {
  repo: string;
  codebase?: {
    id: string;
    label: string;
  };
  pulls: GitHubPRListItemInfo[];
}

interface KanbanGitHubImportModalProps {
  show: boolean;
  workspaceId: string;
  boardId?: string | null;
  codebases: CodebaseData[];
  tasks: TaskInfo[];
  onClose: () => void;
  onImport: (codebaseId: string, issues: GitHubIssueListItemInfo[], repo: string, mergeAsSingleCard: boolean) => Promise<void>;
  onImportPulls: (codebaseId: string, pulls: GitHubPRListItemInfo[], repo: string, mergeAsSingleCard: boolean) => Promise<void>;
}

function formatIssueTimestamp(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

export function KanbanGitHubImportModal({
  show,
  workspaceId,
  boardId,
  codebases,
  tasks,
  onClose,
  onImport,
  onImportPulls,
}: KanbanGitHubImportModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ImportTab>("issues");
  const [selectedCodebaseId, setSelectedCodebaseId] = useState<string>("");
  const [issuesPayload, setIssuesPayload] = useState<GitHubIssuesResponse | null>(null);
  const [pullsPayload, setPullsPayload] = useState<GitHubPullsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [mergeAsSingleCard, setMergeAsSingleCard] = useState(false);

  const fallbackImportError = activeTab === "issues" ? t.kanbanImport.importFailed : t.kanbanImport.importPullsFailed;

  useEffect(() => {
    if (!show) {
      setIssuesPayload(null);
      setPullsPayload(null);
      return;
    }
    const defaultCodebase = codebases.find((codebase) => codebase.isDefault) ?? codebases[0];
    setSelectedCodebaseId(defaultCodebase?.id ?? "");
    setSelectedItemIds([]);
    setError(null);
    setMergeAsSingleCard(false);
  }, [codebases, show]);

  useEffect(() => {
    if (!show || !selectedCodebaseId) return;
    setIssuesPayload(null);
    setPullsPayload(null);
    setSelectedItemIds([]);
    setError(null);
  }, [selectedCodebaseId, show]);

  useEffect(() => {
    if (!show || !selectedCodebaseId) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        if (activeTab === "issues") {
          const response = await desktopAwareFetch(
            `/api/github/issues?workspaceId=${encodeURIComponent(workspaceId)}&codebaseId=${encodeURIComponent(selectedCodebaseId)}${boardId ? `&boardId=${encodeURIComponent(boardId)}` : ""}`,
            { cache: "no-store", signal: controller.signal },
          );
          const data = await response.json().catch(() => ({}));
          if (controller.signal.aborted) return;
          if (!response.ok) {
            throw new Error(typeof data?.error === "string" ? data.error : t.kanbanImport.loadFailed);
          }
          setIssuesPayload({
            repo: typeof data?.repo === "string" ? data.repo : "",
            codebase: data?.codebase,
            issues: Array.isArray(data?.issues) ? data.issues as GitHubIssueListItemInfo[] : [],
          });
        } else {
          const response = await desktopAwareFetch(
            `/api/github/pulls?workspaceId=${encodeURIComponent(workspaceId)}&codebaseId=${encodeURIComponent(selectedCodebaseId)}${boardId ? `&boardId=${encodeURIComponent(boardId)}` : ""}`,
            { cache: "no-store", signal: controller.signal },
          );
          const data = await response.json().catch(() => ({}));
          if (controller.signal.aborted) return;
          if (!response.ok) {
            throw new Error(typeof data?.error === "string" ? data.error : t.kanbanImport.loadPullsFailed);
          }
          setPullsPayload({
            repo: typeof data?.repo === "string" ? data.repo : "",
            codebase: data?.codebase,
            pulls: Array.isArray(data?.pulls) ? data.pulls as GitHubPRListItemInfo[] : [],
          });
        }
        setSelectedItemIds([]);
      } catch (fetchError) {
        if (controller.signal.aborted) return;
        const loadFallback = activeTab === "issues" ? t.kanbanImport.loadFailed : t.kanbanImport.loadPullsFailed;
        setError(fetchError instanceof Error ? fetchError.message : loadFallback);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [activeTab, boardId, reloadNonce, selectedCodebaseId, show, t.kanbanImport.loadFailed, t.kanbanImport.loadPullsFailed, workspaceId]);

  // Reset selection when tab changes
  useEffect(() => {
    setSelectedItemIds([]);
    setError(null);
  }, [activeTab]);

  const importedIssueKeys = useMemo(
    () => new Set(
      tasks
        .filter((task) => task.githubRepo && task.githubNumber !== undefined && !task.isPullRequest)
        .map((task) => `${task.githubRepo}#${task.githubNumber}`),
    ),
    [tasks],
  );

  const importedPRKeys = useMemo(
    () => new Set(
      tasks
        .filter((task) => task.githubRepo && task.githubNumber !== undefined && task.isPullRequest)
        .map((task) => `${task.githubRepo}#${task.githubNumber}`),
    ),
    [tasks],
  );

  const selectableIssues = useMemo(() => {
    const repo = issuesPayload?.repo ?? "";
    return (issuesPayload?.issues ?? []).map((issue) => ({
      issue,
      imported: importedIssueKeys.has(`${repo}#${issue.number}`),
    }));
  }, [importedIssueKeys, issuesPayload?.issues, issuesPayload?.repo]);

  const selectablePulls = useMemo(() => {
    const repo = pullsPayload?.repo ?? "";
    return (pullsPayload?.pulls ?? []).map((pull) => ({
      pull,
      imported: importedPRKeys.has(`${repo}#${pull.number}`),
    }));
  }, [importedPRKeys, pullsPayload?.pulls, pullsPayload?.repo]);

  const selectableIssueIds = useMemo(
    () => selectableIssues.filter((item) => !item.imported).map((item) => item.issue.id),
    [selectableIssues],
  );

  const selectablePullIds = useMemo(
    () => selectablePulls.filter((item) => !item.imported).map((item) => item.pull.id),
    [selectablePulls],
  );

  const currentRepo = activeTab === "issues" ? issuesPayload?.repo : pullsPayload?.repo;
  const currentCount = activeTab === "issues" ? selectableIssues.length : selectablePulls.length;
  const currentSelectableIds = activeTab === "issues" ? selectableIssueIds : selectablePullIds;
  const currentLoadingText = activeTab === "issues" ? t.kanbanImport.loading : t.kanbanImport.loadingPulls;
  const currentNoItemsText = activeTab === "issues" ? t.kanbanImport.noIssues : t.kanbanImport.noPulls;
  const currentItemsLoadedText = activeTab === "issues" ? t.kanbanImport.issuesLoaded : t.kanbanImport.pullsLoaded;

  if (!show) return null;

  const canImport = Boolean(selectedItemIds.length > 0 && selectedCodebaseId && currentRepo);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-desktop-border bg-desktop-surface-elevated p-5 shadow-[var(--dt-shadow-lg)]">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-desktop-text-primary">{t.kanbanImport.title}</h3>
            <p className="mt-1 text-sm text-desktop-text-secondary">{t.kanbanImport.description}</p>
          </div>
          <button onClick={onClose} className="text-sm text-desktop-text-tertiary hover:text-desktop-text-primary">
            {t.common.close}
          </button>
        </div>

        <div className="mb-4 flex gap-1 border-b border-desktop-border">
          <button
            type="button"
            onClick={() => setActiveTab("issues")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === "issues"
              ? "border-b-2 border-desktop-accent text-desktop-accent"
              : "text-desktop-text-secondary hover:text-desktop-text-primary"
            }`}
          >
            {t.kanbanImport.tabIssues}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("pulls")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === "pulls"
              ? "border-b-2 border-desktop-accent text-desktop-accent"
              : "text-desktop-text-secondary hover:text-desktop-text-primary"
            }`}
          >
            {t.kanbanImport.tabPulls}
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="text-xs font-medium text-desktop-text-secondary">
            {t.kanbanImport.repository}
          </label>
          <select
            value={selectedCodebaseId}
            onChange={(event) => setSelectedCodebaseId(event.target.value)}
            className="min-w-[220px] rounded-lg border border-desktop-border bg-desktop-surface px-3 py-2 text-sm text-desktop-text-primary focus:border-desktop-accent focus:outline-none focus:ring-2 focus:ring-[var(--dt-focus-ring)]/25"
          >
            {codebases.map((codebase) => (
              <option key={codebase.id} value={codebase.id}>
                {codebase.label ?? codebase.repoPath.split("/").pop() ?? codebase.repoPath}
              </option>
            ))}
          </select>
          {currentRepo && (
            <span className="rounded-full border border-desktop-border bg-desktop-surface-muted px-2.5 py-1 text-xs text-desktop-text-secondary">
              {currentRepo}
            </span>
          )}
          <button
            type="button"
            onClick={() => setReloadNonce((current) => current + 1)}
            className="rounded-lg border border-desktop-border px-3 py-2 text-xs text-desktop-text-secondary hover:bg-desktop-surface-muted hover:text-desktop-text-primary"
          >
            {t.common.refresh}
          </button>
        </div>

        <div className="mb-3 flex items-center justify-between gap-3 text-xs text-desktop-text-secondary">
          <div>
            {currentCount > 0 ? `${currentCount} ${currentItemsLoadedText}` : currentNoItemsText}
          </div>
          {currentSelectableIds.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedItemIds(currentSelectableIds)}
                className="text-desktop-accent hover:text-desktop-accent-strong"
              >
                {t.kanbanImport.selectAll}
              </button>
              <button
                type="button"
                onClick={() => setSelectedItemIds([])}
                className="text-desktop-text-secondary hover:text-desktop-text-primary"
              >
                {t.kanbanImport.clearSelection}
              </button>
            </div>
          )}
        </div>

        <label className="mb-3 flex items-start gap-3 rounded-xl border border-desktop-border bg-desktop-surface-muted px-4 py-3 text-sm text-desktop-text-primary">
          <input
            type="checkbox"
            checked={mergeAsSingleCard}
            disabled={submitting}
            onChange={(event) => setMergeAsSingleCard(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-desktop-border text-desktop-accent focus:ring-[var(--dt-focus-ring)]"
          />
          <span className="min-w-0">
            <span className="block font-medium">{t.kanbanImport.mergeAsSingleCard}</span>
            <span className="mt-1 block text-xs text-desktop-text-secondary">
              {t.kanbanImport.mergeAsSingleCardHint}
            </span>
          </span>
        </label>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-desktop-border">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-sm text-desktop-text-secondary">
              {currentLoadingText}
            </div>
          ) : error ? (
            <div className="flex h-40 items-center justify-center px-6 text-center text-sm text-desktop-danger-text">
              {error}
            </div>
          ) : activeTab === "issues" ? (
            selectableIssues.length === 0 ? (
              <div className="flex h-40 items-center justify-center px-6 text-center text-sm text-desktop-text-secondary">
                {t.kanbanImport.noIssues}
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-700">
                {selectableIssues.map(({ issue, imported }) => {
                  const checked = selectedItemIds.includes(issue.id);
                  const updatedAtLabel = formatIssueTimestamp(issue.updatedAt);
                  return (
                    <label
                      key={issue.id}
                      className={`flex gap-3 px-4 py-3 transition-colors ${imported
                        ? "bg-desktop-surface-muted"
                        : "hover:bg-desktop-surface-muted"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={imported || submitting}
                        onChange={(event) => {
                          setSelectedItemIds((current) => {
                            if (event.target.checked) {
                              return [...current, issue.id];
                            }
                            return current.filter((id) => id !== issue.id);
                          });
                        }}
                        className="mt-1 h-4 w-4 rounded border-desktop-border text-desktop-accent focus:ring-[var(--dt-focus-ring)]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={issue.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-medium text-desktop-text-primary hover:text-desktop-accent"
                          >
                            #{issue.number} {issue.title}
                          </a>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${issue.state === "open"
                            ? "border border-[var(--dt-status-success)]/25 bg-[var(--dt-status-success-subtle)] text-[var(--dt-status-success)]"
                            : "border border-desktop-border bg-desktop-surface-muted text-desktop-text-secondary"
                          }`}>
                            {issue.state === "open" ? t.kanbanImport.stateOpen : t.kanbanImport.stateClosed}
                          </span>
                          {imported && (
                            <span className="rounded-full border border-[var(--dt-status-warning)]/25 bg-[var(--dt-status-warning-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--dt-status-warning)]">
                              {t.kanbanImport.alreadyImported}
                            </span>
                          )}
                        </div>
                        {issue.body && (
                          <p className="mt-1 line-clamp-2 text-sm text-desktop-text-secondary">
                            {issue.body}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-desktop-text-secondary">
                          {issue.labels.map((label) => (
                            <span key={label} className="rounded-full border border-desktop-border bg-desktop-surface-muted px-2 py-0.5">
                              {label}
                            </span>
                          ))}
                          {issue.assignees.length > 0 && <span>{issue.assignees.join(", ")}</span>}
                          {updatedAtLabel && <span>{t.kanbanImport.updatedAt} {updatedAtLabel}</span>}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )
          ) : (
            selectablePulls.length === 0 ? (
              <div className="flex h-40 items-center justify-center px-6 text-center text-sm text-desktop-text-secondary">
                {t.kanbanImport.noPulls}
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-700">
                {selectablePulls.map(({ pull, imported }) => {
                  const checked = selectedItemIds.includes(pull.id);
                  const updatedAtLabel = formatIssueTimestamp(pull.updatedAt);
                  return (
                    <label
                      key={pull.id}
                      className={`flex gap-3 px-4 py-3 transition-colors ${imported
                        ? "bg-desktop-surface-muted"
                        : "hover:bg-desktop-surface-muted"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={imported || submitting}
                        onChange={(event) => {
                          setSelectedItemIds((current) => {
                            if (event.target.checked) {
                              return [...current, pull.id];
                            }
                            return current.filter((id) => id !== pull.id);
                          });
                        }}
                        className="mt-1 h-4 w-4 rounded border-desktop-border text-desktop-accent focus:ring-[var(--dt-focus-ring)]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={pull.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-medium text-desktop-text-primary hover:text-desktop-accent"
                          >
                            #{pull.number} {pull.title}
                          </a>
                          {pull.draft && (
                            <span className="rounded-full border border-desktop-border bg-desktop-surface-muted px-2 py-0.5 text-[10px] font-medium text-desktop-text-secondary">
                              {t.kanbanImport.draftBadge}
                            </span>
                          )}
                          {pull.mergedAt ? (
                            <span className="rounded-full border border-[var(--dt-status-info)]/25 bg-[var(--dt-status-info-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--dt-status-info)]">
                              {t.kanbanImport.mergedBadge}
                            </span>
                          ) : (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${pull.state === "open"
                              ? "border border-[var(--dt-status-success)]/25 bg-[var(--dt-status-success-subtle)] text-[var(--dt-status-success)]"
                              : "border border-desktop-border bg-desktop-surface-muted text-desktop-text-secondary"
                            }`}>
                              {pull.state === "open" ? t.kanbanImport.stateOpen : t.kanbanImport.stateClosed}
                            </span>
                          )}
                          {imported && (
                            <span className="rounded-full border border-[var(--dt-status-warning)]/25 bg-[var(--dt-status-warning-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--dt-status-warning)]">
                              {t.kanbanImport.alreadyImported}
                            </span>
                          )}
                        </div>
                        {pull.body && (
                          <p className="mt-1 line-clamp-2 text-sm text-desktop-text-secondary">
                            {pull.body}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-desktop-text-secondary">
                          {pull.headRef && pull.baseRef && (
                            <span className="font-mono">
                              {pull.headRef} {t.kanbanImport.branchInfo} {pull.baseRef}
                            </span>
                          )}
                          {pull.labels.map((label) => (
                            <span key={label} className="rounded-full border border-desktop-border bg-desktop-surface-muted px-2 py-0.5">
                              {label}
                            </span>
                          ))}
                          {pull.assignees.length > 0 && <span>{pull.assignees.join(", ")}</span>}
                          {updatedAtLabel && <span>{t.kanbanImport.updatedAt} {updatedAtLabel}</span>}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-desktop-border px-4 py-2 text-sm text-desktop-text-secondary hover:bg-desktop-surface-muted hover:text-desktop-text-primary"
          >
            {t.common.cancel}
          </button>
          <button
            onClick={async () => {
              if (!canImport || !currentRepo) return;
              setSubmitting(true);
              setError(null);
              try {
                if (activeTab === "issues") {
                  const issues = selectableIssues
                    .filter(({ issue, imported }) => !imported && selectedItemIds.includes(issue.id))
                    .map(({ issue }) => issue);
                  await onImport(selectedCodebaseId, issues, currentRepo, mergeAsSingleCard);
                } else {
                  const pulls = selectablePulls
                    .filter(({ pull, imported }) => !imported && selectedItemIds.includes(pull.id))
                    .map(({ pull }) => pull);
                  await onImportPulls(selectedCodebaseId, pulls, currentRepo, mergeAsSingleCard);
                }
                onClose();
              } catch (importError) {
                setError(importError instanceof Error ? importError.message : fallbackImportError);
              } finally {
                setSubmitting(false);
              }
            }}
            disabled={!canImport || submitting}
            className="rounded-lg bg-desktop-accent px-4 py-2 text-sm font-medium text-desktop-accent-text hover:bg-desktop-accent-strong disabled:opacity-50"
          >
            {submitting ? t.kanbanImport.importing : t.kanbanImport.importSelected}
          </button>
        </div>
      </div>
    </div>
  );
}
