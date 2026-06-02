import { useTranslation } from "@/i18n";
import { Select } from "@/client/components/select";
import type { KanbanBoardInfo } from "../types";
import type { ReactNode } from "react";
import { Columns2, Download, RefreshCw, Settings } from "lucide-react";

const toolbarButtonClass =
  "inline-flex h-6 items-center gap-1 rounded-md border border-desktop-border bg-desktop-surface px-2 text-[12px] text-desktop-text-secondary transition-colors hover:bg-desktop-surface-muted hover:text-desktop-text-primary focus:outline-none focus:ring-2 focus:ring-[var(--dt-focus-ring)]/45";

const iconButtonClass =
  "inline-flex h-6 w-6 items-center justify-center rounded-md text-desktop-text-secondary transition-colors hover:bg-desktop-surface-muted hover:text-desktop-text-primary focus:outline-none focus:ring-2 focus:ring-[var(--dt-focus-ring)]/45";


interface KanbanTabHeaderProps {
  tasksCount: number;
  board: KanbanBoardInfo | null;
  boardQueue?: KanbanBoardInfo["queue"];
  boards: KanbanBoardInfo[];
  selectedBoardId: string | null;
  onSelectBoard: (boardId: string) => void;
  githubImportVisible?: boolean;
  onOpenGitHubImport: () => void;
  onRefresh: () => void;
  onOpenSettings?: () => void;
  actionSlot?: ReactNode;
}

export function KanbanTabHeader({
  tasksCount,
  board,
  boardQueue: _boardQueue,
  boards,
  selectedBoardId,
  onSelectBoard,
  githubImportVisible = false,
  onOpenGitHubImport,
  onRefresh,
  onOpenSettings,
  actionSlot,
}: KanbanTabHeaderProps) {
  const { t } = useTranslation();
  return (
    <div
      className="shrink-0 border-b border-desktop-border bg-desktop-surface px-4 py-1.5"
      data-testid="kanban-page-header"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-h-6 items-center gap-2">
          <Columns2 className="h-4 w-4 text-desktop-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}/>
          <h1 className="text-[13px] font-semibold text-desktop-text-primary">{t.kanban.kanbanBoard}</h1>
          {tasksCount > 0 && (
            <span className="text-[11px] text-desktop-text-secondary" data-testid="kanban-task-count">
              ({tasksCount} {t.kanban.tasksCount})
            </span>
          )}
          {board && (
            <span className="inline-flex h-6 items-center rounded-full border border-desktop-border bg-desktop-surface-muted px-2 text-[11px] text-desktop-text-secondary">
              {t.kanban.limit} {board.sessionConcurrencyLimit ?? 1}
            </span>
          )}
          {boards.length > 1 && (
            <Select
              value={selectedBoardId ?? ""}
              onChange={(event) => onSelectBoard(event.target.value)}
              className="h-6 min-h-6 max-w-[220px] rounded-md px-2 text-[12px]"
            >
              {boards.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </Select>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5">
          {actionSlot}
          {githubImportVisible ? (
            <button
              onClick={onOpenGitHubImport}
              className={toolbarButtonClass}
              title={t.kanban.importGithubIssues}
            >
              <Download className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}/>
              {t.kanban.importGithubIssues}
            </button>
          ) : null}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className={toolbarButtonClass}
              title={t.kanban.boardSettings}
            >
              <Settings className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}/>
              {t.kanban.boardSettings}
            </button>
          )}
          <button
            onClick={onRefresh}
            className={iconButtonClass}
            title={t.common.refresh}
          >
            <RefreshCw className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}/>
          </button>
        </div>
      </div>
    </div>
  );
}
