"use client";

import type { CSSProperties } from "react";
import { useDraggable } from "@dnd-kit/core";
import { useTranslation } from "@/i18n";
import type { AcpProviderInfo } from "@/client/acp-client";
import type { CodebaseData } from "@/client/hooks/use-workspaces";
import { resolveEffectiveTaskAutomation } from "@/core/kanban/effective-task-automation";
import { parseCanonicalStory } from "@/core/kanban/canonical-story";
import { formatArtifactLabel, resolveKanbanTransitionArtifacts } from "@/core/kanban/transition-artifacts";
import type { KanbanColumnInfo, SessionInfo, TaskInfo, WorktreeInfo } from "../types";
import { type KanbanSpecialistLanguage } from "./kanban-specialist-language";
import { createKanbanSpecialistResolver } from "./kanban-card-session-utils";
import { GripVertical, Trash2 } from "lucide-react";


const badgeTone = {
  neutral: "bg-desktop-surface-muted text-desktop-text-secondary ring-1 ring-inset ring-desktop-border",
  success: "bg-[var(--dt-status-success-subtle)] text-[var(--dt-status-success)] ring-1 ring-inset ring-[var(--dt-status-success)]/25",
  warning: "bg-[var(--dt-status-warning-subtle)] text-[var(--dt-status-warning)] ring-1 ring-inset ring-[var(--dt-status-warning)]/25",
  danger: "bg-desktop-danger-subtle text-desktop-danger-text ring-1 ring-inset ring-desktop-danger-border",
  info: "bg-[var(--dt-status-info-subtle)] text-[var(--dt-status-info)] ring-1 ring-inset ring-[var(--dt-status-info)]/25",
} as const;

const reviewFeedbackToneClasses = {
  danger: "border-desktop-danger-border bg-desktop-danger-subtle text-desktop-danger-text",
  success: "border-[var(--dt-status-success)]/25 bg-[var(--dt-status-success-subtle)] text-[var(--dt-status-success)]",
  warning: "border-[var(--dt-status-warning)]/25 bg-[var(--dt-status-warning-subtle)] text-[var(--dt-status-warning)]",
} as const;

const cardIconButton =
  "rounded-lg p-1 text-desktop-text-tertiary transition hover:bg-desktop-surface-muted hover:text-desktop-text-primary focus:outline-none focus:ring-2 focus:ring-[var(--dt-focus-ring)]/50";

interface SpecialistOption {
  id: string;
  name: string;
  role: string;
  displayName?: string;
  defaultProvider?: string;
}

export interface KanbanCardProps {
  task: TaskInfo;
  boardColumns: KanbanColumnInfo[];
  linkedSession?: SessionInfo;
  liveMessageTail?: string;
  availableProviders: AcpProviderInfo[];
  specialists: SpecialistOption[];
  specialistLanguage: KanbanSpecialistLanguage;
  codebases: CodebaseData[];
  allCodebaseIds: string[];
  worktreeCache: Record<string, WorktreeInfo>;
  autoProviderId?: string;
  queuePosition?: number;
  onOpenDetail: () => void;
  onDelete: () => void;
  onPatchTask: (taskId: string, payload: Record<string, unknown>) => Promise<TaskInfo>;
  onRetryTrigger: (taskId: string) => Promise<void>;
  onRefresh: () => void;
}

interface KanbanCardSurfaceProps extends KanbanCardProps {
  dragHandleProps?: Record<string, any>;
  dragOverlay?: boolean;
  isDragging?: boolean;
  style?: CSSProperties;
  wrapperRef?: (node: HTMLDivElement | null) => void;
}

function summarizeReviewFeedback(report: string | undefined, maxLength = 180): string | null {
  const normalized = report
    ?.split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");

  if (!normalized) {
    return null;
  }

  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function getPriorityTone(priority?: string) {
  switch ((priority ?? "medium").toLowerCase()) {
    case "high":
    case "urgent":
      return badgeTone.danger;
    case "medium":
      return badgeTone.warning;
    case "low":
      return badgeTone.success;
    default:
      return badgeTone.neutral;
  }
}

function getPrioritySizeLabel(priority?: string) {
  switch ((priority ?? "medium").toLowerCase()) {
    case "high":
    case "urgent":
      return "L";
    case "low":
      return "S";
    case "medium":
    default:
      return "M";
  }
}

function getSessionTone(sessionStatus?: "connecting" | "ready" | "error", queuePosition?: number) {
  if (queuePosition) {
    return badgeTone.warning;
  }

  switch (sessionStatus) {
    case "ready":
      return badgeTone.success;
    case "error":
      return badgeTone.danger;
    case "connecting":
      return badgeTone.info;
    default:
      return badgeTone.neutral;
  }
}

function getStatusLabel(sessionStatus?: "connecting" | "ready" | "error", queuePosition?: number) {
  // Note: This returns English status keys; they will be overridden in the component
  if (queuePosition) return `queued`;
  if (sessionStatus === "connecting") return "starting";
  if (sessionStatus === "ready") return "live";
  if (sessionStatus === "error") return "failed";
  return "idle";
}

function getSyncTone(
  sessionStatus: "connecting" | "ready" | "error" | undefined,
  queuePosition: number | undefined,
  hasSyncError: boolean,
  githubSyncedAt?: string,
) {
  if (sessionStatus === "connecting" || queuePosition) {
    return badgeTone.info;
  }
  if (sessionStatus === "error" || hasSyncError) {
    return badgeTone.danger;
  }
  if (githubSyncedAt) {
    return badgeTone.success;
  }
  return badgeTone.neutral;
}

function getSyncLabel(
  sessionStatus: "connecting" | "ready" | "error" | undefined,
  queuePosition: number | undefined,
  hasSyncError: boolean,
  githubSyncedAt?: string,
) {
  if (sessionStatus === "connecting") return "starting";
  if (queuePosition) return `queued`;
  if (sessionStatus === "error" || hasSyncError) return "syncIssue";
  if (githubSyncedAt) return "synced";
  return "notSynced";
}

function formatArtifactGateBadgeLabel(
  nextColumnName: string | undefined,
  missingArtifacts: string[],
) {
  if (missingArtifacts.length === 0) {
    return `${nextColumnName ?? "Next"} ready`;
  }

  if (missingArtifacts.length === 1) {
    return `Needs ${formatArtifactLabel(missingArtifacts[0])}`;
  }

  return `Needs ${formatArtifactLabel(missingArtifacts[0])} +${missingArtifacts.length - 1}`;
}

function formatArtifactCountTooltip(task: TaskInfo): string {
  const summary = task.artifactSummary;
  if (!summary || summary.total === 0) {
    return "noArtifactsAttached";
  }

  const parts = Object.entries(summary.byType)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number" && entry[1] > 0)
    .map(([type, count]) => `${count} ${formatArtifactLabel(type)}${count === 1 ? "" : "s"}`);

  return parts.length > 0 ? parts.join(", ") : `${summary.total} artifacts`;
}

function normalizeCardPreviewText(value: string): string {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
}

function buildCardSummary(task: TaskInfo, fallback: string): string {
  const canonicalStory = parseCanonicalStory(task.objective);
  if (canonicalStory.story) {
    const summary = [
      canonicalStory.story.story.problem_statement,
      canonicalStory.story.story.user_value,
    ]
      .map((value) => normalizeCardPreviewText(value))
      .filter(Boolean)
      .join(" ");

    if (summary) {
      return summary;
    }
  }

  return normalizeCardPreviewText(fallback);
}

function KanbanCardSurface({
  task,
  boardColumns,
  linkedSession,
  liveMessageTail,
  availableProviders,
  specialists,
  specialistLanguage,
  codebases,
  allCodebaseIds,
  worktreeCache,
  autoProviderId,
  queuePosition,
  onOpenDetail,
  onDelete,
  onPatchTask,
  onRetryTrigger,
  onRefresh,
  dragHandleProps = {},
  dragOverlay = false,
  isDragging = false,
  style,
  wrapperRef,
}: KanbanCardSurfaceProps) {
  const { t } = useTranslation();
  const sessionStatus = linkedSession?.acpStatus;
  const isTerminalCard = task.columnId === "done" || task.columnId === "blocked";
  const resolveSpecialist = createKanbanSpecialistResolver(specialists);
  const effectiveAutomation = resolveEffectiveTaskAutomation(task, boardColumns, resolveSpecialist, {
    autoProviderId,
  });
  const canRetry = effectiveAutomation.canRun && (
    sessionStatus === "error" || (!task.triggerSessionId && task.columnId === "dev")
  ) && !queuePosition;
  const canRun = effectiveAutomation.canRun && !task.triggerSessionId && task.columnId !== "done" && !queuePosition;
  const priorityTone = getPriorityTone(task.priority);
  const prioritySizeLabel = getPrioritySizeLabel(task.priority);
  const sessionTone = isTerminalCard
    ? badgeTone.success
    : getSessionTone(sessionStatus, queuePosition);
  const statusLabel = getStatusLabel(sessionStatus, queuePosition);
  const resolvedStatusLabel = isTerminalCard
    ? t.kanban.done
    : queuePosition
      ? `${t.kanban.queued} #${queuePosition}`
      : (t.kanban as Record<string, string>)[statusLabel] ?? statusLabel;
  const visibleLabels = (task.labels ?? []).slice(0, 2);
  const remainingLabelCount = Math.max((task.labels?.length ?? 0) - visibleLabels.length, 0);
  const visibleCodebaseIds = (task.codebaseIds && task.codebaseIds.length > 0 ? task.codebaseIds : allCodebaseIds).slice(0, 1);
  const remainingCodebaseCount = Math.max(
    (task.codebaseIds && task.codebaseIds.length > 0 ? task.codebaseIds.length : allCodebaseIds.length) - visibleCodebaseIds.length,
    0,
  );
  const syncLabelKey = getSyncLabel(sessionStatus, queuePosition, Boolean(task.lastSyncError), task.githubSyncedAt);
  const resolvedSyncLabel = syncLabelKey === "queued"
    ? `${t.kanban.queued} #${queuePosition}`
    : (t.kanban as Record<string, string>)[syncLabelKey] ?? syncLabelKey;
  const syncTone = getSyncTone(sessionStatus, queuePosition, Boolean(task.lastSyncError), task.githubSyncedAt);
  const objectiveText = buildCardSummary(task, task.objective?.trim() || t.kanban.noObjective);
  const transitionArtifacts = resolveKanbanTransitionArtifacts(boardColumns, task.columnId);
  const missingNextArtifacts = transitionArtifacts.nextRequiredArtifacts.filter(
    (artifactType) => (task.artifactSummary?.byType?.[artifactType] ?? 0) === 0,
  );
  const artifactGateTone = missingNextArtifacts.length === 0
    ? badgeTone.success
    : badgeTone.warning;
  const artifactCount = task.artifactSummary?.total ?? 0;
  const artifactCountLabel = `${artifactCount} artifact${artifactCount === 1 ? "" : "s"}`;
  const artifactCountTooltip = formatArtifactCountTooltip(task);
  const artifactGateTooltip = transitionArtifacts.nextRequiredArtifacts.length > 0
    ? missingNextArtifacts.length === 0
      ? `Ready for ${transitionArtifacts.nextColumn?.name ?? "the next lane"}: ${transitionArtifacts.nextRequiredArtifacts.map((artifact) => formatArtifactLabel(artifact)).join(", ")} present.`
      : `Before ${transitionArtifacts.nextColumn?.name ?? "the next lane"}: missing ${missingNextArtifacts.map((artifact) => formatArtifactLabel(artifact)).join(", ")}.`
    : undefined;
  const hasReviewFeedback = Boolean(task.verificationReport?.trim())
    || (task.verificationVerdict != null && task.verificationVerdict !== "APPROVED");
  const reviewFeedbackPreview = summarizeReviewFeedback(task.verificationReport, 160);
  const reviewVerdictLabel = task.verificationVerdict === "NOT_APPROVED"
    ? t.kanbanDetail.reviewRequestedChanges
    : task.verificationVerdict === "BLOCKED"
      ? t.kanbanDetail.reviewBlockedVerdict
      : task.verificationVerdict === "APPROVED"
        ? t.kanbanDetail.reviewApprovedVerdict
        : t.kanbanDetail.reviewFeedback;
  const reviewFeedbackTone = task.verificationVerdict === "BLOCKED"
    ? reviewFeedbackToneClasses.danger
    : task.verificationVerdict === "APPROVED"
      ? reviewFeedbackToneClasses.success
      : reviewFeedbackToneClasses.warning;
  const cardClassName = `group relative flex flex-col gap-2 rounded-[var(--dt-radius-md)] border border-desktop-border bg-desktop-surface p-2.5 shadow-[var(--dt-shadow-sm)] transition-[background-color,border-color,box-shadow,opacity] duration-150 hover:border-desktop-border-light hover:bg-desktop-surface-elevated focus:outline-none focus:ring-2 focus:ring-[var(--dt-focus-ring)]/50 ${dragOverlay
    ? "pointer-events-none border-desktop-accent bg-desktop-surface-elevated shadow-[0_24px_70px_rgb(0_0_0/0.18)] ring-2 ring-[var(--dt-focus-ring)]/35 will-change-transform"
    : isDragging
      ? "opacity-15 ring-1 ring-desktop-border"
      : ""}`.trim();

  void availableProviders;
  void specialistLanguage;
  void onPatchTask;
  void onRefresh;

  const stopCardInteraction = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
  };

  return (
    <div
      ref={wrapperRef}
      style={style}
      onClick={dragOverlay ? undefined : onOpenDetail}
      onKeyDown={dragOverlay ? undefined : (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenDetail();
        }
      }}
      role={dragOverlay ? undefined : "button"}
      tabIndex={dragOverlay ? -1 : 0}
      aria-label={dragOverlay ? undefined : `${t.kanban.openCard} ${task.title}`}
      className={cardClassName}
      data-testid={dragOverlay ? "kanban-card-overlay" : "kanban-card"}
    >
      <button
        type="button"
        {...dragHandleProps}
        onClickCapture={stopCardInteraction}
        className={`absolute left-2.5 top-2.5 ${cardIconButton}`}
        aria-label={`${t.kanban.dragCard} ${task.title}`}
        title={t.kanban.dragCard}
        style={{ touchAction: "none" }}
        data-testid="kanban-card-drag-handle"
      >
        <GripVertical className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" />
      </button>
      <button
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        className="absolute right-2.5 top-2.5 rounded-lg p-1 text-desktop-danger-text opacity-0 transition-all hover:bg-desktop-danger-subtle hover:text-[var(--dt-danger-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--danger-ring)] group-hover:opacity-100"
        title={t.kanban.deleteTask}
        data-testid="kanban-card-delete"
      >
        <Trash2 className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"/>
      </button>

      <div className="flex items-start justify-between gap-3 pl-7 pr-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1">
            {task.githubNumber ? (
              <a
                href={task.githubUrl}
                target="_blank"
                rel="noreferrer"
                onClick={stopCardInteraction}
                className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium ring-1 ring-inset hover:opacity-80 ${task.isPullRequest
                  ? badgeTone.info
                  : badgeTone.warning
                }`}
              >
                {task.isPullRequest ? `PR #${task.githubNumber}` : `Issue #${task.githubNumber}`}
              </a>
            ) : null}
            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${sessionTone}`}>
              {resolvedStatusLabel}
            </span>
            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium ${syncTone}`}>
              {resolvedSyncLabel}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {(canRun || canRetry) && (
            <button
              onClick={() => void onRetryTrigger(task.id)}
              onClickCapture={stopCardInteraction}
              className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${canRetry
                ? `border ${badgeTone.warning} hover:bg-[var(--dt-status-warning-subtle)]`
                : `border ${badgeTone.success} hover:bg-[var(--dt-status-success-subtle)]`
                }`}
            >
              {canRetry ? t.kanban.rerun : t.kanban.run}
            </button>
          )}
          <span className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${priorityTone}`}>
            {prioritySizeLabel}
          </span>
        </div>
      </div>

      <div className="text-[14px] font-semibold leading-[1.2] text-desktop-text-primary">
        {task.title}
      </div>

      {(transitionArtifacts.nextRequiredArtifacts.length > 0 || artifactCount > 0) && (
        <div className="flex flex-wrap items-center gap-1">
          {transitionArtifacts.nextRequiredArtifacts.length > 0 && (
            <span
              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium ${artifactGateTone}`}
              title={artifactGateTooltip}
              data-testid="kanban-card-artifact-gate"
            >
              {formatArtifactGateBadgeLabel(transitionArtifacts.nextColumn?.name, missingNextArtifacts)}
            </span>
          )}
          {artifactCount > 0 && (
            <span
              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium ${badgeTone.neutral}`}
              title={artifactCountTooltip}
              data-testid="kanban-card-artifact-count"
            >
              {artifactCountLabel}
            </span>
          )}
        </div>
      )}

      <p className="line-clamp-3 text-[11px] leading-[1.35] text-desktop-text-secondary">{objectiveText}</p>
      {hasReviewFeedback && (
        <div
          className={`rounded-lg border px-2 py-1.5 ${reviewFeedbackTone}`}
          data-testid="kanban-card-review-feedback"
        >
          <div className="flex flex-wrap items-center gap-1">
            <div className="text-[9px] font-semibold uppercase tracking-[0.14em]">
              {t.kanbanDetail.reviewFeedback}
            </div>
            <span className="rounded-full bg-desktop-surface-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em]">
              {task.columnId === "dev" && task.verificationVerdict !== "APPROVED"
                ? t.kanbanDetail.reviewReturnedToDev
                : reviewVerdictLabel}
            </span>
          </div>
          {(reviewFeedbackPreview || task.verificationVerdict) && (
            <div
              className="mt-1 line-clamp-2 text-[10px] leading-[1.35]"
              title={task.verificationReport ?? reviewVerdictLabel}
            >
              {reviewFeedbackPreview ?? reviewVerdictLabel}
            </div>
          )}
        </div>
      )}
      {!isTerminalCard && liveMessageTail && (
        <div className="rounded-lg border border-[var(--dt-status-info)]/25 bg-[var(--dt-status-info-subtle)] px-2 py-1.5">
          <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--dt-status-info)]">
            {t.kanban.liveSession}
          </div>
          <div
            className="mt-1 line-clamp-2 font-mono text-[10px] leading-[1.35] text-[var(--dt-status-info)]"
            title={liveMessageTail}
            data-testid="kanban-card-live-tail"
          >
            {liveMessageTail}
          </div>
        </div>
      )}

      {(visibleLabels.length > 0
        || ((task.codebaseIds && task.codebaseIds.length > 0) || allCodebaseIds.length > 0)
        || task.worktreeId) && (
        <div className="flex flex-wrap gap-1">
          {visibleLabels.map((label) => (
            <span key={label} className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${badgeTone.warning}`}>
              {label}
            </span>
          ))}
          {remainingLabelCount > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${badgeTone.neutral}`}>
              +{remainingLabelCount}
            </span>
          )}
          {visibleCodebaseIds.map((cbId) => {
            const cb = codebases.find((c) => c.id === cbId);
            return cb ? (
              <span
                key={cbId}
                className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${badgeTone.info}`}
                data-testid="repo-badge"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--dt-status-info)]" />
                {cb.label ?? cb.repoPath.split("/").pop() ?? cb.repoPath}
              </span>
            ) : (
              <span key={cbId} className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${badgeTone.danger}`} title={t.kanban.repoMissing}>
                {t.kanban.repoMissing}
              </span>
            );
          })}
          {remainingCodebaseCount > 0 && (
            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium ${badgeTone.neutral}`}>
              +{remainingCodebaseCount} repo{remainingCodebaseCount > 1 ? "s" : ""}
            </span>
          )}
          <WorktreeBadge task={task} worktreeCache={worktreeCache} onOpenDetail={onOpenDetail} stopCardInteraction={stopCardInteraction} />
        </div>
      )}
    </div>
  );
}

export function KanbanCard({
  ...props
}: KanbanCardProps) {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
  } = useDraggable({
    id: props.task.id,
    data: {
      taskId: props.task.id,
      columnId: props.task.columnId,
    },
  });

  return (
    <KanbanCardSurface
      {...props}
      wrapperRef={setNodeRef}
      dragHandleProps={{ ...attributes, ...listeners }}
      isDragging={isDragging}
      style={isDragging ? { opacity: 0.16 } : undefined}
    />
  );
}

export function KanbanCardOverlay(props: KanbanCardProps) {
  return <KanbanCardSurface {...props} dragOverlay />;
}

interface WorktreeBadgeProps {
  task: TaskInfo;
  worktreeCache: Record<string, WorktreeInfo>;
  onOpenDetail: () => void;
  stopCardInteraction: (event: { stopPropagation: () => void }) => void;
}

function WorktreeBadge({ task, worktreeCache, onOpenDetail, stopCardInteraction }: WorktreeBadgeProps) {
  const { t } = useTranslation();
  if (!task.worktreeId) return null;

  const wt = worktreeCache[task.worktreeId];
  if (!wt) {
    return (
      <div className="inline-flex items-center text-[9px] text-desktop-text-secondary">
        worktree {t.common.loading}...
      </div>
    );
  }

  const wtDotColor = wt.status === "active"
    ? "bg-[var(--dt-status-success)]"
    : wt.status === "creating"
      ? "bg-[var(--dt-status-warning)]"
      : "bg-[var(--dt-status-danger)]";

  return (
    <button
      onClick={onOpenDetail}
      onClickCapture={stopCardInteraction}
      className="inline-flex max-w-full items-center gap-1 text-[9px] text-desktop-text-secondary transition hover:text-desktop-text-primary"
      title={t.kanban.worktreeLoading}
      data-testid="worktree-badge"
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${wtDotColor}`} />
      <span className="truncate">
        worktree {wt.status} · {wt.branch}
      </span>
    </button>
  );
}
