"use client";

/**
 * ChatPanel - Full-screen ACP chat interface
 *
 * Renders streaming `session/update` SSE notifications from an opencode process.
 * Handles all ACP sessionUpdate types.
 */

import {useCallback, useEffect, useMemo, useRef, useState,} from "react";
import {v4 as uuidv4} from "uuid";
import type {UseAcpActions, UseAcpState} from "../hooks/use-acp";
import {type InputContext, TiptapInput} from "./tiptap-input";
import type {SkillSummary} from "../skill-client";
import { shortenRepoPath, type RepoSelection } from "./repo-picker";
import {SetupView} from "./chat-panel/components";
import {useChatMessages} from "./chat-panel/hooks";
import {type ParsedTask,} from "../utils/task-block-parser";
import {type TaskInfo, TaskProgressBar, type FileChangesSummary} from "./task-progress-bar";
import {
  MessageBubble,
  isAskUserQuestionMessage,
  AskUserQuestionBubble,
  hasAskUserQuestionAnswers,
  isPermissionRequestMessage,
  PermissionRequestBubble,
} from "@/client/components/message-bubble";
import {TracePanel} from "@/client/components/trace-panel";
import type {WorkspaceData, CodebaseData} from "../hooks/use-workspaces";
import {getFileChangesSummary} from "../utils/file-changes-tracker";
import { TriangleAlert, X, KeyRound, Copy, Check, Monitor } from "lucide-react";
import { useTranslation } from "@/i18n";


// ─── Message Types ─────────────────────────────────────────────────────

type MessageRole = "user" | "assistant" | "thought" | "tool" | "plan" | "info" | "terminal";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  toolName?: string;
  toolStatus?: string;
  toolCallId?: string;
  toolKind?: string;
  /** Raw input parameters for tool calls */
  toolRawInput?: Record<string, unknown>;
  /** Raw output payload for tool calls before string formatting */
  toolRawOutput?: unknown;
  /** Task ID for delegated tasks (delegate_task_to_agent) */
  delegatedTaskId?: string;
  /** Completion summary when a delegated task completes */
  completionSummary?: string;
  /** Raw update payload for debug/info display */
  rawData?: Record<string, unknown>;
  planEntries?: PlanEntry[];
  usageUsed?: number;
  usageSize?: number;
  costAmount?: number;
  costCurrency?: string;
  // Terminal fields
  terminalId?: string;
  terminalCommand?: string;
  terminalArgs?: string[];
  terminalInteractive?: boolean;
  terminalExited?: boolean;
  terminalExitCode?: number | null;
}

export interface PlanEntry {
  content: string;
  priority?: "high" | "medium" | "low";
  status?: "pending" | "in_progress" | "completed";
}

const MISSING_PENDING_INTERACTIVE_REQUEST_MESSAGE = "No pending interactive request found for this session";

interface ChatPanelProps {
  acp: UseAcpState & UseAcpActions;
  activeSessionId: string | null;
  traceSessionId?: string | null;
  onEnsureSession: (cwd?: string, provider?: string, modeId?: string, model?: string) => Promise<string | null>;
  onSelectSession: (sessionId: string) => Promise<void>;
  skills?: SkillSummary[];
  repoSkills?: SkillSummary[];
  onLoadSkill?: (name: string) => Promise<string | null>;
  repoSelection: RepoSelection | null;
  onRepoChange: (selection: RepoSelection | null) => void;
  onTasksDetected?: (tasks: ParsedTask[]) => void;
  agentRole?: string;
  onAgentRoleChange?: (role: string) => void;
  onCreateSession?: (provider: string) => void;
  workspaces?: WorkspaceData[];
  activeWorkspaceId?: string | null;
  onWorkspaceChange?: (id: string) => void;
  onWorkspaceCreate?: (title: string) => Promise<void> | void;
  codebases?: CodebaseData[];
  /** When set, pre-fills the chat input (e.g. to restore text after a session error) */
  inputPrefill?: string | null;
  /** Called after inputPrefill has been consumed */
  onInputPrefillConsumed?: () => void;
  /** Optional composer tool action that enables Canvas prompt handling for the next turn. */
  onPrepareCanvasPrompt?: () => void;
  canvasPromptActive?: boolean;
  canvasPromptLabel?: string;
  canvasPromptShortLabel?: string;
  onDecoratePrompt?: (text: string) => string;
  onDecoratedPromptSent?: () => void;
  /** Optional recovery action for a selected historical session. */
  onResumeActiveSession?: () => Promise<void>;
}

// ─── Main Component ────────────────────────────────────────────────────

export function ChatPanel({
  acp,
  activeSessionId,
  traceSessionId,
  onEnsureSession,
  onSelectSession,
  skills = [],
  repoSkills = [],
  agentRole,
  onAgentRoleChange,
  onCreateSession: _onCreateSession,
  onLoadSkill,
  repoSelection,
  onRepoChange,
  onTasksDetected,
  workspaces = [],
  activeWorkspaceId,
  onWorkspaceChange,
  onWorkspaceCreate,
  codebases: _codebases = [],
  inputPrefill,
  onInputPrefillConsumed,
  onPrepareCanvasPrompt,
  canvasPromptActive,
  canvasPromptLabel,
  canvasPromptShortLabel,
  onDecoratePrompt,
  onDecoratedPromptSent,
  onResumeActiveSession,
}: ChatPanelProps) {
  const { t } = useTranslation();
  const { connected, loading, error, authError, updates, promptSession, clearAuthError } = acp;
  const canvasPromptDisabled = !connected;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [copiedRepoPath, setCopiedRepoPath] = useState(false);
  // View mode: 'chat' or 'trace'
  const [viewMode, setViewMode] = useState<"chat" | "trace">("chat");
  const [isResumingActiveSession, setIsResumingActiveSession] = useState(false);

  // Use the extracted chat messages hook
  const {
    visibleMessages,
    sessions,
    sessionModeById,
    isSessionRunning,
    checklistItems,
    fileChangesState,
    usageInfo,
    setMessagesBySession,
    setIsSessionRunning,
    fetchSessions,
    resetStreamingRefs,
  } = useChatMessages({
    activeSessionId,
    updates,
    onTasksDetected,
  });

  // Extract task-type tool calls for TaskProgressBar (existing behavior)
  const delegatedTasks = useMemo<TaskInfo[]>(() => {
    return visibleMessages
      .filter((msg) => msg.role === "tool" && msg.toolKind === "task")
      .map((msg) => {
        const rawInput = msg.toolRawInput ?? {};
        const description = (rawInput.description as string) ?? "";
        const subagentType = (rawInput.subagent_type as string) ?? (rawInput.specialist as string) ?? "";
        // Map toolStatus to TaskInfo status
        let status: TaskInfo["status"] = "pending";
        if (msg.toolStatus === "completed") status = "completed";
        else if (msg.toolStatus === "failed") status = "failed";
        else if (msg.toolStatus === "delegated") status = "delegated";
        else if (msg.toolStatus === "running" || msg.toolStatus === "in_progress") status = "running";

        return {
          id: msg.id,
          title: description || msg.toolName || t.common.tasks,
          description,
          subagentType,
          status,
          completionSummary: msg.completionSummary,
        };
      });
  }, [visibleMessages, t]);

  // Extract plan entries from plan messages
  const planTasks = useMemo<TaskInfo[]>(() => {
    // Find the latest plan message with entries
    const planMessages = visibleMessages.filter(
      (msg) => msg.role === "plan" && msg.planEntries && msg.planEntries.length > 0
    );
    if (planMessages.length === 0) return [];

    // Use the most recent plan
    const latestPlan = planMessages[planMessages.length - 1];
    return (latestPlan.planEntries ?? []).map((entry, index) => ({
      id: `plan-${index}`,
      title: entry.content,
      status: entry.status === "completed" ? "completed"
        : entry.status === "in_progress" ? "running"
        : "pending",
      description: entry.priority ? `Priority: ${entry.priority}` : undefined,
    }));
  }, [visibleMessages]);

  // Combine checklist items into TaskInfo format for display
  const taskInfos = useMemo<TaskInfo[]>(() => {
    // Convert checklist items to TaskInfo
    const checklistTasks: TaskInfo[] = checklistItems.map((item) => ({
      id: item.id,
      title: item.text,
      status: item.status === "in_progress" ? "running" :
              item.status === "cancelled" ? "failed" :
              item.status as TaskInfo["status"],
    }));

    // Priority: checklist items > plan tasks > delegated tasks
    if (checklistTasks.length > 0) return checklistTasks;
    if (planTasks.length > 0) return planTasks;
    return delegatedTasks;
  }, [checklistItems, planTasks, delegatedTasks]);

  // Pending AskUserQuestion messages — shown sticky above input, not in chat stream
  const pendingAskUserQuestions = useMemo(() => {
    return visibleMessages.filter(
      (msg) =>
        msg.role === "tool" &&
        isAskUserQuestionMessage(msg) &&
        !hasAskUserQuestionAnswers(msg) &&
        msg.toolStatus !== "failed",
    );
  }, [visibleMessages]);

  const pendingPermissionRequests = useMemo(() => {
    return visibleMessages.filter(
      (msg) =>
        msg.role === "tool" &&
        isPermissionRequestMessage(msg) &&
        msg.toolStatus !== "failed" &&
        msg.toolStatus !== "completed",
    );
  }, [visibleMessages]);

  // File changes summary for TaskProgressBar
  const fileChangesSummary = useMemo<FileChangesSummary | undefined>(() => {
    const summary = getFileChangesSummary(fileChangesState);
    if (summary.fileCount === 0) return undefined;
    return summary;
  }, [fileChangesState]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMessages]);

  // Fetch sessions on mount and when active session changes
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions, activeSessionId]);

  // ── Actions ──────────────────────────────────────────────────────────

  const updateInteractiveRequestMessage = useCallback((
    toolCallId: string,
    status: "completed" | "failed",
    response: Record<string, unknown>,
    errorMessage?: string,
  ) => {
    if (!activeSessionId) return;

    setMessagesBySession((prev) => {
      const msgs = prev[activeSessionId] ?? [];
      return {
        ...prev,
        [activeSessionId]: msgs.map((msg) =>
          msg.toolCallId === toolCallId
            ? {
                ...msg,
                toolStatus: status,
                toolRawInput: {
                  ...((msg.toolRawInput as Record<string, unknown>) ?? {}),
                  ...response,
                },
                toolRawOutput: errorMessage
                  ? { message: errorMessage }
                  : msg.toolRawOutput,
              }
            : msg,
        ),
      };
    });
  }, [activeSessionId, setMessagesBySession]);

  const handleRepoChange = onRepoChange;

  const handleSubmitAskUserQuestion = useCallback(async (
    toolCallId: string,
    response: Record<string, unknown>,
  ) => {
    try {
      await acp.respondToUserInput(toolCallId, response);
      updateInteractiveRequestMessage(toolCallId, "completed", response);
    } catch (error) {
      if (error instanceof Error && error.message.includes(MISSING_PENDING_INTERACTIVE_REQUEST_MESSAGE)) {
        updateInteractiveRequestMessage(toolCallId, "failed", response, MISSING_PENDING_INTERACTIVE_REQUEST_MESSAGE);
        return;
      }
      throw error;
    }
  }, [acp, updateInteractiveRequestMessage]);

  const handleSubmitPermissionRequest = useCallback(async (
    toolCallId: string,
    response: Record<string, unknown>,
  ) => {
    try {
      await acp.respondToUserInput(toolCallId, response);
      updateInteractiveRequestMessage(toolCallId, "completed", response);
    } catch (error) {
      if (error instanceof Error && error.message.includes(MISSING_PENDING_INTERACTIVE_REQUEST_MESSAGE)) {
        updateInteractiveRequestMessage(toolCallId, "failed", response, MISSING_PENDING_INTERACTIVE_REQUEST_MESSAGE);
        return;
      }
      throw error;
    }
  }, [acp, updateInteractiveRequestMessage]);

  const handleTerminalInput = useCallback(async (terminalId: string, data: string) => {
    await acp.writeTerminal(terminalId, data);
  }, [acp]);

  const handleTerminalResize = useCallback(async (terminalId: string, cols: number, rows: number) => {
    await acp.resizeTerminal(terminalId, cols, rows);
  }, [acp]);

  const handleSend = useCallback(async (text: string, context: InputContext) => {
    if (!text.trim()) return;

    // Use cwd from repo selection if set
    const cwd = context.cwd || repoSelection?.path || undefined;

    // If user selected a provider via @mention, switch to it
    if (context.provider) {
      acp.setProvider(context.provider);
    }

    if (context.sessionId && context.sessionId !== activeSessionId) {
      await onSelectSession(context.sessionId);
    }

    // Ensure we have a session — pass cwd and provider
    const sid = context.sessionId ?? activeSessionId ?? (await onEnsureSession(cwd, context.provider, context.mode, context.model));
    if (!sid) return;
    if (acp.sessionId !== sid) {
      await onSelectSession(sid);
    }
    if (context.mode) {
      await acp.setMode(context.mode);
    }

    // Reset streaming refs before sending
    resetStreamingRefs(sid);

    // Build the final prompt:
    // - If a skill is selected, load its content and pass as structured context
    //   to the backend so it can inject via appendSystemPrompt (SDK) or
    //   prepend to prompt (CLI) for proper skill integration.
    let finalPrompt = text;
    let skillContext: { skillName: string; skillContent: string } | undefined;
    if (context.skill && onLoadSkill) {
      const skillContent = await onLoadSkill(context.skill);
      if (skillContent) {
        skillContext = { skillName: context.skill, skillContent };
        // Also prepend as fallback for providers that don't support appendSystemPrompt
        finalPrompt = `[Skill: ${context.skill}]\n${skillContent}\n\n---\n\n${text}`;
      }
    }

    // Show the user message
    setMessagesBySession((prev) => {
      const next = { ...prev };
      const arr = next[sid] ? [...next[sid]] : [];
      const displayParts: string[] = [];
      // @ is now for files
      if (context.files && context.files.length > 0) {
        for (const file of context.files) {
          displayParts.push(`@${file.label}`);
        }
      }
      // # is now for agents/sessions
      if (context.sessionId) displayParts.push(`#session-${context.sessionId.slice(0, 8)}`);
      if (context.provider) displayParts.push(`#${context.provider}`);
      if (context.mode) displayParts.push(`[${context.mode}]`);
      if (context.skill) displayParts.push(`/${context.skill}`);
      const prefix = displayParts.length ? displayParts.join(" ") + " " : "";
      arr.push({ id: uuidv4(), role: "user", content: prefix + text, timestamp: new Date() });
      next[sid] = arr;
      return next;
    });

    const decoratedPrompt = onDecoratePrompt ? onDecoratePrompt(finalPrompt) : finalPrompt;

    await promptSession(sid, decoratedPrompt, skillContext);
    if (onDecoratePrompt) onDecoratedPromptSent?.();

    // Reset streaming refs after sending
    resetStreamingRefs(sid);

    // Task extraction is now handled by the useEffect that watches messagesBySession
  }, [
    activeSessionId,
    onEnsureSession,
    onSelectSession,
    promptSession,
    repoSelection,
    onLoadSkill,
    acp,
    resetStreamingRefs,
    setMessagesBySession,
    onDecoratePrompt,
    onDecoratedPromptSent,
  ]);

  // ── Setup State ──────────────────────────────────────────────────────

  const [setupInput, setSetupInput] = useState("");

  const handleStartSession = useCallback(async () => {
    if (!setupInput.trim()) return;
    await handleSend(setupInput, {});
    setSetupInput("");
  }, [setupInput, handleSend]);

  const handleResumeActiveSession = useCallback(async () => {
    if (!onResumeActiveSession || isResumingActiveSession) return;
    setIsResumingActiveSession(true);
    try {
      await onResumeActiveSession();
    } finally {
      setIsResumingActiveSession(false);
    }
  }, [isResumingActiveSession, onResumeActiveSession]);

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-desktop-bg-primary">
      {/* Session info bar with view toggle */}
      {activeSessionId && (
        <div className="px-5 py-2 border-b border-desktop-border flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-desktop-status-success" />
            <span
              className="max-w-[36rem] overflow-x-auto whitespace-nowrap text-[11px] text-desktop-text-secondary font-mono"
              title={activeSessionId}
            >
              {t.sessions.sessionInfo} {activeSessionId}
            </span>
          </div>
          {/* View toggle: Chat | Trace */}
          <div className="flex items-center gap-2">
            <a
              href={`/traces?sessionId=${encodeURIComponent(traceSessionId ?? activeSessionId)}${activeWorkspaceId ? `&workspaceId=${encodeURIComponent(activeWorkspaceId)}` : ""}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-desktop-border px-3 py-1 text-[11px] font-medium text-desktop-text-secondary transition-colors hover:bg-desktop-surface-muted"
            >
              Debug
            </a>
            <div className="flex items-center bg-desktop-bg-tertiary rounded-md p-0.5">
            <button
              onClick={() => setViewMode("chat")}
              className={`px-3 py-1 text-[11px] font-medium rounded-md transition-colors ${
                viewMode === "chat"
                  ? "bg-desktop-surface text-desktop-text-primary shadow-sm"
                  : "text-desktop-text-tertiary hover:text-desktop-text-primary"
              }`}
            >
              {t.chat.viewToggle.chat}
            </button>
            <button
              onClick={() => setViewMode("trace")}
              className={`px-3 py-1 text-[11px] font-medium rounded-md transition-colors ${
                viewMode === "trace"
                  ? "bg-desktop-surface text-desktop-text-primary shadow-sm"
                  : "text-desktop-text-tertiary hover:text-desktop-text-primary"
              }`}
            >
              {t.chat.viewToggle.trace}
            </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start justify-between gap-3 border-b border-desktop-danger-border bg-desktop-danger-subtle px-5 py-2 text-xs text-desktop-danger-text">
          <div className="min-w-0 flex-1">{error}</div>
          {activeSessionId && onResumeActiveSession && (
            <button
              type="button"
              onClick={() => void handleResumeActiveSession()}
              disabled={isResumingActiveSession || loading}
              className="shrink-0 rounded-md border border-desktop-danger-border bg-desktop-surface px-2.5 py-1 text-[11px] font-semibold text-desktop-danger-text transition-colors hover:bg-desktop-danger-subtle disabled:cursor-not-allowed disabled:opacity-60"
              title={t.sessions.resumeHint}
            >
              {isResumingActiveSession ? t.sessions.resuming : t.sessions.resume}
            </button>
          )}
        </div>
      )}

      {/* Authentication Required Banner */}
      {authError && (
        <div className="px-5 py-3 bg-desktop-surface-muted border-b border-desktop-border">
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              <TriangleAlert className="w-5 h-5 text-desktop-status-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}/>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-medium text-desktop-text-primary">
                  {t.chat.authRequiredTitle}
                  {authError.agentInfo && (
                    <span className="ml-2 text-xs font-normal text-desktop-text-secondary">
                      ({authError.agentInfo.name} v{authError.agentInfo.version})
                    </span>
                  )}
                </h4>
                <button
                  onClick={clearAuthError}
                  className="shrink-0 p-1 rounded hover:bg-desktop-bg-active transition-colors"
                  title={t.common.dismiss}
                >
                  <X className="w-4 h-4 text-desktop-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}/>
                </button>
              </div>
              <p className="mt-1 text-xs text-desktop-text-secondary">
                {authError.message}
              </p>
              {authError.authMethods.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium text-desktop-text-secondary">
                    {t.chat.availableAuthMethods}
                  </p>
                  <div className="space-y-1.5">
                    {authError.authMethods.map((method) => (
                      <div
                        key={method.id}
                        className="flex items-start gap-2 p-2 rounded-md bg-desktop-bg-tertiary"
                      >
                        <KeyRound className="w-4 h-4 mt-0.5 text-desktop-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}/>
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-desktop-text-primary">
                            {method.name}
                          </div>
                          <div className="text-xs text-desktop-text-secondary mt-0.5">
                            {method.description}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area - Chat or Trace */}
      {viewMode === "trace" ? (
        <TracePanel sessionId={traceSessionId ?? activeSessionId} />
      ) : (visibleMessages.length === 0 && !activeSessionId) ? (

        /* ── Setup / Empty State ── */
        <SetupView
          setupInput={setupInput}
          onSetupInputChange={setSetupInput}
          onStartSession={handleStartSession}
          connected={connected}
          providers={acp.providers}
          selectedProvider={acp.selectedProvider}
          onProviderChange={acp.setProvider}
          onFetchModels={acp.listProviderModels}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId ?? null}
          onWorkspaceChange={(id) => onWorkspaceChange?.(id)}
          onWorkspaceCreate={onWorkspaceCreate}
          repoSelection={repoSelection}
          onRepoChange={onRepoChange}
          agentRole={agentRole}
          onAgentRoleChange={onAgentRoleChange}
        />

      ) : (

        /* ── Active Chat State ── */
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto min-h-0" data-testid="chat-panel-message-shell">
            <div className="max-w-3xl mx-auto px-5 py-5 space-y-2">
              {visibleMessages.length === 0 && activeSessionId && (
                <div className="text-center py-20 text-sm text-desktop-text-tertiary">
                  {t.sessions.placeholder}
                </div>
              )}
              {visibleMessages
                .filter((msg) => {
                  // Hide plan messages that have entries (they show in TaskProgressBar)
                  if (msg.role === "plan" && msg.planEntries && msg.planEntries.length > 0) {
                    return false;
                  }
                  // Hide task-type tool messages (delegated tasks) - they show in the right panel CraftersView
                  if (msg.role === "tool" && msg.toolKind === "task") {
                    return false;
                  }
                  // Hide non-interactive provider stderr/process output from the main chat stream.
                  if (msg.role === "terminal" && msg.terminalInteractive === false) {
                    return false;
                  }
                  // Hide pending AskUserQuestion from chat stream — shown sticky above input
                  if (
                    msg.role === "tool"
                    && isAskUserQuestionMessage(msg)
                    && !hasAskUserQuestionAnswers(msg)
                    && msg.toolStatus !== "failed"
                    && msg.toolStatus !== "completed"
                  ) {
                    return false;
                  }
                  if (
                    msg.role === "tool"
                    && isPermissionRequestMessage(msg)
                    && msg.toolStatus !== "failed"
                    && msg.toolStatus !== "completed"
                  ) {
                    return false;
                  }
                  return true;
                })
                .map((msg, index) => (
                  <MessageBubble
                    key={`${msg.id}-${index}`}
                    message={msg}
                    onSubmitAskUserQuestion={handleSubmitAskUserQuestion}
                    onSubmitPermissionRequest={handleSubmitPermissionRequest}
                    onTerminalInput={activeSessionId ? handleTerminalInput : undefined}
                    onTerminalResize={activeSessionId ? handleTerminalResize : undefined}
                  />
                ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="border-t border-desktop-border bg-desktop-bg-primary">
            <div className="max-w-3xl mx-auto px-5 py-3 space-y-2">
              {/* Interactive request sticky cards — displayed above input until user submits */}
              {(pendingAskUserQuestions.length > 0 || pendingPermissionRequests.length > 0) && (
                <div className="space-y-2">
                  {pendingAskUserQuestions
                    .filter((msg) => msg.toolStatus !== "completed")
                    .map((msg) => (
                    <AskUserQuestionBubble
                      key={msg.id}
                      message={msg}
                      onSubmit={handleSubmitAskUserQuestion}
                    />
                  ))}
                  {pendingPermissionRequests
                    .filter((msg) => msg.toolStatus !== "completed")
                    .map((msg) => (
                    <PermissionRequestBubble
                      key={msg.id}
                      message={msg}
                      onSubmit={handleSubmitPermissionRequest}
                    />
                  ))}
                </div>
              )}
              {/* Task Progress Bar - shows above input when tasks or file changes exist */}
              {(taskInfos.length > 0 || fileChangesSummary) && (
                <TaskProgressBar tasks={taskInfos} fileChanges={fileChangesSummary} />
              )}
              <div className="flex gap-2 items-end">
                {onPrepareCanvasPrompt && canvasPromptLabel && canvasPromptShortLabel && (
                  <button
                    type="button"
                    onClick={canvasPromptDisabled ? undefined : onPrepareCanvasPrompt}
                    disabled={canvasPromptDisabled}
                    className={`mb-[1px] flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-medium transition-colors ${
                      canvasPromptActive
                        ? "border-desktop-accent bg-desktop-bg-tertiary text-desktop-accent"
                        : "border-desktop-border bg-desktop-surface-muted text-desktop-text-tertiary hover:border-desktop-accent hover:bg-desktop-bg-tertiary hover:text-desktop-accent"
                    } disabled:cursor-not-allowed disabled:opacity-45`}
                    title={canvasPromptDisabled ? t.chat.connectFirst : canvasPromptLabel}
                    aria-label={canvasPromptLabel}
                    aria-pressed={canvasPromptActive}
                  >
                    <Monitor className="h-4 w-4" aria-hidden="true" />
                    <span>{canvasPromptShortLabel}</span>
                  </button>
                )}
                <TiptapInput
                  onSend={handleSend}
                  onStop={() => {
                    setIsSessionRunning(false);
                    acp.cancel();
                  }}
                  placeholder={
                    connected
                      ? activeSessionId
                        ? t.chat.typeMessage
                        : t.chat.typeCreateSession
                      : t.chat.connectFirst
                  }
                  disabled={!connected}
                  loading={loading || isSessionRunning}
                  skills={skills}
                  repoSkills={repoSkills}
                  providers={acp.providers}
                  selectedProvider={acp.selectedProvider}
                  onProviderChange={acp.setProvider}
                  sessions={sessions}
                  activeSessionMode={activeSessionId ? sessionModeById[activeSessionId] : undefined}
                  repoSelection={repoSelection}
                  onRepoChange={handleRepoChange}
                  agentRole={agentRole}
                  usageInfo={usageInfo}
                  onFetchModels={acp.listProviderModels}
                  prefillText={inputPrefill}
                  onPrefillConsumed={onInputPrefillConsumed}
                />
              </div>
              {repoSelection?.path && (
                <div className="flex items-center gap-1.5 px-1 text-[10px] text-desktop-text-tertiary">
                  <span className="font-medium text-desktop-text-secondary">
                    {t.sessions.repoPath}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono" title={repoSelection.path}>
                    {shortenRepoPath(repoSelection.path)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(repoSelection.path).then(() => {
                        setCopiedRepoPath(true);
                        window.setTimeout(() => setCopiedRepoPath(false), 1500);
                      }).catch(() => {
                        setCopiedRepoPath(false);
                      });
                    }}
                    className="shrink-0 rounded p-0.5 text-desktop-text-tertiary transition-colors hover:bg-desktop-bg-active hover:text-desktop-text-primary"
                    title={t.common.copyToClipboard}
                    aria-label={t.common.copyToClipboard}
                  >
                    {copiedRepoPath ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
