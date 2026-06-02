"use client";

import { type ComponentProps } from "react";
import { ArrowRight } from "lucide-react";
import { AcpProviderDropdown } from "@/client/components/acp-provider-dropdown";
import type { KanbanAgentPromptHandler, KanbanBoardInfo } from "../types";
import { KanbanTabHeader } from "./kanban-tab-header";
import { KanbanStatusBar } from "./kanban-status-bar";
import { KanbanGitHubImportModal } from "./kanban-github-import-modal";
import { KanbanBoardSurface, KanbanCreateTaskModal, KanbanTaskDetailOverlay } from "./kanban-tab-panels";
import { KanbanSettingsModal } from "./kanban-settings-modal";
import { KanbanFitnessWorkbenchModal } from "./kanban-fitness-workbench-modal";
import {
  KanbanCodebaseModal,
  KanbanDeleteCodebaseModal,
  KanbanDeleteTaskModal,
  KanbanMoveBlockedModal,
  KanbanReplaceAllReposModal,
} from "./kanban-tab-modals";
import type { KanbanCodebaseModalProps } from "./kanban-tab-modals";
import type { AcpProviderInfo } from "@/client/acp-client";
import type { KanbanTaskAgentCopy } from "./i18n/kanban-task-agent";

const compactToolbarButtonClass =
  "inline-flex h-6 shrink-0 items-center rounded-md border border-desktop-border bg-desktop-surface px-2 text-[11px] font-semibold text-desktop-text-secondary transition-colors hover:bg-desktop-surface-muted hover:text-desktop-text-primary focus:outline-none focus:ring-2 focus:ring-[var(--dt-focus-ring)]/45";

type KanbanTabHeaderProps = Omit<ComponentProps<typeof KanbanTabHeader>, "actionSlot">;
type BoardSurfaceProps = ComponentProps<typeof KanbanBoardSurface>;
type CreateTaskModalProps = ComponentProps<typeof KanbanCreateTaskModal>;
type GitHubImportModalProps = ComponentProps<typeof KanbanGitHubImportModal>;
type TaskDetailOverlayProps = ComponentProps<typeof KanbanTaskDetailOverlay>;
type SettingsModalProps = ComponentProps<typeof KanbanSettingsModal>;
type DeleteCodebaseModalProps = ComponentProps<typeof KanbanDeleteCodebaseModal> & { show: boolean };
type ReplaceAllReposModalProps = ComponentProps<typeof KanbanReplaceAllReposModal> & { show: boolean };
type DeleteTaskModalProps = ComponentProps<typeof KanbanDeleteTaskModal>;
type MoveBlockedModalProps = ComponentProps<typeof KanbanMoveBlockedModal>;
type StatusBarProps = ComponentProps<typeof KanbanStatusBar>;
type FitnessWorkbenchModalProps = ComponentProps<typeof KanbanFitnessWorkbenchModal>;

export interface KanbanTabHeaderActionProps {
  board: KanbanBoardInfo | null;
  onAgentPrompt?: KanbanAgentPromptHandler;
  availableProviders: AcpProviderInfo[];
  selectedProviderId: string;
  onBoardProviderChange: (providerId: string) => void;
  disableBoardProvider: boolean;
  kanbanTaskAgentCopy: KanbanTaskAgentCopy;
  agentInput: string;
  onAgentInputChange: (value: string) => void;
  onAgentSubmit: () => void;
  showCreateTaskModal: () => void;
  agentLoading: boolean;
  agentSessionId: string | null;
  openAgentPanel: (sessionId: string) => void;
}

export interface KanbanTabContentProps {
  headerProps: KanbanTabHeaderProps;
  headerActionProps: KanbanTabHeaderActionProps;
  boardSurfaceProps?: BoardSurfaceProps;
  createTaskModalProps: CreateTaskModalProps;
  githubImportModalProps: GitHubImportModalProps;
  taskDetailOverlayProps?: TaskDetailOverlayProps;
  showSettingsModal?: boolean;
  settingsModalProps?: SettingsModalProps;
  codebaseModalProps: KanbanCodebaseModalProps;
  deleteCodebaseModalProps: DeleteCodebaseModalProps;
  replaceAllReposModalProps: ReplaceAllReposModalProps;
  deleteTaskModalProps: DeleteTaskModalProps;
  moveBlockedModalProps: MoveBlockedModalProps;
  statusBarProps: StatusBarProps;
  fitnessWorkbenchModalProps: FitnessWorkbenchModalProps;
}

function KanbanTabHeaderActionSlot({
  board,
  onAgentPrompt,
  availableProviders,
  selectedProviderId,
  onBoardProviderChange,
  disableBoardProvider,
  kanbanTaskAgentCopy,
  agentInput,
  onAgentInputChange,
  onAgentSubmit,
  showCreateTaskModal,
  agentLoading,
  agentSessionId,
  openAgentPanel,
}: KanbanTabHeaderActionProps) {
  if (!board) {
    return null;
  }

  return (
    <div className="flex min-w-[560px] flex-1 items-center rounded-[var(--dt-radius-md)] border border-desktop-border bg-desktop-surface shadow-[var(--dt-shadow-sm)] transition-colors focus-within:border-desktop-accent focus-within:ring-2 focus-within:ring-[var(--dt-focus-ring)]/25">
      {onAgentPrompt && (
        <>
          <div className="ml-1 shrink-0 border-l border-r border-desktop-border">
            <AcpProviderDropdown
              providers={availableProviders}
              selectedProvider={selectedProviderId}
              onProviderChange={onBoardProviderChange}
              disabled={disableBoardProvider}
              ariaLabel={kanbanTaskAgentCopy.providerAriaLabel}
              dataTestId="kanban-agent-provider"
              buttonClassName="flex h-7 items-center gap-1.5 bg-transparent px-2 text-[12px] font-medium text-desktop-text-primary transition-colors hover:bg-desktop-surface-muted disabled:opacity-50"
              labelClassName="max-w-[110px] truncate"
            />
          </div>
          <input
            type="text"
            value={agentInput}
            onChange={(event) => onAgentInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onAgentSubmit();
              }
            }}
            placeholder={disableBoardProvider ? kanbanTaskAgentCopy.connectingPlaceholder : kanbanTaskAgentCopy.placeholder}
            disabled={agentLoading || disableBoardProvider}
            className="h-7 min-w-64 flex-1 bg-transparent px-2 text-[12px] text-desktop-text-primary placeholder:text-desktop-text-tertiary outline-none disabled:opacity-50"
          />
          <button
            onClick={onAgentSubmit}
            disabled={!agentInput.trim() || agentLoading || disableBoardProvider}
            className="mr-1 inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-transparent bg-desktop-accent px-2 text-[11px] font-semibold text-desktop-accent-text transition-colors hover:bg-desktop-accent-strong disabled:cursor-not-allowed disabled:border-desktop-border disabled:bg-desktop-surface-muted disabled:text-desktop-text-tertiary"
          >
            {agentLoading ? "..." : (
              <>
                <span>{kanbanTaskAgentCopy.send}</span>
                <ArrowRight className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}/>
              </>
            )}
          </button>
        </>
      )}
      <button
        onClick={showCreateTaskModal}
        className={`mr-1 ${compactToolbarButtonClass}`}
      >
        {kanbanTaskAgentCopy.manual}
      </button>
      {agentSessionId && (
        <button
          onClick={() => openAgentPanel(agentSessionId)}
          className="mr-2 shrink-0 text-[11px] font-medium text-desktop-accent hover:underline"
          title={kanbanTaskAgentCopy.openPanelTitle}
        >
          {kanbanTaskAgentCopy.view}
        </button>
      )}
    </div>
  );
}

export function KanbanTabContent({
  headerProps,
  headerActionProps,
  boardSurfaceProps,
  createTaskModalProps,
  githubImportModalProps,
  taskDetailOverlayProps,
  showSettingsModal = false,
  settingsModalProps,
  codebaseModalProps,
  deleteCodebaseModalProps,
  replaceAllReposModalProps,
  deleteTaskModalProps,
  moveBlockedModalProps,
  statusBarProps,
  fitnessWorkbenchModalProps,
}: KanbanTabContentProps) {
  const { key: codebaseModalKey, ...codebaseModalRestProps } = codebaseModalProps as KanbanCodebaseModalProps & {
    key?: string;
  };

  const headerActionSlot = (
    <KanbanTabHeaderActionSlot
      board={headerProps.board}
      onAgentPrompt={headerActionProps.onAgentPrompt}
      availableProviders={headerActionProps.availableProviders}
      selectedProviderId={headerActionProps.selectedProviderId}
      onBoardProviderChange={headerActionProps.onBoardProviderChange}
      disableBoardProvider={headerActionProps.disableBoardProvider}
      kanbanTaskAgentCopy={headerActionProps.kanbanTaskAgentCopy}
      agentInput={headerActionProps.agentInput}
      onAgentInputChange={headerActionProps.onAgentInputChange}
      onAgentSubmit={headerActionProps.onAgentSubmit}
      showCreateTaskModal={headerActionProps.showCreateTaskModal}
      agentLoading={headerActionProps.agentLoading}
      agentSessionId={headerActionProps.agentSessionId}
      openAgentPanel={headerActionProps.openAgentPanel}
    />
  );

  if (!headerProps.board || !boardSurfaceProps || !taskDetailOverlayProps) {
    return (
      <div className="flex h-full flex-col space-y-2">
        <KanbanTabHeader {...headerProps} actionSlot={headerActionSlot}/>
        <div className="rounded-[var(--dt-radius-lg)] border border-desktop-border bg-desktop-surface p-6 text-sm text-desktop-text-secondary shadow-[var(--dt-shadow-sm)]">
          No board available yet.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <KanbanTabHeader {...headerProps} actionSlot={headerActionSlot}/>
      <KanbanBoardSurface {...boardSurfaceProps}/>
      <KanbanCreateTaskModal {...createTaskModalProps}/>
      <KanbanGitHubImportModal {...githubImportModalProps}/>
      <KanbanTaskDetailOverlay {...taskDetailOverlayProps}/>

      {/* Settings Modal */}
      {showSettingsModal && settingsModalProps && (
        <KanbanSettingsModal {...settingsModalProps} />
      )}
      <KanbanCodebaseModal key={codebaseModalKey} {...codebaseModalRestProps}/>
      {deleteCodebaseModalProps.show && (
        <KanbanDeleteCodebaseModal {...deleteCodebaseModalProps}/>
      )}
      {replaceAllReposModalProps.show && replaceAllReposModalProps.codebasesCount > 0 && (
        <KanbanReplaceAllReposModal {...replaceAllReposModalProps}/>
      )}
      <KanbanDeleteTaskModal {...deleteTaskModalProps}/>
      <KanbanMoveBlockedModal {...moveBlockedModalProps}/>
      <KanbanStatusBar {...statusBarProps}/>
      <KanbanFitnessWorkbenchModal {...fitnessWorkbenchModalProps}/>
    </div>
  );
}
