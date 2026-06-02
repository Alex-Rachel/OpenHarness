"use client";

import { useState } from "react";
import { RepoPicker, type RepoSelection } from "@/client/components/repo-picker";
import type { OnboardingMode } from "@/client/utils/onboarding";
import { useTranslation } from "@/i18n";
import { Folder } from "lucide-react";

const ONBOARDING_GITHUB_PLACEHOLDER = "https://github.com/phodal/routa";

export function OnboardingCard({
  hasWorkspace,
  workspaceTitle,
  hasProviderConfig,
  hasCodebase,
  availableProviderNames,
  preferredMode,
  onCreateWorkspace,
  onOpenProviders,
  onAddCodebase,
  onSelectMode,
  onDismiss,
}: {
  hasWorkspace: boolean;
  workspaceTitle?: string | null;
  hasProviderConfig: boolean;
  hasCodebase: boolean;
  availableProviderNames: string[];
  preferredMode: OnboardingMode | null;
  onCreateWorkspace: (title: string) => Promise<boolean>;
  onOpenProviders: () => void;
  onAddCodebase: (selection: RepoSelection) => Promise<boolean | string>;
  onSelectMode: (mode: OnboardingMode) => void;
  onDismiss?: () => void;
}) {
  const { t } = useTranslation();
  const [workspaceName, setWorkspaceName] = useState(t.onboarding.workspaceNamePlaceholder);
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [repoSelection, setRepoSelection] = useState<RepoSelection | null>(null);
  const [codebaseBusy, setCodebaseBusy] = useState(false);
  const [codebaseError, setCodebaseError] = useState<string | null>(null);

  const completeCount = Number(hasProviderConfig) + Number(hasCodebase) + Number(preferredMode !== null);
  const selectedModeLabel =
    preferredMode === "SESSION"
      ? t.onboarding.modeSessionTitle
      : preferredMode === "KANBAN"
        ? t.onboarding.modeKanbanTitle
        : preferredMode === "TEAM"
          ? t.onboarding.modeTeamTitle
          : null;

  const panelClass =
    "rounded-[var(--dt-radius-lg)] border border-desktop-border bg-desktop-surface p-5 shadow-[var(--dt-shadow-sm)] sm:p-6";
  const cardClass =
    "rounded-[var(--dt-radius-lg)] border border-desktop-border bg-desktop-surface-muted p-4";
  const titleClass = "text-sm font-semibold text-desktop-text-primary";
  const bodyClass = "text-sm leading-6 text-desktop-text-secondary";
  const metaClass =
    "text-[11px] font-medium uppercase tracking-[0.18em] text-desktop-text-tertiary";
  const primaryActionClass =
    "rounded-full bg-desktop-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-desktop-accent-text transition-colors hover:bg-desktop-accent-strong disabled:cursor-not-allowed disabled:opacity-60";
  const secondaryActionClass =
    "rounded-full border border-desktop-border px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-desktop-text-secondary transition-colors hover:bg-desktop-surface-muted hover:text-desktop-text-primary";
  const dangerTextClass = "text-[var(--dt-status-danger)]";
  const statusClass = (complete: boolean) =>
    complete
      ? "border-[var(--dt-status-success)]/25 bg-[var(--dt-status-success-subtle)] text-[var(--dt-status-success)]"
      : "border-[var(--dt-status-warning)]/25 bg-[var(--dt-status-warning-subtle)] text-[var(--dt-status-warning)]";
  const modeOptionClass = (active: boolean) =>
    `rounded-[var(--dt-radius-md)] border px-4 py-3 text-left transition-colors ${
      active
        ? "border-desktop-accent bg-desktop-bg-active"
        : "border-desktop-border bg-desktop-surface hover:bg-desktop-bg-active"
    }`;

  const handleWorkspaceCreate = async () => {
    const title = workspaceName.trim();
    if (!title || workspaceBusy) {
      return;
    }

    setWorkspaceBusy(true);
    setWorkspaceError(null);
    const created = await onCreateWorkspace(title);
    if (!created) {
      setWorkspaceError(t.errors.saveFailed);
    }
    setWorkspaceBusy(false);
  };

  const handleAddCodebase = async () => {
    if (!repoSelection || codebaseBusy) {
      return;
    }

    setCodebaseBusy(true);
    setCodebaseError(null);
    const result = await onAddCodebase(repoSelection);
    if (result === true) {
      setRepoSelection(null);
    } else {
      setCodebaseError(typeof result === "string" ? result : t.errors.saveFailed);
    }
    setCodebaseBusy(false);
  };

  if (!hasWorkspace) {
    return (
      <div className="w-full max-w-xl rounded-[var(--dt-radius-lg)] border border-desktop-border bg-desktop-surface px-8 py-10 shadow-[var(--dt-shadow-md)]">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-[var(--dt-radius-md)] border border-desktop-border bg-desktop-accent text-desktop-accent-text shadow-[var(--dt-shadow-sm)]">
          <Folder className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} />
        </div>
        <h2 className="mb-1.5 text-center text-[2rem] font-semibold tracking-[-0.05em] text-desktop-text-primary">
          {t.onboarding.title}
        </h2>
        <p className="mb-6 text-center text-sm leading-7 text-desktop-text-secondary">
          {t.onboarding.description}
        </p>
        <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-desktop-text-tertiary">
          {t.onboarding.workspaceNameLabel}
        </label>
        <input
          type="text"
          value={workspaceName}
          onChange={(event) => setWorkspaceName(event.target.value)}
          placeholder={t.onboarding.workspaceNamePlaceholder}
          className="w-full rounded-[var(--dt-radius-md)] border border-desktop-border bg-desktop-surface px-4 py-3 text-sm text-desktop-text-primary shadow-[var(--dt-shadow-sm)] outline-none transition-colors placeholder:text-desktop-text-muted focus:border-desktop-accent focus:ring-2 focus:ring-[var(--dt-focus-ring)]/20"
        />
        {workspaceError ? <p className={`mt-2 text-sm ${dangerTextClass}`}>{workspaceError}</p> : null}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => void handleWorkspaceCreate()}
            disabled={workspaceBusy || !workspaceName.trim()}
            className={primaryActionClass}
          >
            {workspaceBusy ? t.common.loading : t.onboarding.getStarted}
          </button>
          <button type="button" onClick={onOpenProviders} className={secondaryActionClass}>
            {t.onboarding.openProviders}
          </button>
        </div>
        <div className="mt-6 rounded-[var(--dt-radius-lg)] border border-desktop-border bg-desktop-surface-muted px-4 py-4">
          <div className={metaClass}>{t.onboarding.nextSteps}</div>
          <div className="mt-3 grid gap-2 text-sm text-desktop-text-secondary">
            <p>01. {t.onboarding.providerDescription}</p>
            <p>02. {t.onboarding.codebaseDescription}</p>
            <p>03. {t.onboarding.modeDescription}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className={panelClass}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className={metaClass}>{t.onboarding.checklistTitle}</div>
          <h2 className="mt-2 text-[2rem] font-semibold tracking-[-0.05em] text-desktop-text-primary">
            {workspaceTitle ?? t.onboarding.createWorkspace}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-desktop-text-secondary">
            {t.onboarding.checklistDescription}
          </p>
        </div>
        <div className="rounded-full border border-desktop-border bg-desktop-surface-muted px-4 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-desktop-text-secondary">
          {completeCount}/3 {t.onboarding.completed}
        </div>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-3">
        <div className={cardClass}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className={titleClass}>{t.onboarding.providerTitle}</div>
              <p className={`mt-1 ${bodyClass}`}>{t.onboarding.providerDescription}</p>
            </div>
            <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${statusClass(hasProviderConfig)}`}>
              {hasProviderConfig ? t.onboarding.completed : t.onboarding.pending}
            </span>
          </div>
          {hasProviderConfig ? (
            <div className="mt-4">
              {availableProviderNames.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {availableProviderNames.map((providerName) => (
                    <span
                      key={providerName}
                      className="rounded-full border border-[var(--dt-status-success)]/25 bg-[var(--dt-status-success-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--dt-status-success)]"
                    >
                      {providerName}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="rounded-[var(--dt-radius-md)] border border-[var(--dt-status-success)]/25 bg-[var(--dt-status-success-subtle)] px-3 py-3 text-sm text-[var(--dt-status-success)]">
                  {t.onboarding.providerReady}
                </div>
              )}
              <button
                type="button"
                onClick={onOpenProviders}
                className="mt-3 text-xs font-medium text-desktop-text-secondary transition-colors hover:text-desktop-text-primary"
              >
                {t.onboarding.openProviders}
              </button>
            </div>
          ) : (
            <button type="button" onClick={onOpenProviders} className={`mt-4 ${secondaryActionClass}`}>
              {t.onboarding.providerAction}
            </button>
          )}
        </div>

        <div className={cardClass}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className={titleClass}>{t.onboarding.codebaseTitle}</div>
              <p className={`mt-1 ${bodyClass}`}>{t.onboarding.codebaseDescription}</p>
            </div>
            <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${statusClass(hasCodebase)}`}>
              {hasCodebase ? t.onboarding.completed : t.onboarding.pending}
            </span>
          </div>
          {hasCodebase ? (
            <div className="mt-4 rounded-[var(--dt-radius-md)] border border-[var(--dt-status-success)]/25 bg-[var(--dt-status-success-subtle)] px-3 py-3 text-sm text-[var(--dt-status-success)]">
              {t.onboarding.codebaseReady}
            </div>
          ) : (
            <>
              <div className="mt-4">
                <RepoPicker
                  value={repoSelection}
                  onChange={setRepoSelection}
                  pathDisplay="below-muted"
                  clonePlaceholder={ONBOARDING_GITHUB_PLACEHOLDER}
                />
              </div>
              {codebaseError ? <p className={`mt-2 text-sm ${dangerTextClass}`}>{codebaseError}</p> : null}
              <button
                type="button"
                onClick={() => void handleAddCodebase()}
                disabled={!repoSelection?.path || codebaseBusy}
                className={`mt-4 ${primaryActionClass}`}
              >
                {codebaseBusy ? t.common.loading : t.onboarding.codebaseAction}
              </button>
            </>
          )}
        </div>

        <div className={cardClass}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className={titleClass}>{t.onboarding.modeTitle}</div>
              <p className={`mt-1 ${bodyClass}`}>{t.onboarding.modeDescription}</p>
            </div>
            <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${statusClass(Boolean(preferredMode))}`}>
              {preferredMode ? t.onboarding.completed : t.onboarding.pending}
            </span>
          </div>
          <div className="mt-4 grid gap-2">
            <button type="button" onClick={() => onSelectMode("SESSION")} className={modeOptionClass(preferredMode === "SESSION")}>
              <div className={titleClass}>{t.onboarding.modeSessionTitle}</div>
              <p className={`mt-1 ${bodyClass}`}>{t.onboarding.modeSessionDescription}</p>
            </button>
            <button type="button" onClick={() => onSelectMode("KANBAN")} className={modeOptionClass(preferredMode === "KANBAN")}>
              <div className={titleClass}>{t.onboarding.modeKanbanTitle}</div>
              <p className={`mt-1 ${bodyClass}`}>{t.onboarding.modeKanbanDescription}</p>
            </button>
            <button type="button" onClick={() => onSelectMode("TEAM")} className={modeOptionClass(preferredMode === "TEAM")}>
              <div className={titleClass}>{t.onboarding.modeTeamTitle}</div>
              <p className={`mt-1 ${bodyClass}`}>{t.onboarding.modeTeamDescription}</p>
            </button>
          </div>
          {selectedModeLabel ? (
            <div className="mt-4 rounded-[var(--dt-radius-md)] border border-[var(--dt-status-success)]/25 bg-[var(--dt-status-success-subtle)] px-3 py-3 text-sm text-[var(--dt-status-success)]">
              {t.onboarding.modeReady}: {selectedModeLabel}
            </div>
          ) : null}
        </div>
      </div>

      {onDismiss ? (
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full border border-transparent px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-desktop-text-tertiary transition-colors hover:border-desktop-border hover:text-desktop-text-primary"
          >
            {t.onboarding.continueLater}
          </button>
        </div>
      ) : null}
    </section>
  );
}
