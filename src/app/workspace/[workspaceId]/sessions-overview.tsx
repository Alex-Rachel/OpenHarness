"use client";

import React, { useState, useEffect } from "react";
import { useTranslation } from "@/i18n";
import { formatRelativeTime } from "./ui-components";
import type { SessionInfo } from "./types";
import { ChevronDown, ChevronRight, PieChart, RefreshCw, SquareArrowOutUpRight, MessageCircleMore, SquarePen, Trash2 } from "lucide-react";
import { desktopAwareFetch } from "@/client/utils/diagnostics";


interface SessionsOverviewProps {
  sessions: SessionInfo[];
  workspaceId: string;
  onNavigate: (sessionId: string) => void;
  onRefresh: () => void;
  filterSession?: (session: SessionInfo & { parentSessionId?: string }) => boolean;
}

export function SessionsOverview({ sessions, workspaceId, onNavigate, onRefresh, filterSession }: SessionsOverviewProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [sessionTree, setSessionTree] = useState<Map<string, SessionInfo[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ sessionId: string; x: number; y: number } | null>(null);
  const [renamingSession, setRenamingSession] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Build parent-child tree
  useEffect(() => {
    if (!expanded) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    desktopAwareFetch(`/api/sessions?workspaceId=${encodeURIComponent(workspaceId)}&limit=100`, { cache: "no-store" })
      .then(res => res.json())
      .then(data => {
        const allSessions = Array.isArray(data?.sessions)
          ? (filterSession ? data.sessions.filter(filterSession) : data.sessions)
          : [];
        const tree = new Map<string, SessionInfo[]>();

        allSessions.forEach((session: SessionInfo & { parentSessionId?: string }) => {
          const parentId = session.parentSessionId || "root";
          if (!tree.has(parentId)) {
            tree.set(parentId, []);
          }
          tree.get(parentId)!.push(session);
        });

        tree.set("all", allSessions);
        setSessionTree(tree);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [expanded, filterSession, workspaceId]);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ sessionId, x: e.clientX, y: e.clientY });
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm(t.sessions.deleteConfirm)) return;
    try {
      await desktopAwareFetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
      onRefresh();
    } catch (error) {
      console.error(t.sessions.deleteFailed, error);
    }
    setContextMenu(null);
  };

  const handleRenameSession = (sessionId: string, currentName: string) => {
    setRenamingSession(sessionId);
    setRenameValue(currentName);
    setContextMenu(null);
  };

  const handleSaveRename = async (sessionId: string) => {
    if (!renameValue.trim()) return;
    try {
      await desktopAwareFetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      onRefresh();
    } catch (error) {
      console.error(t.sessions.renameFailed, error);
    }
    setRenamingSession(null);
  };

  const displaySessions = expanded
    ? (sessionTree.size > 0 ? (sessionTree.get("all") || []) : sessions)
    : sessions.slice(0, 6);

  const renderSession = (session: SessionInfo, depth = 0) => {
    const children = sessionTree.get(session.sessionId) || [];
    const hasChildren = children.length > 0;
    const isRenaming = renamingSession === session.sessionId;

    return (
      <div key={session.sessionId} style={{ marginLeft: depth * 20 }}>
        <div
          className="group flex w-full items-center gap-3 rounded-[var(--dt-radius-md)] px-3.5 py-2.5 transition-colors hover:bg-desktop-surface-muted"
          onContextMenu={(e) => handleContextMenu(e, session.sessionId)}
        >
          {depth > 0 && (
            <ChevronRight className="h-3 w-3 shrink-0 text-desktop-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}/>
          )}
          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--dt-radius-sm)] ${
            depth > 0
              ? "bg-desktop-surface-muted"
              : "bg-desktop-bg-active"
          }`}>
            <MessageCircleMore className={`h-3.5 w-3.5 ${depth > 0
        ? "text-desktop-text-secondary"
        : "text-desktop-accent"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}/>
          </div>
          <div className="min-w-0 flex-1" onClick={() => !isRenaming && onNavigate(session.sessionId)}>
            <div className="flex items-center gap-2">
              {isRenaming ? (
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveRename(session.sessionId);
                    if (e.key === "Escape") setRenamingSession(null);
                  }}
                  onBlur={() => handleSaveRename(session.sessionId)}
                  autoFocus
                  className="rounded-[var(--dt-radius-sm)] border border-desktop-accent bg-desktop-surface px-2 py-1 text-[13px] font-medium text-desktop-text-primary outline-none focus:ring-2 focus:ring-[var(--dt-focus-ring)]/20"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <div className="cursor-pointer truncate text-[13px] font-medium text-desktop-text-primary transition-colors">
                  {session.name || session.provider || `Session ${session.sessionId.slice(0, 8)}`}
                </div>
              )}
              {hasChildren && (
                <span className="rounded-full bg-desktop-bg-active px-1.5 py-0.5 font-mono text-[10px] text-desktop-text-secondary">
                  {children.length}
                </span>
              )}
            </div>
            <div className="truncate text-[11px] text-desktop-text-tertiary">
              {session.role && <span className="capitalize">{session.role.toLowerCase()}</span>}
              {session.role && session.provider && <span className="mx-1">·</span>}
              {session.provider && <span>{session.provider}</span>}
            </div>
          </div>
          <span className="shrink-0 font-mono text-[10px] text-desktop-text-tertiary">
            {formatRelativeTime(session.createdAt)}
          </span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-desktop-text-tertiary opacity-0 transition-opacity group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}/>
        </div>
        {expanded && hasChildren && children.map(child => renderSession(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="overflow-hidden rounded-[var(--dt-radius-lg)] border border-desktop-border bg-desktop-surface shadow-[var(--dt-shadow-sm)]">
      <div className="flex items-center justify-between border-b border-desktop-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-[13px] font-semibold text-desktop-text-primary">
            {t.sessions.recentSessions}
          </h3>
          <span className="rounded-full bg-desktop-bg-active px-1.5 py-0.5 font-mono text-[11px] text-desktop-text-secondary">
            {sessions.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="rounded-[var(--dt-radius-sm)] p-1.5 text-desktop-text-tertiary transition-colors hover:bg-desktop-surface-muted hover:text-desktop-text-primary"
            title={t.common.refresh}
          >
            <RefreshCw className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}/>
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 rounded-[var(--dt-radius-sm)] px-2.5 py-1.5 text-[11px] font-medium text-desktop-text-secondary transition-colors hover:bg-desktop-surface-muted hover:text-desktop-text-primary"
          >
            {expanded ? t.sessions.showLess : t.sessions.showAll}
            <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}/>
          </button>
        </div>
      </div>
      <div className={`${expanded ? "max-h-150 overflow-y-auto" : ""}`}>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-desktop-text-tertiary">
            <PieChart className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24"/>
          </div>
        ) : displaySessions.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12px] text-desktop-text-tertiary">
            {t.sessions.noSessionsHint}
          </div>
        ) : (
          <div className="py-2">
            {displaySessions.map(session => renderSession(session))}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="desktop-theme fixed z-50 min-w-40 rounded-[var(--dt-radius-md)] border border-desktop-border bg-desktop-surface py-1 shadow-[var(--dt-shadow-md)]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              const session = sessions.find(s => s.sessionId === contextMenu.sessionId);
              if (session) {
                handleRenameSession(contextMenu.sessionId, session.name || session.provider || `Session ${session.sessionId.slice(0, 8)}`);
              }
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-desktop-text-primary transition-colors hover:bg-desktop-surface-muted"
          >
            <SquarePen className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}/>
            {t.sessions.rename}
          </button>
          <button
            onClick={() => onNavigate(contextMenu.sessionId)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-desktop-text-primary transition-colors hover:bg-desktop-surface-muted"
          >
            <SquareArrowOutUpRight className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}/>
            {t.sessions.open}
          </button>
          <div className="my-1 h-px bg-desktop-border" />
          <button
            onClick={() => handleDeleteSession(contextMenu.sessionId)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[var(--dt-status-danger)] transition-colors hover:bg-[var(--dt-status-danger-subtle)]"
          >
            <Trash2 className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}/>
            {t.common.delete}
          </button>
        </div>
      )}
    </div>
  );
}
