"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { desktopAwareFetch } from "@/client/utils/diagnostics";

interface McpStatusResponse {
  available: boolean;
  checkedAt: string;
  error?: string;
  activeServerCount: number;
  toolsHref: string;
  builtInServer: {
    name: string;
    enabled: boolean;
    endpoint: string;
    mode: string;
    toolCount: number;
  };
  customServers: {
    totalCount: number;
    enabledCount: number;
    disabledCount: number;
    persistenceSupported: boolean;
  };
}

interface McpStatusIndicatorProps {
  compact?: boolean;
  className?: string;
}

export function McpStatusIndicator({ compact = false, className = "" }: McpStatusIndicatorProps) {
  const [status, setStatus] = useState<McpStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [serversRes, toolsRes] = await Promise.all([
        desktopAwareFetch("/api/mcp-servers", { cache: "no-store" }),
        desktopAwareFetch("/api/mcp/tools", { cache: "no-store" }),
      ]);
      if (!serversRes.ok) throw new Error(`HTTP ${serversRes.status}`);
      if (!toolsRes.ok) throw new Error(`HTTP ${toolsRes.status}`);

      const serversData = await serversRes.json() as {
        servers?: Array<{ enabled?: boolean }>;
      };
      const toolsData = await toolsRes.json() as {
        mode?: string;
        tools?: unknown[];
      };
      const servers = serversData.servers ?? [];
      const enabledCustomCount = servers.filter((server) => server.enabled !== false).length;
      const disabledCustomCount = servers.length - enabledCustomCount;

      setStatus({
        available: true,
        checkedAt: new Date().toISOString(),
        activeServerCount: 1 + enabledCustomCount,
        toolsHref: "/settings/mcp?tab=tools",
        builtInServer: {
          name: "routa-coordination",
          enabled: true,
          endpoint: "/api/mcp",
          mode: toolsData.mode ?? "essential",
          toolCount: Array.isArray(toolsData.tools) ? toolsData.tools.length : 0,
        },
        customServers: {
          totalCount: servers.length,
          enabledCount: enabledCustomCount,
          disabledCount: disabledCustomCount,
          persistenceSupported: true,
        },
      });
    } catch {
      setStatus({
        available: false,
        checkedAt: new Date().toISOString(),
        error: "MCP status check failed",
        activeServerCount: 1,
        toolsHref: "/settings/mcp?tab=tools",
        builtInServer: {
          name: "routa-coordination",
          enabled: true,
          endpoint: "/api/mcp",
          mode: "essential",
          toolCount: 0,
        },
        customServers: {
          totalCount: 0,
          enabledCount: 0,
          disabledCount: 0,
          persistenceSupported: true,
        },
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const isChecking = loading && !status;
  const available = !!status?.available;
  const toneClass = isChecking
    ? "border-desktop-border text-desktop-text-tertiary bg-desktop-surface-muted"
    : available
      ? "border-[var(--dt-status-success)]/25 text-[var(--dt-status-success)] bg-[var(--dt-status-success-subtle)] hover:bg-[var(--dt-status-success-subtle)]"
      : "border-[var(--dt-status-warning)]/25 text-[var(--dt-status-warning)] bg-[var(--dt-status-warning-subtle)] hover:bg-[var(--dt-status-warning-subtle)]";
  const compactToneClass = isChecking
    ? "text-desktop-text-tertiary"
    : available
      ? "text-[var(--dt-status-success)]"
      : "text-[var(--dt-status-warning)]";
  const dotClass = isChecking
    ? "bg-desktop-text-tertiary animate-pulse"
    : available
      ? "bg-[var(--dt-status-success)]"
      : "bg-[var(--dt-status-warning)]";
  const label = isChecking
    ? "Checking MCP..."
    : available
      ? status.activeServerCount > 1
        ? `MCP ${status.activeServerCount} active`
        : "MCP ready"
      : "MCP unavailable";
  const title = isChecking
    ? "Checking MCP status"
    : available && status
      ? [
        `${status.builtInServer.name} · ${status.builtInServer.toolCount} tools · ${status.builtInServer.mode}`,
        status.customServers.totalCount > 0
          ? `${status.customServers.enabledCount}/${status.customServers.totalCount} custom servers enabled`
          : "No custom MCP servers configured",
        "Open MCP tools",
      ].join(" · ")
      : `${status?.error ?? "MCP unavailable"}. Open MCP tools.`;

  return (
    <div className="flex items-center">
      <Link
        href={status?.toolsHref ?? "/settings/mcp?tab=tools"}
        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] transition-colors ${
          compact ? "border-0 bg-transparent hover:bg-transparent" : toneClass
        } ${compact ? compactToneClass : toneClass} ${className}`}
        title={title}
        data-testid="mcp-status-indicator"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
        <span className="max-w-[140px] truncate">{label}</span>
      </Link>
    </div>
  );
}
