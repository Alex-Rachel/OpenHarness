"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkspaceData } from "../hooks/use-workspaces";
import { useTranslation } from "@/i18n";
import { normalizeWorkspaceQueryId } from "../utils/workspace-id";
import { Check, ChevronDown, Folder, Plus, Search, Trash2 } from "lucide-react";

const DESKTOP_LAST_WORKSPACE_ID_STORAGE_KEY = "routa.desktop.last-workspace-id";

function hasWorkspaceStorageAccess(): boolean {
  return (
    typeof window !== "undefined"
    && window.localStorage != null
    && typeof window.localStorage.getItem === "function"
    && typeof window.localStorage.setItem === "function"
  );
}

interface WorkspaceSwitcherProps {
  workspaces: WorkspaceData[];
  activeWorkspaceId: string | null;
  activeWorkspaceTitle?: string;
  onSelect: (workspaceId: string) => void;
  onCreate?: (title: string) => Promise<void> | void;
  onDelete?: (workspaceId: string) => Promise<void> | void;
  loading?: boolean;
  compact?: boolean;
  /** Use desktop/VS Code style theme */
  desktop?: boolean;
}

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
  activeWorkspaceTitle,
  onSelect,
  onCreate,
  onDelete,
  loading,
  compact,
  desktop,
}: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  const active = workspaces.find((w) => w.id === activeWorkspaceId);
  const visibleTitle = active?.title ?? activeWorkspaceTitle;

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setCreating(false);
    setSearchQuery("");
    setConfirmDeleteId(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) {
        closeDropdown();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [closeDropdown, open]);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  useEffect(() => {
    if (!open) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeDropdown();
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [closeDropdown, open]);

  useEffect(() => {
    if (!hasWorkspaceStorageAccess()) {
      return;
    }
    const normalizedWorkspaceId = normalizeWorkspaceQueryId(activeWorkspaceId);
    try {
      if (normalizedWorkspaceId) {
        window.localStorage.setItem(DESKTOP_LAST_WORKSPACE_ID_STORAGE_KEY, normalizedWorkspaceId);
      } else {
        window.localStorage.removeItem(DESKTOP_LAST_WORKSPACE_ID_STORAGE_KEY);
      }
    } catch {
      // localStorage may throw in restricted environments (quota, blocked storage)
    }
  }, [activeWorkspaceId]);

  const handleCreate = async () => {
    const title = newTitle.trim();
    if (!title || !onCreate) return;
    await onCreate(title);
    setNewTitle("");
    closeDropdown();
  };

  const handleDelete = async (id: string) => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(id);
      setConfirmDeleteId(null);
      // If we deleted the active workspace, close the dropdown
      if (id === activeWorkspaceId) {
        closeDropdown();
      }
    } finally {
      setDeleting(false);
    }
  };

  const filteredWorkspaces = searchQuery
    ? workspaces.filter((ws) => ws.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : workspaces;

  const isDesktopTheme = desktop || compact;
  const triggerCls = isDesktopTheme
    ? "flex items-center gap-1.5 rounded-[var(--dt-radius-sm)] border border-desktop-border bg-desktop-surface px-2.5 py-1 text-[11px] text-desktop-text-primary shadow-[var(--dt-shadow-sm)] transition-all duration-[var(--dt-motion-fast)] hover:bg-desktop-surface-muted"
    : "inline-flex w-full max-w-[220px] items-center gap-2 rounded-[var(--dt-radius-sm)] border border-desktop-border bg-desktop-surface px-2.5 py-1.5 text-left text-sm text-desktop-text-primary shadow-[var(--dt-shadow-sm)] transition-all duration-[var(--dt-motion-fast)] hover:bg-desktop-surface-muted";
  const triggerIconSize = isDesktopTheme ? "w-3 h-3" : "w-3.5 h-3.5";
  const chevronCls = isDesktopTheme
    ? `w-2.5 h-2.5 text-desktop-text-secondary transition-transform ${open ? "rotate-180" : ""}`
    : `w-3 h-3 text-desktop-text-tertiary transition-transform ${open ? "rotate-180" : ""}`;

  const dropdownBg = isDesktopTheme
    ? "bg-desktop-bg-secondary border-desktop-border text-desktop-text-primary"
    : "bg-desktop-surface border-desktop-border text-desktop-text-primary";
  const panelText = isDesktopTheme ? "text-desktop-text-primary" : "text-desktop-text-primary";
  const activeItemCls = isDesktopTheme
    ? "bg-desktop-bg-active text-desktop-accent"
    : "bg-desktop-bg-active text-desktop-accent";
  const listItemBase = isDesktopTheme
    ? "flex items-center gap-2 w-full px-2.5 py-1.5 text-[11px] rounded-md"
    : "flex items-center gap-2 text-left w-full px-2.5 py-2 text-xs";
  const footerBorder = isDesktopTheme ? "border-desktop-border" : "border-desktop-border";
  const footerText = isDesktopTheme ? "text-desktop-text-secondary" : "text-desktop-text-secondary";
  const rowIcon = isDesktopTheme ? "w-3 h-3" : "w-3.5 h-3.5";
  const rowActiveIcon = "w-3 h-3 text-desktop-accent";
  const footerBtn = isDesktopTheme
    ? "rounded bg-desktop-bg-secondary px-2 py-1.5 text-[11px] text-desktop-accent hover:bg-desktop-bg-active/80"
    : "rounded-[var(--dt-radius-sm)] border border-desktop-border bg-desktop-surface-muted px-2 py-1.5 text-xs text-desktop-text-primary hover:bg-desktop-bg-active";
  const createInputCls = isDesktopTheme
    ? "h-7 border border-desktop-border bg-desktop-bg-primary px-2 text-[11px] text-desktop-text-primary placeholder:text-desktop-text-secondary focus:border-desktop-accent"
    : "h-7 border border-desktop-border bg-desktop-surface px-2 text-xs text-desktop-text-primary placeholder:text-desktop-text-muted focus:border-desktop-accent";
  const createBtnCls = isDesktopTheme
    ? "rounded bg-desktop-accent px-2 py-1 text-[11px] font-medium text-desktop-accent-text hover:bg-desktop-accent-strong"
    : "rounded-[var(--dt-radius-sm)] bg-desktop-accent px-2 py-1 text-xs font-medium text-desktop-accent-text hover:bg-desktop-accent-strong";
  const searchInputCls = isDesktopTheme
    ? "border-desktop-border text-[11px] bg-desktop-bg-primary text-desktop-text-primary placeholder:text-desktop-text-secondary focus:border-desktop-accent"
    : "border-desktop-border bg-desktop-surface text-xs text-desktop-text-primary placeholder:text-desktop-text-muted focus:border-desktop-accent";

  return (
    <div className="relative" ref={dropdownRef} data-testid="desktop-workspace-switcher">
      <button
        type="button"
        onClick={() => {
          if (open) {
            closeDropdown();
            return;
          }
          setOpen(true);
        }}
        className={triggerCls}
        title={visibleTitle ?? t.workspace.selectWorkspace}
      >
        <Folder className={triggerIconSize} strokeWidth={2} />
        <span className="min-w-0 flex-1 truncate">
          {loading ? "..." : (visibleTitle ?? t.workspace.select)}
        </span>
        <ChevronDown className={chevronCls} strokeWidth={2} />
      </button>

      {open && (
        <div
          className={`absolute top-full left-0 z-50 mt-1 min-w-[14rem] max-w-[18rem] border shadow-xl ${dropdownBg} rounded-lg ${footerBorder}`}
        >
          <div className="border-b border-current/20 p-1.5">
            <div className="flex items-center gap-1.5 rounded-md border border-current/20 px-2 py-1">
              <Search className={isDesktopTheme ? "w-3 h-3" : "w-3.5 h-3.5"} strokeWidth={2} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSearchQuery("");
                  }
                }}
                aria-label={t.common.search}
                placeholder={t.common.search}
                className={`h-7 w-full rounded border bg-transparent outline-none ${searchInputCls} placeholder:truncate`}
              />
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto px-1 py-1">
            {filteredWorkspaces.length === 0 && (
              <div className={`px-3 py-2 text-center text-[11px] ${footerText}`}>
                {t.workspace.noWorkspacesYet}
              </div>
            )}
            {filteredWorkspaces.map((ws) => (
              confirmDeleteId === ws.id ? (
                <div
                  key={ws.id}
                  className={`${listItemBase} flex-col !items-stretch gap-1.5 rounded-md bg-red-500/10 border border-red-500/20 px-2.5 py-2`}
                >
                  <span className={`text-[11px] ${panelText}`}>{t.workspace.confirmDelete}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleDelete(ws.id)}
                      disabled={deleting}
                      className="rounded bg-red-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleting ? "..." : t.workspace.deleteWorkspace}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      disabled={deleting}
                      className={`rounded border border-current/20 px-2 py-0.5 text-[11px] ${panelText} hover:bg-current/10 disabled:opacity-50`}
                    >
                      {t.common.cancel}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  key={ws.id}
                  className={`${listItemBase} group relative ${
                    ws.id === activeWorkspaceId
                      ? activeItemCls
                      : `${panelText} hover:bg-current/10`
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(ws.id);
                      closeDropdown();
                    }}
                    className="flex items-center gap-2 min-w-0 flex-1"
                  >
                    <Folder className={rowIcon} strokeWidth={2} />
                    <span className="min-w-0 flex-1 truncate">{ws.title}</span>
                    {ws.id === activeWorkspaceId ? (
                      <Check className={rowActiveIcon} fill="currentColor" />
                    ) : null}
                  </button>
                  {onDelete && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(ws.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 flex-shrink-0 rounded p-0.5 text-desktop-text-secondary hover:text-red-500 hover:bg-red-500/10 transition-opacity"
                      title={t.workspace.deleteWorkspace}
                    >
                      <Trash2 className={isDesktopTheme ? "w-3 h-3" : "w-3.5 h-3.5"} strokeWidth={2} />
                    </button>
                  )}
                </div>
              )
            ))}
          </div>

          <div className={`border-t ${footerBorder} p-1.5`}>
            {creating ? (
              <div className="flex items-center gap-1.5">
                <input
                  ref={inputRef}
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") setCreating(false);
                  }}
                  placeholder={t.workspace.workspaceName}
                  className={`flex-1 rounded border ${createInputCls} focus:outline-none`}
                />
                <button
                  type="button"
                  onClick={handleCreate}
                  className={createBtnCls}
                >
                  {t.common.create}
                </button>
              </div>
            ) : onCreate && (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className={`w-full rounded flex items-center justify-center gap-1.5 ${footerBtn}`}
              >
                <Plus className={rowIcon} strokeWidth={2} />
                {t.workspace.newWorkspace}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
