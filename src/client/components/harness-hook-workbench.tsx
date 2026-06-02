"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, type Dispatch } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  ReactFlow,
  Position,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { CodeViewer } from "@/client/components/codemirror/code-viewer";
import { HarnessUnsupportedState } from "@/client/components/harness-support-state";
import type { HooksResponse } from "@/client/hooks/use-harness-settings-data";
import {
  buildHookFlow,
  buildHookWorkbenchEntries,
  buildRuntimeProfileSource,
  formatPhaseLabel,
  getDefaultWorkbenchHook,
  groupHookEntries,
  type HookFlowNodeSpec,
  type HookFlowNodeTone,
  type HookWorkbenchEntry,
} from "./harness-hook-workbench-model";

type InspectorTab = "basic" | "inputs" | "tasks" | "script";
type ScriptTab = "runtime" | "raw" | "review";

type HookWorkbenchProps = {
  data: HooksResponse;
  unsupportedMessage?: string | null;
  variant?: "full" | "compact";
  embedded?: boolean;
};

type WorkbenchState = {
  contextKey: string;
  selectedHookName: string;
  inspectorTab: InspectorTab;
  scriptTab: ScriptTab;
};

type WorkbenchAction =
  | { type: "sync"; contextKey: string; hookNames: string[]; defaultHookName: string }
  | { type: "select-hook"; hookName: string }
  | { type: "select-tab"; tab: InspectorTab }
  | { type: "select-script-tab"; tab: ScriptTab };

type WorkbenchContextValue = {
  state: WorkbenchState;
  dispatch: Dispatch<WorkbenchAction>;
  activeEntry: HookWorkbenchEntry | null;
  groupedEntries: ReturnType<typeof groupHookEntries>;
  data: HooksResponse;
  compactMode: boolean;
  embedded: boolean;
};

const WorkbenchContext = createContext<WorkbenchContextValue | null>(null);

function toneStyles(tone: HookFlowNodeTone) {
  switch (tone) {
    case "success":
      return {
        border: "border-[var(--dt-status-success)]/25",
        badge: "border-[var(--dt-status-success)]/25 bg-[var(--dt-status-success-subtle)] text-[var(--dt-status-success)]",
        glow: "",
        line: "var(--dt-status-success)",
      };
    case "warning":
      return {
        border: "border-[var(--dt-status-warning)]/25",
        badge: "border-[var(--dt-status-warning)]/25 bg-[var(--dt-status-warning-subtle)] text-[var(--dt-status-warning)]",
        glow: "",
        line: "var(--dt-status-warning)",
      };
    case "danger":
      return {
        border: "border-desktop-danger-border",
        badge: "border-desktop-danger-border bg-desktop-danger-subtle text-desktop-danger-text",
        glow: "",
        line: "var(--dt-status-danger)",
      };
    case "accent":
      return {
        border: "border-[var(--dt-status-info)]/25",
        badge: "border-[var(--dt-status-info)]/25 bg-[var(--dt-status-info-subtle)] text-[var(--dt-status-info)]",
        glow: "",
        line: "var(--dt-status-info)",
      };
    default:
      return {
        border: "border-desktop-border",
        badge: "border-desktop-border bg-desktop-bg-secondary text-desktop-text-secondary",
        glow: "",
        line: "var(--dt-border)",
      };
  }
}

function createInitialState(contextKey: string, defaultHookName: string): WorkbenchState {
  return {
    contextKey,
    selectedHookName: defaultHookName,
    inspectorTab: "basic",
    scriptTab: "runtime",
  };
}

function workbenchReducer(state: WorkbenchState, action: WorkbenchAction): WorkbenchState {
  switch (action.type) {
    case "sync": {
      const selectedStillExists = action.hookNames.includes(state.selectedHookName);
      if (state.contextKey !== action.contextKey) {
        return createInitialState(action.contextKey, action.defaultHookName);
      }
      if (selectedStillExists) {
        return state;
      }
      return {
        ...state,
        selectedHookName: action.defaultHookName,
      };
    }
    case "select-hook":
      return {
        ...state,
        selectedHookName: action.hookName,
      };
    case "select-tab":
      return {
        ...state,
        inspectorTab: action.tab,
      };
    case "select-script-tab":
      return {
        ...state,
        scriptTab: action.tab,
      };
    default:
      return state;
  }
}

function useWorkbenchContext() {
  const context = useContext(WorkbenchContext);
  if (!context) {
    throw new Error("HarnessHookWorkbench context is missing");
  }
  return context;
}

type FlowNodeData = HookFlowNodeSpec;

function FlowNodeView({ data }: NodeProps<Node<FlowNodeData>>) {
  const tone = toneStyles(data.tone);
  const widthClass = data.kind === "hook" ? "w-[300px]" : data.kind === "task" ? "w-[284px]" : "w-[276px]";
  const heightClass = data.kind === "task" ? "min-h-[124px]" : "min-h-[132px]";
  return (
    <div className="relative">
      <Handle id="left" type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-0 !bg-desktop-border" />
      <Handle id="right" type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-0 !bg-desktop-border" />
      <div className={`${widthClass} ${heightClass} rounded-sm border bg-desktop-bg-primary px-4 py-3 ${tone.border} ${tone.glow}`}>
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-desktop-text-secondary">{data.kind}</div>
        <div className="mt-1 text-[15px] font-semibold leading-6 text-desktop-text-primary">{data.title}</div>
        {data.subtitle ? (
          <div className="mt-1 text-[12px] leading-5 text-desktop-text-secondary">{data.subtitle}</div>
        ) : null}
        {data.chips?.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {data.chips.map((chip) => (
              <span key={`${data.id}:${chip}`} className={`rounded-full border px-2 py-0.5 text-[10px] ${tone.badge}`}>
                {chip}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const flowNodeTypes = {
  workbench: FlowNodeView,
};

function HookLifecycleRail() {
  const { activeEntry, dispatch, groupedEntries } = useWorkbenchContext();

  return (
    <aside className="rounded-sm border border-desktop-border bg-desktop-bg-primary p-3">
      <div className="flex items-center justify-between gap-3 border-b border-desktop-border pb-2">
        <div className="text-[12px] font-semibold text-desktop-text-primary">Git hooks</div>
        <div className="rounded-full border border-desktop-border bg-desktop-surface px-2.5 py-1 text-[10px] text-desktop-text-secondary">
          {groupedEntries.reduce((sum, group) => sum + group.entries.length, 0)} hooks
        </div>
      </div>

      <div className="mt-3 space-y-4">
        {groupedEntries.map((group) => (
          <section key={group.group}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold text-desktop-text-primary">{group.label}</div>
                <div className="text-[10px] text-desktop-text-secondary">{group.description}</div>
              </div>
              <div className="rounded-full border border-desktop-border bg-desktop-bg-primary px-2 py-0.5 text-[10px] text-desktop-text-secondary">
                {group.entries.length}
              </div>
            </div>

            <div className="mt-2.5 space-y-2">
              {group.entries.map((entry) => {
                const selected = activeEntry?.name === entry.name;
                const dimmed = !entry.enabled;
                return (
                  <button
                    key={entry.name}
                    type="button"
                    disabled={dimmed}
                    onClick={() => {
                      if (dimmed) {
                        return;
                      }
                      dispatch({ type: "select-hook", hookName: entry.name });
                    }}
                    className={`w-full rounded-sm border px-3 py-3 text-left transition ${
                      dimmed
                        ? "cursor-not-allowed border-desktop-border bg-desktop-surface-muted text-desktop-text-tertiary opacity-80"
                        : selected
                        ? "border-desktop-accent bg-desktop-surface-muted"
                        : "border-desktop-border bg-desktop-surface hover:bg-desktop-surface-muted"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className={`text-[12px] font-semibold ${dimmed ? "text-desktop-text-tertiary" : "text-desktop-text-primary"}`}>{entry.name}</div>
                        <div className={`mt-1 text-[10px] ${dimmed ? "text-desktop-text-tertiary" : "text-desktop-text-secondary"}`}>
                          {entry.channelLabel} · {entry.blockingLabel} · {entry.bypassabilityLabel}
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${
                        entry.enabled
                          ? "border-[var(--dt-status-success)]/25 bg-[var(--dt-status-success-subtle)] text-[var(--dt-status-success)]"
                          : "border-desktop-border bg-desktop-surface-muted text-desktop-text-secondary"
                      }`}>
                        {entry.enabled ? "enabled" : entry.configured ? "partial" : "missing"}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${dimmed ? "border-desktop-border bg-desktop-surface text-desktop-text-tertiary" : "border-desktop-border bg-desktop-bg-primary text-desktop-text-secondary"}`}>
                        {entry.stats.taskCount} tasks
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${dimmed ? "border-desktop-border bg-desktop-surface text-desktop-text-tertiary" : "border-desktop-border bg-desktop-bg-primary text-desktop-text-secondary"}`}>
                        {entry.phases.length} phases
                      </span>
                      {entry.stats.reviewGate ? (
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] ${dimmed ? "border-desktop-border bg-desktop-surface text-desktop-text-tertiary" : "border-[var(--dt-status-warning)]/25 bg-[var(--dt-status-warning-subtle)] text-[var(--dt-status-warning)]"}`}>
                          review gate
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}

function HookFlowCanvas() {
  const { activeEntry, compactMode } = useWorkbenchContext();
  const flowHeight = compactMode ? 440 : 680;

  const flow = useMemo(() => {
    if (!activeEntry) {
      return { nodes: [], edges: [] };
    }

    const { nodes, edges } = buildHookFlow(activeEntry);
    const positionedNodes: Node[] = nodes.map((node) => ({
      id: node.id,
      type: "workbench",
      position: {
        x: node.column === 0 ? 24 : node.column === 1 ? 388 : 752,
        y: 24 + node.row * 154,
      },
      draggable: false,
      selectable: false,
      data: node,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    }));
    const positionedEdges = edges.map<Edge>((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      animated: edge.tone === "accent",
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
        color: toneStyles(edge.tone).line,
      },
      style: {
        stroke: toneStyles(edge.tone).line,
        strokeWidth: edge.tone === "accent" ? 1.8 : 1.5,
      },
    }));
    const maxNodeY = positionedNodes.reduce((max, node) => Math.max(max, node.position.y), 0);
    if (maxNodeY < flowHeight - 220) {
      positionedNodes.push({
        id: `viewport-anchor:${activeEntry.name}`,
        position: { x: 520, y: flowHeight - 120 },
        data: { label: "" },
        draggable: false,
        selectable: false,
        connectable: false,
        style: {
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: "none",
        },
      });
    }

    return { nodes: positionedNodes, edges: positionedEdges };
  }, [activeEntry, flowHeight]);

  return (
    <section className="rounded-sm border border-desktop-border bg-desktop-bg-primary p-3">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-desktop-border pb-2">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-desktop-text-primary">Hook → Task → Output</div>
          <div className="mt-1 text-[11px] text-desktop-text-secondary">
            {activeEntry
              ? `${activeEntry.lifecycleLabel} lifecycle · ${activeEntry.hint}`
              : "Select a hook to inspect its flow topology."}
          </div>
        </div>
        {activeEntry ? (
          <div className="flex flex-wrap gap-2 text-[10px]">
            <span className="rounded-full border border-desktop-border bg-desktop-surface px-2.5 py-1 text-desktop-text-secondary">
              {activeEntry.channelLabel}
            </span>
            <span className="rounded-full border border-desktop-border bg-desktop-surface px-2.5 py-1 text-desktop-text-secondary">
              {activeEntry.stats.taskCount} tasks
            </span>
            <span className="rounded-full border border-desktop-border bg-desktop-surface px-2.5 py-1 text-desktop-text-secondary">
              {activeEntry.stats.hardGateCount} hard gates
            </span>
          </div>
        ) : null}
      </div>

      {activeEntry ? (
        <div className="mt-4 overflow-hidden rounded-sm border border-desktop-border bg-desktop-bg-primary/80" style={{ height: flowHeight }}>
          <ReactFlow
            nodes={flow.nodes}
            edges={flow.edges}
            nodeTypes={flowNodeTypes}
            fitView
            fitViewOptions={{ padding: 0.14 }}
            minZoom={0.6}
            maxZoom={1.2}
            proOptions={{ hideAttribution: true }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnDrag
            zoomOnScroll={false}
          >
            <Background color="var(--dt-border-light)" gap={20} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      ) : (
        <div className="mt-4 rounded-sm border border-desktop-border bg-desktop-bg-primary/80 px-4 py-8 text-[12px] text-desktop-text-secondary">
          No hook selected.
        </div>
      )}
    </section>
  );
}

function HookInspector() {
  const { activeEntry, data, dispatch, state } = useWorkbenchContext();

  const tabs: Array<{ id: InspectorTab; label: string }> = [
    { id: "basic", label: "Basic" },
    { id: "inputs", label: "Inputs" },
    { id: "tasks", label: "Tasks" },
    { id: "script", label: "Source" },
  ];

  const previewSource = useMemo(() => {
    if (!activeEntry) {
      return { code: "", language: "text" as const };
    }
    if (state.scriptTab === "raw") {
      return {
        code: activeEntry.hookFile?.source ?? "# No raw hook file found",
        language: "shell" as const,
      };
    }
    if (state.scriptTab === "review") {
      return {
        code: data.reviewTriggerFile?.source ?? "# No review trigger file found",
        language: "yaml" as const,
      };
    }
    return {
      code: buildRuntimeProfileSource(activeEntry) || "# No runtime profile bound to this hook",
      language: "yaml" as const,
    };
  }, [activeEntry, data.reviewTriggerFile?.source, state.scriptTab]);

  if (!activeEntry) {
    return (
      <section className="rounded-sm border border-desktop-border bg-desktop-bg-primary/70 p-3">
        <div className="border-b border-desktop-border pb-2 text-[12px] font-semibold text-desktop-text-primary">Hook details</div>
        <div className="mt-3 rounded-sm border border-desktop-border bg-desktop-bg-primary/80 px-4 py-6 text-[12px] text-desktop-text-secondary">
          Select a hook to inspect details.
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-sm border border-desktop-border bg-desktop-bg-primary/70 p-3">
      <div className="flex items-start justify-between gap-3 border-b border-desktop-border pb-2">
        <div>
          <h3 className="text-[12px] font-semibold text-desktop-text-primary">{activeEntry.name}</h3>
          <div className="mt-1 text-[11px] text-desktop-text-secondary">
            {activeEntry.channelLabel} · {activeEntry.blockingLabel} · {activeEntry.bypassabilityLabel}
          </div>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] ${
          activeEntry.enabled
            ? "border-[var(--dt-status-success)]/25 bg-[var(--dt-status-success-subtle)] text-[var(--dt-status-success)]"
            : "border-desktop-border bg-desktop-bg-secondary text-desktop-text-secondary"
        }`}>
          {activeEntry.mode}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              dispatch({ type: "select-tab", tab: tab.id });
            }}
            className={`rounded-full border px-3 py-1 text-[10px] font-medium transition ${
              state.inspectorTab === tab.id
                ? "border-desktop-accent bg-desktop-surface-muted text-desktop-text-primary"
                : "border-desktop-border bg-desktop-bg-primary text-desktop-text-secondary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {state.inspectorTab === "basic" ? (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Lifecycle", activeEntry.lifecycleDescription],
              ["Run side", activeEntry.channelLabel],
              ["Blocking", activeEntry.blockingLabel],
              ["CWD", activeEntry.cwdLabel],
              ["Bypass", activeEntry.bypassabilityLabel],
              ["Source path", activeEntry.hookFile?.relativePath ?? "No hook file"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-sm border border-desktop-border bg-desktop-bg-primary/80 px-3 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-desktop-text-secondary">{label}</div>
                <div className="mt-1 text-[12px] leading-5 text-desktop-text-primary">{value}</div>
              </div>
            ))}
          </div>
          <div className="rounded-sm border border-desktop-border bg-desktop-bg-primary/85 px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-desktop-text-secondary">Command</div>
            <div className="mt-1 break-all font-mono text-[11px] text-desktop-text-primary">
              {activeEntry.hookFile?.triggerCommand ?? "No command detected"}
            </div>
            <div className="mt-2 text-[11px] text-desktop-text-secondary">
              {activeEntry.hint}
            </div>
          </div>
          {activeEntry.phases.length ? (
            <div className="rounded-sm border border-desktop-border bg-desktop-bg-primary/85 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-desktop-text-secondary">Runtime phases</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {activeEntry.phases.map((phase) => (
                  <span key={phase} className={`rounded-full border px-2.5 py-1 text-[10px] ${
                    phase === "review"
                      ? "border-[var(--dt-status-warning)]/25 bg-[var(--dt-status-warning-subtle)] text-[var(--dt-status-warning)]"
                      : "border-desktop-border bg-desktop-bg-secondary text-desktop-text-secondary"
                  }`}>
                    {formatPhaseLabel(phase)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {state.inspectorTab === "inputs" ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-sm border border-desktop-border bg-desktop-bg-primary/85 px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-desktop-text-secondary">Argv template</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {activeEntry.argvTemplate.length ? activeEntry.argvTemplate.map((value) => (
                <span key={value} className="rounded-full border border-desktop-border bg-desktop-bg-secondary px-2.5 py-1 text-[10px] font-mono text-desktop-text-secondary">
                  {value}
                </span>
              )) : (
                <span className="text-[11px] text-desktop-text-secondary">No argv payload.</span>
              )}
            </div>
          </div>
          <div className="rounded-sm border border-desktop-border bg-desktop-bg-primary/85 px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-desktop-text-secondary">stdin template</div>
            <div className="mt-1 font-mono text-[11px] text-desktop-text-primary">
              {activeEntry.stdinTemplate ?? "No stdin payload."}
            </div>
          </div>
          <div className="rounded-sm border border-desktop-border bg-desktop-bg-primary/85 px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-desktop-text-secondary">Environment</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {activeEntry.envKeys.map((key) => (
                <span key={key} className="rounded-full border border-desktop-border bg-desktop-bg-secondary px-2.5 py-1 text-[10px] font-mono text-desktop-text-secondary">
                  {key}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {state.inspectorTab === "tasks" ? (
        <div className="mt-4 space-y-3">
          {activeEntry.tasks.length ? activeEntry.tasks.map((task) => (
            <div key={task.id} className="rounded-sm border border-desktop-border bg-desktop-bg-primary/85 px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-desktop-text-primary">{task.name}</div>
                  {task.command ? (
                    <div className="mt-1 break-all font-mono text-[11px] text-desktop-text-secondary">{task.command}</div>
                  ) : null}
                  {task.description ? (
                    <div className="mt-2 text-[11px] leading-5 text-desktop-text-secondary">{task.description}</div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 text-[10px]">
                  <span className={`rounded-full border px-2.5 py-1 ${
                    task.resolved
                      ? "border-[var(--dt-status-success)]/25 bg-[var(--dt-status-success-subtle)] text-[var(--dt-status-success)]"
                      : "border-[var(--dt-status-warning)]/25 bg-[var(--dt-status-warning-subtle)] text-[var(--dt-status-warning)]"
                  }`}>
                    {task.resolved ? "resolved" : "unresolved"}
                  </span>
                  <span className="rounded-full border border-desktop-border bg-desktop-bg-secondary px-2.5 py-1 text-desktop-text-secondary">
                    {task.fileScope}
                  </span>
                  {task.hardGate ? (
                    <span className="rounded-full border border-desktop-danger-border bg-desktop-danger-subtle px-2.5 py-1 text-desktop-danger-text">
                      hard gate
                    </span>
                  ) : null}
                </div>
              </div>
              {task.sourceFile ? (
                <div className="mt-3 font-mono text-[10px] text-desktop-text-secondary">{task.sourceFile}</div>
              ) : null}
            </div>
          )) : (
            <div className="rounded-sm border border-desktop-border bg-desktop-bg-primary/85 px-4 py-5 text-[12px] text-desktop-text-secondary">
              This hook does not expose runtime metrics yet. Use the raw script tab to inspect the executable logic.
            </div>
          )}
        </div>
      ) : null}

      {state.inspectorTab === "script" ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {[
              { id: "runtime", label: "Runtime manifest" },
              { id: "raw", label: "Raw hook" },
              { id: "review", label: "Review triggers" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  dispatch({ type: "select-script-tab", tab: tab.id as ScriptTab });
                }}
                className={`rounded-full border px-3 py-1 text-[10px] font-medium transition ${
                  state.scriptTab === tab.id
                    ? "border-desktop-accent bg-desktop-surface-muted text-desktop-text-primary"
                    : "border-desktop-border bg-desktop-bg-primary text-desktop-text-secondary"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <CodeViewer
            code={previewSource.code}
            language={previewSource.language}
            showHeader={false}
            maxHeight="420px"
            className="rounded-sm"
          />
        </div>
      ) : null}
    </section>
  );
}

export function HarnessHookWorkbench({
  data,
  unsupportedMessage,
  variant = "full",
  embedded = false,
}: HookWorkbenchProps) {
  const entries = useMemo(
    () => buildHookWorkbenchEntries(data).filter((entry) => entry.lifecycleGroup === "commit" || entry.lifecycleGroup === "push"),
    [data],
  );
  const groupedEntries = useMemo(() => groupHookEntries(entries), [entries]);
  const defaultHook = useMemo(() => getDefaultWorkbenchHook(entries), [entries]);
  const contextKey = data.repoRoot;
  const [state, dispatch] = useReducer(
    workbenchReducer,
    createInitialState(contextKey, defaultHook?.name ?? ""),
  );

  useEffect(() => {
    dispatch({
      type: "sync",
      contextKey,
      hookNames: entries.map((entry) => entry.name),
      defaultHookName: defaultHook?.name ?? "",
    });
  }, [contextKey, defaultHook?.name, entries]);

  const activeEntry = useMemo(
    () => entries.find((entry) => entry.name === state.selectedHookName) ?? defaultHook ?? null,
    [defaultHook, entries, state.selectedHookName],
  );
  const compactMode = variant === "compact";
  const warnings = data.warnings ?? [];

  const contextValue: WorkbenchContextValue = {
    state,
    dispatch,
    activeEntry,
    groupedEntries,
    data,
    compactMode,
    embedded,
  };

  return (
    <WorkbenchContext.Provider value={contextValue}>
      <section
        className={embedded
          ? "space-y-0"
          : compactMode
            ? "rounded-sm border border-desktop-border bg-desktop-bg-primary/70 p-4"
            : "rounded-sm border border-desktop-border bg-desktop-bg-secondary/40 p-5"}
      >
        {unsupportedMessage ? (
          <HarnessUnsupportedState className="rounded-sm border border-[var(--dt-status-warning)]/25 bg-[var(--dt-status-warning-subtle)] px-4 py-4 text-[11px] text-[var(--dt-status-warning)]" />
        ) : null}

        {!unsupportedMessage && warnings.length > 0 ? (
          <div className="grid gap-2">
            {warnings.map((warning) => (
              <div key={warning} className="rounded-sm border border-[var(--dt-status-warning)]/25 bg-[var(--dt-status-warning-subtle)] px-4 py-3 text-[11px] text-[var(--dt-status-warning)]">
                {warning}
              </div>
            ))}
          </div>
        ) : null}

        {!unsupportedMessage && entries.length === 0 ? (
          <div className="rounded-sm border border-desktop-border bg-desktop-bg-primary/80 px-4 py-6 text-[12px] text-desktop-text-secondary">
            No hook metadata found for the selected repository.
          </div>
        ) : null}

        {!unsupportedMessage && entries.length > 0 ? (
          <div
            className={`grid gap-4 ${warnings.length > 0 ? "mt-4" : ""} ${
              compactMode
                ? "grid-cols-1"
                : "xl:grid-cols-[260px_minmax(0,1fr)_320px] 2xl:grid-cols-[280px_minmax(0,1fr)_360px]"
            }`}
          >
            <HookLifecycleRail />
            <HookFlowCanvas />
            <HookInspector />
          </div>
        ) : null}
      </section>
    </WorkbenchContext.Provider>
  );
}
