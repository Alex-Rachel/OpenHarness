"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PieChart } from "lucide-react";

import { HomeInput } from "@/client/components/home-input";
import { useWorkspaceContext } from "../workspace-context";
import { desktopAwareFetch } from "@/client/utils/diagnostics";
import { useTranslation } from "@/i18n";

import { SessionsOverview } from "../sessions-overview";
import type { SessionInfo } from "../types";
import { formatRelativeTime } from "../ui-components";

const TEAM_LEAD_SPECIALIST_ID = "team-agent-lead";

function isTopLevelTeamRun(session: SessionInfo): boolean {
  if (session.parentSessionId) return false;
  if (session.specialistId === TEAM_LEAD_SPECIALIST_ID) return true;
  if (session.role?.toUpperCase() !== "ROUTA") return false;

  const normalizedName = (session.name ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!normalizedName) return false;

  return (
    normalizedName.startsWith("team -")
    || normalizedName.startsWith("team run")
    || normalizedName.includes("team lead")
  );
}

function getSessionLabel(session: SessionInfo) {
  if (session.name) return session.name;
  if (session.provider && session.role) return `${session.provider} · ${session.role.toLowerCase()}`;
  if (session.provider) return session.provider;
  return `Session ${session.sessionId.slice(0, 8)}`;
}

export function SessionsPageClient() {
  const { t } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const rawWorkspaceId = params.workspaceId as string;
  const workspaceId =
    rawWorkspaceId === "__placeholder__" && typeof window !== "undefined"
      ? (window.location.pathname.match(/^\/workspace\/([^/]+)/)?.[1] ?? rawWorkspaceId)
      : rawWorkspaceId;

  const { workspaces, loading } = useWorkspaceContext();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const shouldShowSession = useCallback((session: SessionInfo & { parentSessionId?: string }) => !isTopLevelTeamRun(session), []);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await desktopAwareFetch(`/api/sessions?workspaceId=${encodeURIComponent(workspaceId)}&limit=100`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await res.json();
        if (controller.signal.aborted) return;
        setSessions(Array.isArray(data?.sessions) ? data.sessions : []);
      } catch {
        if (controller.signal.aborted) return;
        setSessions([]);
      }
    })();
    return () => controller.abort();
  }, [workspaceId, refreshKey]);

  const visibleSessions = useMemo(() => (
    [...sessions]
      .filter(shouldShowSession)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
  ), [sessions, shouldShowSession]);

  const workspace = workspaces.find((item) => item.id === workspaceId);
  const latestSession = visibleSessions[0] ?? null;
  const liveSessions = visibleSessions.filter((session) => session.acpStatus === "connecting" || session.acpStatus === "ready").length;

  const handleRefresh = useCallback(() => {
    setRefreshKey((current) => current + 1);
  }, []);

  if (loading && workspaceId !== "default") {
    return (
      <div className="desktop-theme flex h-screen items-center justify-center bg-desktop-bg-primary">
        <div className="flex items-center gap-3 text-desktop-text-secondary">
          <PieChart className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" />
          {t.sessions.loadingSessions}
        </div>
      </div>
    );
  }

  const statPillClass =
    "inline-flex items-center gap-2 rounded-full border border-desktop-border bg-desktop-surface px-4 py-2 text-sm text-desktop-text-secondary shadow-[var(--dt-shadow-sm)]";

  return (
    <div className="flex h-full min-h-0 bg-desktop-bg-primary">
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex h-full w-full max-w-5xl flex-col px-6 py-8 lg:px-10 lg:py-10">
            <section className="flex flex-1 flex-col justify-center">
              <div className="mx-auto w-full max-w-3xl text-center">
                <div className="text-sm font-medium text-desktop-text-secondary">
                  {workspace?.title ?? t.common.workspace}
                </div>
                <h1 className="mt-4 text-5xl font-semibold tracking-[-0.05em] text-desktop-text-primary sm:text-6xl">
                  {t.nav.sessions}
                </h1>
                <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-desktop-text-secondary">
                  {t.workspace.recoverSession}
                </p>
              </div>

              <div className="mx-auto mt-8 flex w-full max-w-3xl flex-wrap items-center justify-center gap-3">
                <div className={statPillClass}>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">{t.workspace.sessions}</span>
                  <span className="text-sm font-semibold text-desktop-text-primary">{visibleSessions.length}</span>
                </div>
                <div className={statPillClass}>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">{t.workspace.active}</span>
                  <span className="text-sm font-semibold text-desktop-text-primary">{liveSessions}</span>
                </div>
                <div className={statPillClass}>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">{t.workspace.latestRecoveryPoint}</span>
                  <span className="text-sm font-semibold text-desktop-text-primary">
                    {latestSession ? formatRelativeTime(latestSession.createdAt) : t.workspace.noRecentSession}
                  </span>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="border-t border-desktop-border bg-desktop-surface/95 px-4 py-4 shadow-[var(--dt-shadow-sm)]">
          <div className="mx-auto w-full max-w-4xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-desktop-text-tertiary">
                  {t.home.modeSessionTitle}
                </div>
                <div className="mt-1 text-sm text-desktop-text-secondary">
                  {t.home.modeSessionDescription}
                </div>
              </div>
              {latestSession ? (
                <button
                  type="button"
                  onClick={() => router.push(`/workspace/${workspaceId}/sessions/${latestSession.sessionId}`)}
                  className="rounded-full border border-desktop-border bg-desktop-surface-muted px-3 py-1.5 text-[11px] font-medium text-desktop-text-secondary transition-colors hover:bg-desktop-bg-active hover:text-desktop-text-primary"
                >
                  {getSessionLabel(latestSession)}
                </button>
              ) : null}
            </div>
            <HomeInput
              workspaceId={workspaceId}
              variant="default"
              displaySkills={[{
                name: "canvas",
                description: t.canvas.liveEntryLabel,
              }]}
              launchModes={[{
                id: "session",
                label: t.home.modeSessionTitle,
                description: t.home.modeSessionDescription,
                placeholder: t.home.modeSessionPlaceholder,
                defaultAgentRole: "ROUTA",
                allowRoleSwitch: true,
                allowCustomSpecialist: true,
                dispatchMode: "pending-prompt",
                buildSessionUrl: (nextWorkspaceId, sessionId) =>
                  `/workspace/${nextWorkspaceId ?? workspaceId}/sessions/${sessionId}`,
              }]}
            />
          </div>
        </div>
      </main>

      <aside className="hidden w-90 shrink-0 border-l border-desktop-border bg-desktop-surface-muted px-4 py-4 xl:flex xl:flex-col">
        <SessionsOverview
          sessions={visibleSessions}
          workspaceId={workspaceId}
          onNavigate={(targetSessionId) => router.push(`/workspace/${workspaceId}/sessions/${targetSessionId}`)}
          onRefresh={handleRefresh}
          filterSession={shouldShowSession}
        />
      </aside>
    </div>
  );
}
