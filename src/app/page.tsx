"use client";

/**
 * Home - /
 * Workspace-first landing page for selecting a workspace, connecting providers, and entering recent sessions or team runs.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import type { RepoSelection } from "@/client/components/repo-picker";
import { RepoPicker } from "@/client/components/repo-picker";
import { OnboardingCard } from "@/client/components/home-page-sections";
import {
  SettingsPanel,
  loadDefaultProviders,
  loadDockerOpencodeAuthJson,
  loadProviderConnections,
} from "@/client/components/settings-panel";
import { DesktopAppShell } from "@/client/components/desktop-app-shell";
import { WorkspaceSwitcher } from "@/client/components/workspace-switcher";
import { useAcp } from "@/client/hooks/use-acp";
import { useCodebases, useWorkspaces } from "@/client/hooks/use-workspaces";
import { desktopAwareFetch } from "@/client/utils/diagnostics";
import { loadCustomAcpProviders } from "@/client/utils/custom-acp-providers";
import { collectAccessibleRepoPaths } from "@/client/utils/repo-validation";
import {
  clearOnboardingState,
  ONBOARDING_COMPLETED_KEY,
  ONBOARDING_MODE_KEY,
  hasSavedProviderConfiguration,
  parseOnboardingMode,
  type OnboardingMode,
} from "@/client/utils/onboarding";
import { useTranslation } from "@/i18n";
import type { SessionInfo } from "@/app/workspace/[workspaceId]/types";

interface WorkspaceHomeData {
  sessions: SessionInfo[];
}

const EMPTY_HOME_DATA: WorkspaceHomeData = {
  sessions: [],
};

function formatRelativeTime(value: string | undefined, hydrated: boolean) {
  if (!value) return "刚刚";
  if (!hydrated) return "刚刚";
  const diffMs = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

function getSessionLabel(session: SessionInfo) {
  if (session.name) return session.name;
  if (session.provider && session.role) return `${session.provider} · ${session.role.toLowerCase()}`;
  if (session.provider) return session.provider;
  return `会话 ${session.sessionId.slice(0, 8)}`;
}

function isTopLevelTeamRun(session: SessionInfo) {
  if (session.parentSessionId) return false;
  if (session.specialistId === "team-agent-lead") return true;
  if (session.role?.toUpperCase() !== "ROUTA") return false;

  const normalizedName = (session.name ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!normalizedName) return false;

  return (
    normalizedName.startsWith("team -")
    || normalizedName.startsWith("team run")
    || normalizedName.includes("team lead")
  );
}

function HomePageContent() {
  const router = useRouter();
  const workspacesHook = useWorkspaces();
  const acp = useAcp();
  const { t } = useTranslation();
  const searchParams = useSearchParams();

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<"providers" | "roles" | "specialists" | undefined>(undefined);
  const [preferredMode, setPreferredMode] = useState<OnboardingMode | null>(null);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [workspaceHomeData, setWorkspaceHomeData] = useState<Record<string, WorkspaceHomeData>>({});
  const [_recentSessionsLoading, setRecentSessionsLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const { codebases, fetchCodebases } = useCodebases(activeWorkspaceId ?? "");
  const [showRepoPickerForHome, setShowRepoPickerForHome] = useState(false);
  const [accessibleCodebasePaths, setAccessibleCodebasePaths] = useState<Set<string>>(new Set());

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!acp.connected && !acp.loading) {
      acp.connect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acp.connected, acp.loading]);

  useEffect(() => {
    const requestedWorkspaceId = searchParams.get("workspace");
    if (requestedWorkspaceId && workspacesHook.workspaces.some((workspace) => workspace.id === requestedWorkspaceId)) {
      if (activeWorkspaceId !== requestedWorkspaceId) {
        setActiveWorkspaceId(requestedWorkspaceId);
      }
      return;
    }

    if (!activeWorkspaceId && workspacesHook.workspaces.length > 0) {
      // Restore last-used workspace from localStorage (saved by WorkspaceSwitcher)
      const lastWorkspaceId = typeof window !== "undefined"
        ? window.localStorage.getItem("routa.desktop.last-workspace-id")
        : null;
      if (lastWorkspaceId && workspacesHook.workspaces.some((w) => w.id === lastWorkspaceId)) {
        setActiveWorkspaceId(lastWorkspaceId);
      } else {
        setActiveWorkspaceId(workspacesHook.workspaces[0].id);
      }
    }
  }, [activeWorkspaceId, searchParams, workspacesHook.workspaces]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setOnboardingCompleted(window.localStorage.getItem(ONBOARDING_COMPLETED_KEY) === "true");
    setPreferredMode(parseOnboardingMode(window.localStorage.getItem(ONBOARDING_MODE_KEY)));
  }, []);

  useEffect(() => {
    if (!activeWorkspaceId || workspaceHomeData[activeWorkspaceId]) {
      return;
    }

    let cancelled = false;
    setRecentSessionsLoading(true);

    (async () => {
      try {
        const sessionsRes = await desktopAwareFetch(
          `/api/sessions?workspaceId=${encodeURIComponent(activeWorkspaceId)}&limit=6`,
          { cache: "no-store" },
        );

        const sessionsData = await sessionsRes.json().catch(() => ({}));

        if (cancelled) return;

        setWorkspaceHomeData((current) => ({
          ...current,
          [activeWorkspaceId]: {
            sessions: Array.isArray(sessionsData?.sessions) ? sessionsData.sessions : [],
          },
        }));
      } catch {
        if (cancelled) return;
        setWorkspaceHomeData((current) => ({
          ...current,
          [activeWorkspaceId]: EMPTY_HOME_DATA,
        }));
      } finally {
        if (!cancelled) {
          setRecentSessionsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, workspaceHomeData]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const nextPaths = await collectAccessibleRepoPaths(codebases.map((codebase) => codebase.repoPath));
      if (!cancelled) {
        setAccessibleCodebasePaths(nextPaths);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [codebases]);

  const handleWorkspaceCreate = useCallback(async (title: string) => {
    const workspace = await workspacesHook.createWorkspace(title);
    if (workspace) {
      setActiveWorkspaceId(workspace.id);
      return true;
    }
    return false;
  }, [workspacesHook]);

  const handleWorkspaceDelete = useCallback(async (workspaceId: string) => {
    await workspacesHook.deleteWorkspace(workspaceId);
    // Clear active workspace if it was deleted
    if (activeWorkspaceId === workspaceId) {
      const remaining = workspacesHook.workspaces.filter((w) => w.id !== workspaceId);
      setActiveWorkspaceId(remaining.length > 0 ? remaining[0].id : null);
    }
  }, [workspacesHook, activeWorkspaceId]);

  const handleOpenProviders = useCallback(() => {
    setSettingsInitialTab("providers");
    setShowSettingsPanel(true);
  }, []);

  const handleModeSelect = useCallback((mode: OnboardingMode) => {
    setPreferredMode(mode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ONBOARDING_MODE_KEY, mode);
    }
  }, []);

  const handleDismissOnboarding = useCallback(() => {
    setOnboardingCompleted(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ONBOARDING_COMPLETED_KEY, "true");
    }
  }, []);

  const handleResetOnboarding = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    clearOnboardingState(window.localStorage);
    setOnboardingCompleted(false);
    setPreferredMode(null);
  }, []);

  const handleAddCodebase = useCallback(async (selection: RepoSelection) => {
    const targetWorkspaceId = activeWorkspaceId ?? workspacesHook.workspaces[0]?.id;
    if (!targetWorkspaceId) {
      return false;
    }

    const response = await desktopAwareFetch(`/api/workspaces/${encodeURIComponent(targetWorkspaceId)}/codebases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repoPath: selection.path,
        branch: selection.branch || undefined,
        label: selection.name || undefined,
      }),
    });

    if (response.ok) {
      await fetchCodebases();
      return true;
    }

    const data = await response.json().catch(() => ({}));
    return data?.error ?? false;
  }, [activeWorkspaceId, fetchCodebases, workspacesHook.workspaces]);

  const activeWorkspace = workspacesHook.workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;
  const requestedSurfaceId = searchParams.get("mode");
  const activeData = activeWorkspaceId ? (workspaceHomeData[activeWorkspaceId] ?? EMPTY_HOME_DATA) : EMPTY_HOME_DATA;
  const recentSessions = useMemo(() => (
    [...activeData.sessions]
      .filter((session) => !isTopLevelTeamRun(session))
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 3)
  ), [activeData.sessions]);
  const latestSession = recentSessions[0] ?? null;
  const hasCodebase = codebases.some((codebase) => accessibleCodebasePaths.has(codebase.repoPath));

  const hasWorkspace = workspacesHook.workspaces.length > 0;
  const hasProviderConfig =
    hydrated
      ? hasSavedProviderConfiguration(loadDefaultProviders(), loadProviderConnections(), {
        dockerOpencodeAuthJson: loadDockerOpencodeAuthJson(),
        customProviderCount: loadCustomAcpProviders().length,
        runtimeProviderCount: acp.providers.filter((provider) => provider.status === "available").length,
      })
      : false;
  const availableProviderNames = useMemo(
    () => acp.providers
      .filter((provider) => provider.status === "available")
      .map((provider) => provider.name)
      .slice(0, 3),
    [acp.providers],
  );
  // Show onboarding until the user explicitly dismisses it.
  // Individual step completion (provider, codebase, mode) is rendered
  // inside OnboardingCard — no need to auto-hide based on step status.
  const needsInlineOnboarding = hasWorkspace && !onboardingCompleted;
  const consoleCardClass =
    "flex h-full flex-col rounded-[var(--dt-radius-lg)] border border-desktop-border bg-desktop-surface p-5 text-left shadow-[var(--dt-shadow-sm)] transition-colors hover:bg-desktop-surface-muted";
  const consolePanelClass =
    "rounded-[var(--dt-radius-lg)] border border-desktop-border bg-desktop-surface px-5 py-4 shadow-[var(--dt-shadow-sm)]";
  const consoleMetaClass =
    "text-[11px] font-medium uppercase tracking-[0.18em] text-desktop-text-tertiary";

  useEffect(() => {
    if (!activeWorkspaceId || !requestedSurfaceId) return;

    if (requestedSurfaceId === "session") {
      router.replace(`/workspace/${activeWorkspaceId}/sessions`);
      return;
    }

    if (requestedSurfaceId === "team") {
      router.replace(`/workspace/${activeWorkspaceId}/team`);
      return;
    }

    if (requestedSurfaceId === "planning") {
      router.replace(`/workspace/${activeWorkspaceId}/kanban`);
    }
  }, [activeWorkspaceId, requestedSurfaceId, router]);

  return (
    <DesktopAppShell
      workspaceId={activeWorkspaceId}
      workspaceTitle={activeWorkspace?.title ?? undefined}
      workspaceSwitcher={(
        <WorkspaceSwitcher
          workspaces={workspacesHook.workspaces}
          activeWorkspaceId={activeWorkspaceId}
          activeWorkspaceTitle={activeWorkspace?.title ?? undefined}
          onSelect={setActiveWorkspaceId}
          onCreate={async (title) => {
            await handleWorkspaceCreate(title);
          }}
          onDelete={handleWorkspaceDelete}
          loading={workspacesHook.loading}
          compact
          desktop
        />
      )}
    >
        <div className="flex h-full min-h-0 bg-desktop-bg-primary">
          <main className="flex min-w-0 flex-1 flex-col">
            {!hasWorkspace ? (
              <div className="flex min-h-0 flex-1 items-center justify-center p-6">
                <OnboardingCard
                  hasWorkspace={false}
                  workspaceTitle={null}
                  hasProviderConfig={hasProviderConfig}
                  hasCodebase={false}
                  availableProviderNames={availableProviderNames}
                  preferredMode={preferredMode}
                  onCreateWorkspace={handleWorkspaceCreate}
                  onOpenProviders={handleOpenProviders}
                  onAddCodebase={handleAddCodebase}
                  onSelectMode={handleModeSelect}
                />
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto flex h-full w-full max-w-6xl flex-col px-6 py-8 lg:px-10 lg:py-10">
                  {workspacesHook.loading ? (
                    <div className="flex flex-1 items-center justify-center text-sm text-desktop-text-secondary">
                      {t.home.loadingWorkspaces}
                    </div>
                  ) : (
                    <section className="flex flex-1 flex-col justify-center gap-6">
                      {/* Hero */}
                      <div className="text-center">
                        <div className="text-sm font-medium text-desktop-text-secondary">
                          {activeWorkspace?.title ?? t.common.workspace}
                        </div>
                        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-desktop-text-primary sm:text-5xl">
                          {t.home.whatToAdvance}
                        </h1>
                        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-desktop-text-secondary">
                          {t.home.homePrimaryHint}
                        </p>
                      </div>

                      {/* Onboarding hint (if needed) */}
                      {needsInlineOnboarding && (
                        <OnboardingCard
                          hasWorkspace
                          workspaceTitle={activeWorkspace?.title ?? null}
                          hasProviderConfig={hasProviderConfig}
                          hasCodebase={hasCodebase}
                          availableProviderNames={availableProviderNames}
                          preferredMode={preferredMode}
                          onCreateWorkspace={handleWorkspaceCreate}
                          onOpenProviders={handleOpenProviders}
                          onAddCodebase={handleAddCodebase}
                          onSelectMode={handleModeSelect}
                          onDismiss={handleDismissOnboarding}
                        />
                      )}

                      {activeWorkspaceId ? (
                        <div className="grid gap-4 sm:grid-cols-3">
                          <Link
                            href={`/workspace/${activeWorkspaceId}/sessions`}
                            className={consoleCardClass}
                          >
                            <div className={consoleMetaClass}>
                              {t.home.surfaceLabel}
                            </div>
                            <div className="mt-2 text-lg font-semibold text-desktop-text-primary">
                              {t.home.sessionsSurfaceTitle}
                            </div>
                            <div className="mt-2 text-sm leading-6 text-desktop-text-secondary">
                              {t.home.modeSessionDescription}
                            </div>
                            <div className="mt-4 border-t border-desktop-border pt-3">
                              <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-desktop-text-tertiary">
                                {t.home.modeTechnicalLabel}
                              </div>
                              <div className="mt-1 text-xs leading-5 text-desktop-text-muted">
                                {t.home.modeSessionTechnical}
                              </div>
                            </div>
                          </Link>
                          <Link
                            href={`/workspace/${activeWorkspaceId}/kanban`}
                            className={consoleCardClass}
                          >
                            <div className={consoleMetaClass}>
                              {t.home.surfaceLabel}
                            </div>
                            <div className="mt-2 text-lg font-semibold text-desktop-text-primary">
                              {t.home.kanbanSurfaceTitle}
                            </div>
                            <div className="mt-2 text-sm leading-6 text-desktop-text-secondary">
                              {t.home.modeKanbanDescription}
                            </div>
                            <div className="mt-4 border-t border-desktop-border pt-3">
                              <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-desktop-text-tertiary">
                                {t.home.modeTechnicalLabel}
                              </div>
                              <div className="mt-1 text-xs leading-5 text-desktop-text-muted">
                                {t.home.modeKanbanTechnical}
                              </div>
                            </div>
                          </Link>
                          <Link
                            href={`/workspace/${activeWorkspaceId}/team`}
                            className={consoleCardClass}
                          >
                            <div className={consoleMetaClass}>
                              {t.home.surfaceLabel}
                            </div>
                            <div className="mt-2 text-lg font-semibold text-desktop-text-primary">
                              {t.home.teamSurfaceTitle}
                            </div>
                            <div className="mt-2 text-sm leading-6 text-desktop-text-secondary">
                              {t.home.modeTeamDescription}
                            </div>
                            <div className="mt-4 border-t border-desktop-border pt-3">
                              <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-desktop-text-tertiary">
                                {t.home.modeTechnicalLabel}
                              </div>
                              <div className="mt-1 text-xs leading-5 text-desktop-text-muted">
                                {t.home.modeTeamTechnical}
                              </div>
                            </div>
                          </Link>
                        </div>
                      ) : null}

                      {/* Readiness checklist */}
                      <div className={consolePanelClass}>
                        <div className={consoleMetaClass}>
                          {t.home.readinessTitle}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={handleOpenProviders}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                              hasProviderConfig
                                ? "border-[var(--dt-status-success)]/25 bg-[var(--dt-status-success-subtle)] text-[var(--dt-status-success)]"
                                : "border-[var(--dt-status-warning)]/25 bg-[var(--dt-status-warning-subtle)] text-[var(--dt-status-warning)] hover:bg-desktop-bg-active"
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${hasProviderConfig ? "bg-[var(--dt-status-success)]" : "bg-[var(--dt-status-warning)]"}`} />
                            {t.home.readinessModel}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowRepoPickerForHome(true)}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                              hasCodebase
                                ? "border-[var(--dt-status-success)]/25 bg-[var(--dt-status-success-subtle)] text-[var(--dt-status-success)]"
                                : "border-[var(--dt-status-warning)]/25 bg-[var(--dt-status-warning-subtle)] text-[var(--dt-status-warning)] hover:bg-desktop-bg-active"
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${hasCodebase ? "bg-[var(--dt-status-success)]" : "bg-[var(--dt-status-warning)]"}`} />
                            {t.home.readinessCodebase}
                          </button>
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--dt-status-success)]/25 bg-[var(--dt-status-success-subtle)] px-3 py-1.5 text-[11px] font-medium text-[var(--dt-status-success)]"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--dt-status-success)]" />
                            {t.home.readinessWorkspace}
                          </span>
                        </div>
                        {showRepoPickerForHome && (
                          <div className="mt-4 border-t border-desktop-border pt-4">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-[11px] font-medium text-desktop-text-secondary">
                                {t.home.readinessCodebase}
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowRepoPickerForHome(false)}
                                className="text-[11px] text-desktop-text-tertiary hover:text-desktop-text-primary"
                              >
                                {t.common.cancel}
                              </button>
                            </div>
                            <RepoPicker
                              value={null}
                              onChange={async (selection) => {
                                if (selection) {
                                  await handleAddCodebase(selection);
                                  setShowRepoPickerForHome(false);
                                }
                              }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Continue recent work */}
                      {(recentSessions.length > 0 || activeWorkspaceId) && (
                        <div className={consolePanelClass}>
                          <div className={consoleMetaClass}>
                            {t.home.continueWork}
                          </div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {activeWorkspaceId && (
                              <Link
                                href={`/workspace/${activeWorkspaceId}/sessions`}
                                className="flex flex-col rounded-[var(--dt-radius-md)] border border-desktop-border bg-desktop-surface-muted p-4 transition-colors hover:bg-desktop-bg-active"
                              >
                                <div className="text-sm font-semibold text-desktop-text-primary">
                                  {t.nav.sessions}
                                </div>
                                <div className="mt-1 text-[11px] text-desktop-text-secondary">
                                  {t.workspace.recoverSession}
                                </div>
                              </Link>
                            )}
                            {activeWorkspaceId && (
                              <Link
                                href={`/workspace/${activeWorkspaceId}/kanban`}
                                className="flex flex-col rounded-[var(--dt-radius-md)] border border-desktop-border bg-desktop-surface-muted p-4 transition-colors hover:bg-desktop-bg-active"
                              >
                                <div className="text-sm font-semibold text-desktop-text-primary">
                                  {t.home.continueBoard}
                                </div>
                                <div className="mt-1 text-[11px] text-desktop-text-secondary">
                                  {activeWorkspace?.title ?? t.common.workspace}
                                </div>
                              </Link>
                            )}
                            {latestSession && (
                              <Link
                                href={`/workspace/${latestSession.workspaceId}/sessions/${latestSession.sessionId}`}
                                className="flex flex-col rounded-[var(--dt-radius-md)] border border-desktop-border bg-desktop-surface-muted p-4 transition-colors hover:bg-desktop-bg-active"
                              >
                                <div className="truncate text-sm font-semibold text-desktop-text-primary">
                                  {getSessionLabel(latestSession)}
                                </div>
                                <div className="mt-1 text-[11px] text-desktop-text-secondary">
                                  {formatRelativeTime(latestSession.createdAt, hydrated)}
                                </div>
                              </Link>
                            )}
                          </div>
                        </div>
                      )}
                    </section>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>

        <SettingsPanel
          open={showSettingsPanel}
          onClose={() => setShowSettingsPanel(false)}
          providers={acp.providers}
          initialTab={settingsInitialTab}
          onResetOnboarding={handleResetOnboarding}
        />
      </DesktopAppShell>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={(
      <div className="desktop-theme flex h-screen items-center justify-center bg-desktop-bg-primary">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-desktop-accent border-t-transparent" />
          <p className="text-sm text-desktop-text-secondary">Loading...</p>
        </div>
      </div>
    )}>
      <HomePageContent />
    </Suspense>
  );
}
