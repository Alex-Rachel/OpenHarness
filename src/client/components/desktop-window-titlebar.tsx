"use client";

import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronDown, House, Minus, PanelLeft, Square, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { useTranslation } from "@/i18n";
import { desktopAwareFetch, isTauriRuntime } from "@/client/utils/diagnostics";

type MenuItem = {
  label: string;
  shortcut?: string;
  action: () => Promise<void> | void;
  tone?: "default" | "danger";
};

type MenuGroup = {
  id: string;
  label: string;
  items: MenuItem[];
};

type TauriWindowHandle = {
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  close: () => Promise<void>;
};

interface DesktopWindowTitlebarProps {
  workspaceId?: string | null;
}

function subscribeToRuntimeChange(): () => void {
  return () => {};
}

function getServerRuntimeSnapshot(): boolean {
  return false;
}

async function withCurrentWindow(action: (window: TauriWindowHandle) => Promise<void>): Promise<void> {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await action(getCurrentWindow());
}

async function runWindowAction(action: (window: TauriWindowHandle) => Promise<void>): Promise<void> {
  try {
    await withCurrentWindow(action);
  } catch (error) {
    // HTTP-based Tauri dev can render the titlebar before IPC is available.
    console.error("[DesktopWindowTitlebar] Window action failed:", error);
  }
}

function runDocumentCommand(command: string): void {
  try {
    document.execCommand(command);
  } catch {
    // Browser security rules can reject some commands; native fallback is intentionally silent.
  }
}

async function toggleToolMode(): Promise<void> {
  const res = await desktopAwareFetch("/api/mcp/tools", { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  const currentMode = data?.globalMode === "full" ? "full" : "essential";
  const nextMode = currentMode === "essential" ? "full" : "essential";

  await desktopAwareFetch("/api/mcp/tools", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: nextMode }),
  });

  window.location.reload();
}

function getWorkspaceIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/workspace\/([^/]+)/);
  return match?.[1] ?? null;
}

export function DesktopWindowTitlebar({ workspaceId }: DesktopWindowTitlebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const isVisible = useSyncExternalStore(
    subscribeToRuntimeChange,
    isTauriRuntime,
    getServerRuntimeSnapshot,
  );
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!openMenuId) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenuId(null);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenuId]);

  if (!isVisible) {
    return null;
  }

  const resolvedWorkspaceId = workspaceId?.trim() || getWorkspaceIdFromPath(pathname) || "default";
  const workspaceBaseHref = `/workspace/${encodeURIComponent(resolvedWorkspaceId)}`;
  const settingsHref = `/settings?workspaceId=${encodeURIComponent(resolvedWorkspaceId)}`;

  const navigate = (href: string) => {
    router.push(href);
  };

  const menuGroups: MenuGroup[] = [
    {
      id: "file",
      label: t.desktopWindow.fileMenu,
      items: [
        {
          label: t.desktopWindow.reload,
          shortcut: "Ctrl+R",
          action: () => window.location.reload(),
        },
        {
          label: t.desktopWindow.quit,
          shortcut: "Ctrl+Q",
          action: () => runWindowAction((window) => window.close()),
          tone: "danger",
        },
      ],
    },
    {
      id: "edit",
      label: t.desktopWindow.editMenu,
      items: [
        { label: t.desktopWindow.undo, shortcut: "Ctrl+Z", action: () => runDocumentCommand("undo") },
        { label: t.desktopWindow.redo, shortcut: "Ctrl+Shift+Z", action: () => runDocumentCommand("redo") },
        { label: t.desktopWindow.cut, shortcut: "Ctrl+X", action: () => runDocumentCommand("cut") },
        { label: t.desktopWindow.copy, shortcut: "Ctrl+C", action: () => runDocumentCommand("copy") },
        { label: t.desktopWindow.paste, shortcut: "Ctrl+V", action: () => runDocumentCommand("paste") },
        { label: t.desktopWindow.selectAll, shortcut: "Ctrl+A", action: () => runDocumentCommand("selectAll") },
      ],
    },
    {
      id: "view",
      label: t.desktopWindow.viewMenu,
      items: [
        {
          label: t.desktopWindow.toggleToolMode,
          shortcut: "Ctrl+Shift+T",
          action: toggleToolMode,
        },
      ],
    },
    {
      id: "window",
      label: t.desktopWindow.windowMenu,
      items: [
        { label: t.nav.home, shortcut: "Ctrl+1", action: () => navigate("/") },
        { label: t.nav.sessions, shortcut: "Ctrl+2", action: () => navigate(`${workspaceBaseHref}/sessions`) },
        { label: t.nav.kanban, shortcut: "Ctrl+3", action: () => navigate(`${workspaceBaseHref}/kanban`) },
        { label: t.nav.traces, shortcut: "Ctrl+4", action: () => navigate("/traces") },
        { label: t.nav.settings, shortcut: "Ctrl+,", action: () => navigate(settingsHref) },
      ],
    },
    {
      id: "help",
      label: t.desktopWindow.helpMenu,
      items: [
        { label: t.desktopWindow.installAgents, action: () => navigate("/settings/agents") },
        { label: t.desktopWindow.mcpTools, action: () => navigate("/mcp-tools") },
      ],
    },
  ];

  const runMenuAction = async (item: MenuItem) => {
    setOpenMenuId(null);
    try {
      await item.action();
    } catch {
      // Menu actions are best-effort because this titlebar also renders during HTTP-based Tauri dev.
    }
  };

  return (
    <div
      ref={rootRef}
      className="relative z-40 flex h-8 shrink-0 select-none items-center border-b border-desktop-border bg-desktop-surface text-desktop-text-secondary"
      data-testid="desktop-window-titlebar"
    >
      <div className="flex h-full items-center gap-1 pl-2">
        <div className="flex h-6 items-center gap-1.5 rounded-md px-1.5 text-[11px] font-medium text-desktop-text-primary">
          <PanelLeft className="h-3.5 w-3.5 text-desktop-text-tertiary" aria-hidden="true" />
          <span>{t.desktopWindow.appLabel}</span>
        </div>

        <div className="mx-1 h-4 w-px bg-desktop-border" />

        <nav className="flex h-full items-center gap-0.5" aria-label={t.desktopWindow.appLabel}>
          {menuGroups.map((group) => {
            const open = openMenuId === group.id;
            return (
              <div key={group.id} className="relative h-full">
                <button
                  type="button"
                  className={`flex h-full items-center gap-1 rounded-md px-2 text-[11px] transition-colors ${
                    open
                      ? "bg-desktop-surface-muted text-desktop-text-primary"
                      : "text-desktop-text-secondary hover:bg-desktop-surface-muted hover:text-desktop-text-primary"
                  }`}
                  aria-expanded={open}
                  aria-haspopup="menu"
                  onClick={() => setOpenMenuId(open ? null : group.id)}
                >
                  <span>{group.label}</span>
                  <ChevronDown className="h-3 w-3 opacity-60" aria-hidden="true" />
                </button>

                {open ? (
                  <div
                    className="absolute left-0 top-[30px] min-w-48 overflow-hidden rounded-[var(--dt-radius-md)] border border-desktop-border bg-desktop-surface-elevated p-1 shadow-[var(--dt-shadow-md)]"
                    role="menu"
                  >
                    {group.items.map((item) => (
                      <button
                        key={`${group.id}-${item.label}`}
                        type="button"
                        className={`flex w-full items-center justify-between gap-6 rounded-[var(--dt-radius-sm)] px-2.5 py-1.5 text-left text-[11px] transition-colors ${
                          item.tone === "danger"
                            ? "text-desktop-danger-text hover:bg-[var(--danger-subtle-hover)]"
                            : "text-desktop-text-secondary hover:bg-desktop-surface-muted hover:text-desktop-text-primary"
                        }`}
                        role="menuitem"
                        onClick={() => void runMenuAction(item)}
                      >
                        <span>{item.label}</span>
                        {item.shortcut ? (
                          <span className="font-mono text-[10px] text-desktop-text-tertiary">{item.shortcut}</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </div>

      <div
        className="app-drag-region flex h-full flex-1 items-center justify-center"
        data-tauri-drag-region=""
      >
        <div className="pointer-events-none hidden items-center gap-1 rounded-full border border-desktop-border/60 bg-desktop-surface-muted/70 px-2.5 py-0.5 text-[10px] text-desktop-text-tertiary sm:flex">
          <House className="h-3 w-3" aria-hidden="true" />
          <span>{pathname === "/" ? t.nav.home : t.desktopWindow.appLabel}</span>
        </div>
      </div>

      <div className="flex h-full items-center">
        <button
          type="button"
          className="flex h-full w-11 items-center justify-center text-desktop-text-secondary transition-colors hover:bg-desktop-surface-muted hover:text-desktop-text-primary"
          title={t.desktopWindow.minimize}
          aria-label={t.desktopWindow.minimize}
          onClick={() => void runWindowAction((window) => window.minimize())}
        >
          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="flex h-full w-11 items-center justify-center text-desktop-text-secondary transition-colors hover:bg-desktop-surface-muted hover:text-desktop-text-primary"
          title={t.desktopWindow.maximize}
          aria-label={t.desktopWindow.maximize}
          onClick={() => void runWindowAction((window) => window.toggleMaximize())}
        >
          <Square className="h-3 w-3" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="flex h-full w-11 items-center justify-center text-desktop-text-secondary transition-colors hover:bg-[var(--danger-subtle-hover)] hover:text-[var(--danger-fg)]"
          title={t.desktopWindow.closeWindow}
          aria-label={t.desktopWindow.closeWindow}
          onClick={() => void runWindowAction((window) => window.close())}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
