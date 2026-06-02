"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/i18n";
import { formatRelativeTime } from "../ui-components";
import { desktopAwareFetch } from "@/client/utils/diagnostics";
import type { BackgroundTaskInfo } from "../types";
import { X } from "lucide-react";


interface WorkspaceBackgroundAgent {
  id: string;
  name: string;
  role: string;
  status: string;
  parentId?: string;
}

interface KanbanBgAgentPanelProps {
  workspaceId: string;
}

interface CreateAgentFormState {
  name: string;
  role: string;
  modelTier: string;
}

interface GroupedBgRoute {
  routeKey: string;
  routeLabel: string;
  agentId: string;
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  sourceCounts: Record<string, number>;
  scheduleTriggerIds: string[];
  latestTask: BackgroundTaskInfo | null;
}

interface GroupedWorkspaceAgent {
  key: string;
  name: string;
  role: string;
  status: string;
  count: number;
  ids: string[];
}

function normalizeAgentKey(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeAgentBaseName(value: string): string {
  let normalized = normalizeAgentKey(value);
  normalized = normalized.replace(
    /-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "",
  );

  const suffixPattern = /(?:[-_][0-9a-f]{6,})+$/i;
  if (suffixPattern.test(normalized)) {
    normalized = normalized.replace(suffixPattern, "");
  }

  return normalized.replace(/[-_]+$/g, "").trim().toLowerCase();
}

function getAgentGroupKey(name: string, role: string): string {
  return `${normalizeAgentBaseName(name)}:${normalizeAgentKey(role)}`;
}

function getTaskRouteGroup(task: BackgroundTaskInfo): Pick<GroupedBgRoute, "routeKey" | "routeLabel" | "agentId" | "sourceCounts" | "scheduleTriggerIds"> {
  const source = task.triggerSource?.trim().toLowerCase() || "manual";
  const agentId = task.agentId.trim();
  const triggeredBy = task.triggeredBy?.trim();

  return {
    routeKey: `agent:${agentId}`,
    routeLabel: agentId,
    agentId,
    sourceCounts: { [source]: 1 },
    scheduleTriggerIds: source === "schedule" && triggeredBy ? [triggeredBy] : [],
  };
}

function statusClass(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: "border border-[var(--dt-status-success)]/25 bg-[var(--dt-status-success-subtle)] text-[var(--dt-status-success)]",
    PENDING: "border border-[var(--dt-status-warning)]/25 bg-[var(--dt-status-warning-subtle)] text-[var(--dt-status-warning)]",
    COMPLETED: "border border-desktop-border bg-desktop-surface-muted text-desktop-text-secondary",
    ERROR: "border border-desktop-danger-border bg-desktop-danger-subtle text-desktop-danger-text",
    CANCELLED: "border border-desktop-border bg-desktop-surface-muted text-desktop-text-tertiary",
  };
  return map[status.toUpperCase()] ?? map.PENDING;
}

function roleClass(role: string): string {
  const map: Record<string, string> = {
    ROUTA: "border border-[var(--dt-status-info)]/25 bg-[var(--dt-status-info-subtle)] text-[var(--dt-status-info)]",
    DEVELOPER: "border border-desktop-border bg-desktop-surface-muted text-desktop-text-secondary",
    CRAFTER: "border border-[var(--dt-status-warning)]/25 bg-[var(--dt-status-warning-subtle)] text-[var(--dt-status-warning)]",
    GATE: "border border-[var(--dt-status-success)]/25 bg-[var(--dt-status-success-subtle)] text-[var(--dt-status-success)]",
  };
  return map[role.toUpperCase()] ?? map.DEVELOPER;
}

function aggregateAgentStatus(statuses: string[]): string {
  const normalized = statuses.map((status) => status.toUpperCase());
  if (normalized.includes("ACTIVE")) return "ACTIVE";
  if (normalized.includes("ERROR")) return "ERROR";
  if (normalized.includes("PENDING")) return "PENDING";
  if (normalized.includes("CANCELLED")) return "CANCELLED";
  if (normalized.includes("COMPLETED")) return "COMPLETED";
  return "PENDING";
}

export function KanbanBgAgentPanel({ workspaceId }: KanbanBgAgentPanelProps) {
  const { t } = useTranslation();
  const [agents, setAgents] = useState<WorkspaceBackgroundAgent[]>([]);
  const [bgTasks, setBgTasks] = useState<BackgroundTaskInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateAgentFormState>({
    name: "",
    role: "DEVELOPER",
    modelTier: "BALANCED",
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchPanelData = useCallback(async (signal?: AbortSignal) => {
    if (signal?.aborted) return;
    setLoading(true);
    setError(null);
    try {
      const [agentsResponse, bgTasksResponse] = await Promise.all([
        desktopAwareFetch(`/api/agents?workspaceId=${encodeURIComponent(workspaceId)}`, {
          cache: "no-store",
          signal,
        }),
        desktopAwareFetch(`/api/background-tasks?workspaceId=${encodeURIComponent(workspaceId)}`, {
          cache: "no-store",
          signal,
        }),
      ]);

      const [agentsData, bgTasksData] = await Promise.all([
        agentsResponse.json().catch(() => null),
        bgTasksResponse.json().catch(() => null),
      ]);

      if (signal?.aborted) return;

      setAgents(Array.isArray(agentsData) ? agentsData : Array.isArray(agentsData?.agents) ? agentsData.agents : []);
      setBgTasks(Array.isArray(bgTasksData?.tasks) ? bgTasksData.tasks : []);

      if (!agentsResponse.ok || !bgTasksResponse.ok) {
        setError("Failed to refresh background agent data.");
      }
    } catch (fetchError) {
      if (signal?.aborted) return;
      setError(fetchError instanceof Error ? fetchError.message : "Failed to refresh background agent data.");
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [workspaceId]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchPanelData(controller.signal);
    return () => controller.abort();
  }, [fetchPanelData]);

  const groupedRoutes = useMemo(() => {
    const groups = new Map<string, GroupedBgRoute>();

    for (const task of bgTasks) {
      const {
        routeKey,
        routeLabel,
        agentId,
        sourceCounts,
        scheduleTriggerIds,
      } = getTaskRouteGroup(task);
      const current = groups.get(routeKey) ?? {
        routeKey,
        routeLabel,
        agentId,
        total: 0,
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
        sourceCounts,
        scheduleTriggerIds,
        latestTask: null,
      };

      current.total += 1;
      if (task.status === "PENDING") current.pending += 1;
      if (task.status === "RUNNING") current.running += 1;
      if (task.status === "COMPLETED") current.completed += 1;
      if (task.status === "FAILED") current.failed += 1;

      const currentLatest = current.latestTask
        ? new Date(current.latestTask.createdAt).getTime()
        : 0;
      const candidateLatest = new Date(task.createdAt).getTime();
      if (!current.latestTask || candidateLatest > currentLatest) {
        current.latestTask = task;
      }
      for (const [source, count] of Object.entries(sourceCounts)) {
        current.sourceCounts[source] = (current.sourceCounts[source] ?? 0) + count;
      }
      for (const triggerId of scheduleTriggerIds) {
        if (!current.scheduleTriggerIds.includes(triggerId)) {
          current.scheduleTriggerIds.push(triggerId);
        }
      }

      groups.set(routeKey, current);
    }

    return Array.from(groups.values()).sort((left, right) => right.total - left.total);
  }, [bgTasks]);

  const linkedRouteKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const agent of agents) {
      keys.add(normalizeAgentKey(agent.id));
      keys.add(normalizeAgentKey(agent.name));
    }
    return keys;
  }, [agents]);

  const groupedAgents = useMemo(() => {
    const grouped = new Map<string, GroupedWorkspaceAgent & { statusStack: string[] }>();

    for (const agent of agents) {
      const groupKey = getAgentGroupKey(agent.name, agent.role);
      const displayName = normalizeAgentBaseName(agent.name);
      const current = grouped.get(groupKey) ?? {
        key: groupKey,
        name: displayName,
        role: agent.role,
        status: agent.status,
        count: 0,
        ids: [],
        statusStack: [],
      };

      current.count += 1;
      current.ids.push(agent.id);
      current.statusStack.push(agent.status);
      current.status = aggregateAgentStatus(current.statusStack);
      grouped.set(groupKey, current);
    }

    return Array.from(grouped.values());
  }, [agents]);

  const agentCards = useMemo(() => {
    return groupedAgents.map((agent) => {
      const matchedRoutes = groupedRoutes.filter((route) =>
        agent.ids.some((id) => normalizeAgentKey(route.agentId) === normalizeAgentKey(id)),
      );

      const totals = matchedRoutes.reduce((acc, route) => {
        acc.total += route.total;
        acc.pending += route.pending;
        acc.running += route.running;
        acc.completed += route.completed;
        acc.failed += route.failed;
        if (!route.latestTask) return acc;
        if (!acc.latestTask || new Date(route.latestTask.createdAt).getTime() > new Date(acc.latestTask.createdAt).getTime()) {
          acc.latestTask = route.latestTask;
        }
        return acc;
      }, {
        total: 0,
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
        latestTask: null as BackgroundTaskInfo | null,
      });

      return {
        agent,
        ...totals,
      };
    });
  }, [groupedRoutes, groupedAgents]);

  const unlinkedRoutes = useMemo(() => {
    return groupedRoutes.filter((route) => !linkedRouteKeys.has(normalizeAgentKey(route.agentId)));
  }, [groupedRoutes, linkedRouteKeys]);

  const activeAgents = groupedAgents.filter((agent) => agent.status === "ACTIVE").length;
  const runningRoutes = groupedRoutes.filter((route) => route.running > 0).length;
  const pendingTasks = bgTasks.filter((task) => task.status === "PENDING").length;

  const handleCreateAgent = useCallback(async () => {
    if (!createForm.name.trim()) {
      setCreateError("Agent name is required.");
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const response = await desktopAwareFetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          name: createForm.name.trim(),
          role: createForm.role,
          modelTier: createForm.modelTier,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to create background agent");
      }

      setShowCreateModal(false);
      setCreateForm({ name: "", role: "DEVELOPER", modelTier: "BALANCED" });
      await fetchPanelData();
    } catch (createAgentError) {
      setCreateError(createAgentError instanceof Error ? createAgentError.message : "Failed to create background agent");
    } finally {
      setCreating(false);
    }
  }, [createForm, fetchPanelData, workspaceId]);

  return (
    <>
      <section
        className="shrink-0 rounded-2xl border border-desktop-border bg-desktop-surface-elevated px-4 py-4 shadow-[var(--dt-shadow-sm)]"
        data-testid="kanban-bg-agent-panel"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-[var(--dt-status-warning)]/25 bg-[var(--dt-status-warning-subtle)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--dt-status-warning)]">
                  {t.common.workspace}
                </span>
                <h2 className="text-sm font-semibold text-desktop-text-primary">{t.kanbanBgAgent.backgroundAgents}</h2>
              </div>
              <p className="mt-1 text-[12px] text-desktop-text-secondary">
                {t.kanbanBgAgent.bgAgentDesc}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void fetchPanelData()}
                className="rounded-lg border border-desktop-border bg-desktop-surface px-3 py-2 text-[12px] font-medium text-desktop-text-secondary transition-colors hover:bg-desktop-surface-muted hover:text-desktop-text-primary"
              >
                {loading ? t.common.loading : t.common.refresh}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreateError(null);
                  setShowCreateModal(true);
                }}
                data-testid="kanban-bg-agent-add-btn"
                className="rounded-lg bg-desktop-accent px-3 py-2 text-[12px] font-medium text-desktop-accent-text transition-colors hover:bg-desktop-accent-strong"
              >
                {t.kanbanBgAgent.addBgAgent}
              </button>
            </div>
          </div>

          <div data-testid="kanban-bg-agent-content" className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: t.kanbanBgAgent.workspaceAgents, value: groupedAgents.length, tone: "border border-[var(--dt-status-info)]/25 bg-[var(--dt-status-info-subtle)] text-[var(--dt-status-info)]" },
                { label: t.kanbanBgAgent.activeAgents, value: activeAgents, tone: "border border-[var(--dt-status-success)]/25 bg-[var(--dt-status-success-subtle)] text-[var(--dt-status-success)]" },
                { label: t.kanbanBgAgent.queueRoutes, value: groupedRoutes.length, tone: "border border-[var(--dt-status-info)]/25 bg-[var(--dt-status-info-subtle)] text-[var(--dt-status-info)]" },
                { label: t.kanbanBgAgent.pendingTasks, value: pendingTasks, tone: "border border-[var(--dt-status-warning)]/25 bg-[var(--dt-status-warning-subtle)] text-[var(--dt-status-warning)]" },
              ].map((item) => (
                <div key={item.label} className={`rounded-xl px-3 py-2 ${item.tone}`}>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-75">{item.label}</div>
                  <div className="mt-1 text-xl font-semibold tabular-nums">{item.value}</div>
                </div>
              ))}
            </div>

            {error && (
              <div className="rounded-xl border border-desktop-danger-border bg-desktop-danger-subtle px-3 py-2 text-[12px] text-desktop-danger-text">
                {error}
              </div>
            )}

            {agents.length === 0 && groupedRoutes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-desktop-border bg-desktop-surface-muted px-5 py-8 text-center">
                <div className="text-[13px] font-medium text-desktop-text-primary">{t.kanbanBgAgent.noAgentsYet}</div>
                <p className="mt-1 text-[12px] text-desktop-text-secondary">
                  {t.kanbanBgAgent.noAgentsHint}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-desktop-border bg-desktop-surface-muted px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[12px] font-semibold text-desktop-text-primary">{t.kanbanBgAgent.observedTargets}</div>
                      <div className="text-[11px] text-desktop-text-tertiary">{groupedRoutes.length} {t.kanbanBgAgent.routesCount}</div>
                    </div>
                    <p className="mt-1 text-[11px] text-desktop-text-secondary">
                      {t.kanbanBgAgent.observedTargetsDesc}
                    </p>

                    <div className="mt-3 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                      {groupedRoutes.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-desktop-border px-3 py-6 text-center text-[12px] text-desktop-text-tertiary">
                          {t.kanbanBgAgent.noQueueActivity}
                        </div>
                      ) : (
                        groupedRoutes.map((route) => {
                          const linked = !unlinkedRoutes.some((item) => item.agentId === route.agentId);
                          return (
                            <article
                              key={route.routeKey}
                              className="rounded-2xl border border-desktop-border bg-desktop-surface-elevated px-4 py-3 shadow-[var(--dt-shadow-sm)]"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate font-mono text-[11px] text-desktop-text-primary">
                                    {route.routeLabel}
                                  </div>
                                  {route.scheduleTriggerIds.length > 0 && (
                                    <div className="mt-1 text-[10px] text-desktop-text-tertiary">
                                      {t.kanbanBgAgent.scheduleTriggers}: {route.scheduleTriggerIds.length}
                                    </div>
                                  )}
                                </div>
                                <span
                                  className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${linked
                                    ? "border border-[var(--dt-status-success)]/25 bg-[var(--dt-status-success-subtle)] text-[var(--dt-status-success)]"
                                    : "border border-desktop-border bg-desktop-surface-muted text-desktop-text-secondary"
                                    }`}
                                >
                                  {linked ? t.kanbanBgAgent.linked : t.kanbanBgAgent.external}
                                </span>
                              </div>
                              <div className="mt-3 grid grid-cols-3 gap-2">
                                {[
                                  { label: t.kanbanBgAgent.all, value: route.total },
                                  { label: t.kanbanBgAgent.pending, value: route.pending },
                                  { label: t.kanbanBgAgent.running, value: route.running },
                                ].map((item) => (
                                  <div key={item.label} className="rounded-xl bg-desktop-surface-muted px-2 py-1.5 text-center">
                                    <div className="text-[9px] uppercase tracking-[0.12em] text-desktop-text-tertiary">{item.label}</div>
                                    <div className="mt-1 text-[13px] font-semibold text-desktop-text-primary tabular-nums">{item.value}</div>
                                  </div>
                                ))}
                              </div>
                              <div className="mt-3 rounded-xl border border-dashed border-desktop-border px-3 py-2 text-[11px] text-desktop-text-secondary">
                                <span className="font-medium text-desktop-text-primary">{t.kanbanBgAgent.latestTask}</span>
                                <div className="mt-1">
                                  {route.latestTask ? `${route.latestTask.title} · ${formatRelativeTime(route.latestTask.createdAt)}` : t.kanbanBgAgent.noRecentTask}
                                </div>
                              </div>
                            </article>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[12px] font-semibold text-desktop-text-primary">{t.kanbanBgAgent.workspaceBgAgents}</div>
                      <div className="text-[11px] text-desktop-text-tertiary">
                        {activeAgents} {t.kanbanBgAgent.activeHotRoutes.replace('{hotRoutes}', String(runningRoutes))}
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                      {agentCards.map(({ agent, total, pending, running, completed, failed, latestTask }) => {
                        const displayId = agent.ids[0] ?? "";
                        const extra = Math.max(agent.count - 1, 0);
                        return (
                          <article
                            key={agent.key}
                            data-testid="kanban-bg-agent-card"
                            className="rounded-2xl border border-desktop-border bg-desktop-surface-elevated px-4 py-3 shadow-[var(--dt-shadow-sm)]"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="truncate text-[13px] font-semibold text-desktop-text-primary">{agent.name}</div>
                                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] ${roleClass(agent.role)}`}>
                                    {agent.role}
                                  </span>
                                </div>
                                <div className="mt-1 truncate font-mono text-[10px] text-desktop-text-tertiary">
                                  {displayId}
                                  {extra > 0 && ` +${extra} more`}
                                </div>
                              </div>
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${statusClass(agent.status)}`}>
                                {agent.status}
                              </span>
                            </div>

                            <div className="mt-3 grid grid-cols-4 gap-2">
                              {[
                                { label: t.kanbanBgAgent.all, value: total },
                                { label: t.kanbanBgAgent.pending, value: pending },
                                { label: t.kanbanBgAgent.running, value: running },
                                { label: t.kanbanBgAgent.finished, value: completed + failed },
                              ].map((item) => (
                                <div key={item.label} className="rounded-xl bg-desktop-surface-muted px-2 py-1.5 text-center">
                                  <div className="text-[9px] uppercase tracking-[0.12em] text-desktop-text-tertiary">{item.label}</div>
                                  <div className="mt-1 text-[13px] font-semibold text-desktop-text-primary tabular-nums">{item.value}</div>
                                </div>
                              ))}
                            </div>

                            <div className="mt-3 rounded-xl border border-dashed border-desktop-border px-3 py-2 text-[11px] text-desktop-text-secondary">
                              {latestTask ? (
                                <>
                                  <div className="font-medium text-desktop-text-primary">{latestTask.title}</div>
                                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                    <span className="capitalize">{latestTask.status.toLowerCase()}</span>
                                    <span>·</span>
                                    <span>{formatRelativeTime(latestTask.createdAt)}</span>
                                  </div>
                                </>
                              ) : (
                                <span>{t.kanbanBgAgent.noTaskRouted}</span>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCreateModal(false)} aria-hidden="true" />
          <div className="relative w-full max-w-md rounded-2xl border border-desktop-border bg-desktop-surface-elevated p-5 shadow-[var(--dt-shadow-lg)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-desktop-text-primary">{t.kanbanBgAgent.addBgAgentTitle}</h3>
                <p className="mt-1 text-[12px] text-desktop-text-secondary">
                  {t.kanbanBgAgent.addBgAgentDesc}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-md p-1 text-desktop-text-tertiary transition-colors hover:bg-desktop-surface-muted hover:text-desktop-text-primary"
                aria-label={t.common.close}
              >
                <X className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}/>
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-desktop-text-secondary">{t.kanbanBgAgent.agentName}</label>
                <input
                  data-testid="kanban-bg-agent-name-input"
                  type="text"
                  value={createForm.name}
                  onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder={t.kanbanBgAgent.agentNamePlaceholder}
                  className="w-full rounded-xl border border-desktop-border bg-desktop-surface-muted px-3 py-2 text-[13px] text-desktop-text-primary placeholder:text-desktop-text-tertiary focus:border-desktop-accent focus:outline-none focus:ring-2 focus:ring-[var(--dt-focus-ring)]/25"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-desktop-text-secondary">{t.kanbanBgAgent.role}</label>
                  <select
                    value={createForm.role}
                    onChange={(event) => setCreateForm((current) => ({ ...current, role: event.target.value }))}
                    className="w-full rounded-xl border border-desktop-border bg-desktop-surface-muted px-3 py-2 text-[13px] text-desktop-text-primary focus:border-desktop-accent focus:outline-none focus:ring-2 focus:ring-[var(--dt-focus-ring)]/25"
                  >
                    <option value="DEVELOPER">DEVELOPER</option>
                    <option value="CRAFTER">CRAFTER</option>
                    <option value="GATE">GATE</option>
                    <option value="ROUTA">ROUTA</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-desktop-text-secondary">{t.kanbanBgAgent.modelTier}</label>
                  <select
                    value={createForm.modelTier}
                    onChange={(event) => setCreateForm((current) => ({ ...current, modelTier: event.target.value }))}
                    className="w-full rounded-xl border border-desktop-border bg-desktop-surface-muted px-3 py-2 text-[13px] text-desktop-text-primary focus:border-desktop-accent focus:outline-none focus:ring-2 focus:ring-[var(--dt-focus-ring)]/25"
                  >
                    <option value="FAST">FAST</option>
                    <option value="BALANCED">BALANCED</option>
                    <option value="SMART">SMART</option>
                  </select>
                </div>
              </div>

              {createError && (
                <div className="rounded-xl border border-desktop-danger-border bg-desktop-danger-subtle px-3 py-2 text-[12px] text-desktop-danger-text">
                  {createError}
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg px-3 py-2 text-[12px] font-medium text-desktop-text-secondary transition-colors hover:bg-desktop-surface-muted hover:text-desktop-text-primary"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={() => void handleCreateAgent()}
                disabled={creating}
                data-testid="kanban-bg-agent-submit-btn"
                className="rounded-lg bg-desktop-accent px-3 py-2 text-[12px] font-medium text-desktop-accent-text transition-colors hover:bg-desktop-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating ? t.kanbanBgAgent.creating : t.kanbanBgAgent.createAgent}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
