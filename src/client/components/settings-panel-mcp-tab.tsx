"use client";

import { useCallback, useEffect, useState } from "react";
import { Select } from "./select";
import { useTranslation } from "@/i18n";

import { desktopAwareFetch } from "../utils/diagnostics";
import {
  SETTINGS_PANEL_BODY_MAX_HEIGHT,
  iconActionCls,
  infoChipCls,
  inputCls,
  labelCls,
  linkActionCls,
  mutedTextCls,
  primaryActionCls,
  secondaryActionCls,
  sectionHeadCls,
  successChipCls,
  successSurfaceCls,
  warningChipCls,
} from "./settings-panel-shared";
import { dangerGhostIconButtonClassName, dangerSurfaceClassName } from "./color-system";
import { Plus, SquarePen, Trash2, ChevronLeft } from "lucide-react";


type McpServerType = "stdio" | "http" | "sse";

interface McpServerEntry {
  id: string;
  name: string;
  description?: string;
  type: McpServerType;
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  env?: Record<string, string>;
  enabled: boolean;
  workspaceId?: string;
}

interface McpServerForm {
  id: string;
  name: string;
  description: string;
  type: McpServerType;
  command: string;
  args: string;
  url: string;
  headers: string;
  env: string;
}

const EMPTY_MCP_FORM: McpServerForm = {
  id: "",
  name: "",
  description: "",
  type: "stdio",
  command: "",
  args: "",
  url: "",
  headers: "",
  env: "",
};

const TYPE_LABEL: Record<McpServerType, string> = {
  stdio: "Stdio",
  http: "HTTP",
  sse: "SSE",
};

const TYPE_CHIP: Record<McpServerType, string> = {
  stdio: infoChipCls,
  http: successChipCls,
  sse: warningChipCls,
};

async function getResponseErrorMessage(response: Response, fallback: string) {
  const data = await response.json().catch(() => null) as { error?: string } | null;
  return data?.error ?? fallback;
}

export function McpServersTab() {
  const [servers, setServers] = useState<McpServerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<McpServerForm>(EMPTY_MCP_FORM);
  const { t } = useTranslation();
  const tab = t.settings.mcpTab;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await desktopAwareFetch("/api/mcp-servers");
      if (!response.ok) {
        setError(await getResponseErrorMessage(response, t.errors.loadFailed));
        return;
      }
      const data = await response.json();
      setServers(data.servers ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [t.errors.loadFailed]);

  useEffect(() => {
    void load();
  }, [load]);

  const parseJsonSafe = (value: string): Record<string, string> | undefined => {
    if (!value.trim()) return undefined;
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        id: form.id.trim(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        type: form.type,
        enabled: true,
      };
      if (form.type === "stdio") {
        payload.command = form.command.trim();
        payload.args = form.args.trim() ? form.args.split(/\s+/) : [];
      } else {
        payload.url = form.url.trim();
        const headers = parseJsonSafe(form.headers);
        if (headers) payload.headers = headers;
      }
      const env = parseJsonSafe(form.env);
      if (env) payload.env = env;

      const response = await desktopAwareFetch("/api/mcp-servers", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await getResponseErrorMessage(response, t.errors.saveFailed));
      }
      await load();
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_MCP_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.saveFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(t.mcp.deleteConfirm.replace('{name}', name))) return;
    setLoading(true);
    try {
      const response = await desktopAwareFetch(`/api/mcp-servers?id=${id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(await getResponseErrorMessage(response, t.mcp.deleteFailed));
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.mcp.deleteFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (server: McpServerEntry) => {
    setLoading(true);
    try {
      const response = await desktopAwareFetch("/api/mcp-servers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: server.id, enabled: !server.enabled }),
      });
      if (!response.ok) {
        throw new Error(await getResponseErrorMessage(response, t.mcp.toggleFailed));
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.mcp.toggleFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (server: McpServerEntry) => {
    setEditingId(server.id);
    setForm({
      id: server.id,
      name: server.name,
      description: server.description ?? "",
      type: server.type,
      command: server.command ?? "",
      args: (server.args ?? []).join(" "),
      url: server.url ?? "",
      headers: server.headers ? JSON.stringify(server.headers, null, 2) : "",
      env: server.env ? JSON.stringify(server.env, null, 2) : "",
    });
    setShowForm(true);
  };

  const canSave = form.id.trim().length > 0
    && form.name.trim().length > 0
    && (form.type === "stdio" ? form.command.trim().length > 0 : form.url.trim().length > 0);

  if (showForm) {
    return (
      <div className="px-4 py-4 space-y-3 overflow-y-auto" style={{ maxHeight: SETTINGS_PANEL_BODY_MAX_HEIGHT }}>
        <div className="flex items-center gap-2 mb-1">
          <button onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_MCP_FORM); }}
            className={iconActionCls}>
            <ChevronLeft className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}/>
          </button>
          <p className={sectionHeadCls}>{editingId ? t.mcp.editServer : t.mcp.newServer}</p>
        </div>
        {error && <div className={`rounded p-2 text-xs ${dangerSurfaceClassName}`}>{error}</div>}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className={labelCls}>{tab.idLabel}</label>
              <input type="text" value={form.id}
                onChange={(event) => setForm({ ...form, id: event.target.value })}
                placeholder="my-mcp-server" disabled={!!editingId}
                className={`${inputCls} font-mono ${editingId ? "opacity-60" : ""}`} />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>{tab.nameLabel}</label>
              <input type="text" value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="My MCP Server" className={inputCls} />
            </div>
          </div>

          <div className="space-y-1">
            <label className={labelCls}>{tab.descriptionLabel}</label>
            <input type="text" value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Brief description" className={inputCls} />
          </div>

          <div className="space-y-1">
            <label className={labelCls}>{tab.typeLabel}</label>
            <Select value={form.type}
              onChange={(event) => setForm({ ...form, type: event.target.value as McpServerType })}
              className={inputCls}>
              <option value="stdio">{tab.typeStdio}</option>
              <option value="http">{tab.typeHttp}</option>
              <option value="sse">{tab.typeSse}</option>
            </Select>
          </div>

          {form.type === "stdio" ? (
            <>
              <div className="space-y-1">
                <label className={labelCls}>{tab.commandLabel}</label>
                <input type="text" value={form.command}
                  onChange={(event) => setForm({ ...form, command: event.target.value })}
                  placeholder="npx" className={`${inputCls} font-mono`} />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>{tab.argumentsLabel}</label>
                <input type="text" value={form.args}
                  onChange={(event) => setForm({ ...form, args: event.target.value })}
                  placeholder="-y @modelcontextprotocol/server-filesystem /path/to/dir"
                  className={`${inputCls} font-mono`} />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <label className={labelCls}>{tab.urlLabel}</label>
                <input type="url" value={form.url}
                  onChange={(event) => setForm({ ...form, url: event.target.value })}
                  placeholder="http://localhost:8080/mcp"
                  className={`${inputCls} font-mono`} />
              </div>
              <div className="space-y-1">
                <label className={labelCls}>{tab.headersLabel}</label>
                <textarea value={form.headers}
                  onChange={(event) => setForm({ ...form, headers: event.target.value })}
                  placeholder='{"Authorization": "Bearer sk-..."}'
                  rows={2} className={`${inputCls} font-mono text-[11px]`} />
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className={labelCls}>{tab.envVarsLabel}</label>
            <textarea value={form.env}
              onChange={(event) => setForm({ ...form, env: event.target.value })}
              placeholder='{"GITHUB_TOKEN": "ghp_xxx"}'
              rows={2} className={`${inputCls} font-mono text-[11px]`} />
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} disabled={!canSave || loading}
              className={`${primaryActionCls} flex-1 py-2`}>
              {editingId ? t.common.update : t.common.create}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_MCP_FORM); }}
              className={`${secondaryActionCls} px-4 py-2`}>
              {t.common.cancel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-3 overflow-y-auto" style={{ maxHeight: SETTINGS_PANEL_BODY_MAX_HEIGHT }}>
      <div className="flex items-center justify-between">
        <div>
          <p className={sectionHeadCls}>{tab.serverCount.replace('{count}', String(servers.length))}</p>
          <p className={`mt-0.5 text-[10px] ${mutedTextCls}`}>{t.mcp.description}</p>
        </div>
        <button onClick={() => { setForm(EMPTY_MCP_FORM); setEditingId(null); setShowForm(true); }}
          className={primaryActionCls}>
          <Plus className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}/>
          {tab.newButton}
        </button>
      </div>
      {error && <div className={`rounded p-2 text-xs ${dangerSurfaceClassName}`}>{error}</div>}

      <div className={`rounded-[var(--dt-radius-md)] p-3 ${successSurfaceCls}`}>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 shrink-0 rounded-full bg-[var(--dt-status-success)]" />
          <span className="flex-1 text-xs font-medium text-desktop-text-primary">routa-coordination</span>
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${successChipCls}`}>{tab.builtInHttp}</span>
          <span className="text-[10px] font-medium text-[var(--dt-status-success)]">{tab.builtInLabel}</span>
        </div>
        <p className="ml-4 mt-1 text-[10px] text-desktop-text-secondary">{tab.builtInDesc}</p>
      </div>

      {loading && servers.length === 0 && <p className={`py-6 text-center text-xs ${mutedTextCls}`}>{tab.loadingLabel}</p>}

      <div className="space-y-2">
        {servers.map((server) => (
          <div key={server.id} className={`rounded-lg border p-3 transition-colors ${
            server.enabled
              ? "border-desktop-border bg-desktop-surface"
              : "border-desktop-border bg-desktop-surface-muted opacity-60"
          }`}>
            <div className="flex items-center gap-2">
              <button onClick={() => handleToggle(server)}
                className={`w-7 h-4 rounded-full transition-colors relative shrink-0 ${
                  server.enabled ? "bg-desktop-accent" : "bg-desktop-surface-muted ring-1 ring-inset ring-desktop-border"
                }`}>
                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-desktop-surface-elevated shadow transition-transform ${
                  server.enabled ? "left-3.5" : "left-0.5"
                }`} />
              </button>

              <span className="flex-1 truncate text-xs font-medium text-desktop-text-primary">{server.name}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${TYPE_CHIP[server.type]}`}>{TYPE_LABEL[server.type]}</span>
              <button onClick={() => handleEdit(server)}
                className={iconActionCls} title={tab.editTitle}>
                <SquarePen className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}/>
              </button>
              <button onClick={() => handleDelete(server.id, server.name)}
                className={`rounded p-1 ${dangerGhostIconButtonClassName}`} title={tab.deleteTitle}>
                <Trash2 className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}/>
              </button>
            </div>
            {server.description && (
              <p className="ml-9 mt-1 text-[10px] text-desktop-text-secondary">{server.description}</p>
            )}
            <div className={`ml-9 mt-1 truncate font-mono text-[10px] ${mutedTextCls}`}>
              {server.type === "stdio" ? `${server.command} ${(server.args ?? []).join(" ")}` : server.url}
            </div>
          </div>
        ))}
      </div>

      {servers.length === 0 && !loading && !error && (
        <div className="text-center py-8">
          <p className={`mb-2 text-xs ${mutedTextCls}`}>{t.mcp.noServers}</p>
          <button onClick={() => { setForm(EMPTY_MCP_FORM); setEditingId(null); setShowForm(true); }}
            className={linkActionCls}>
            {t.mcp.addFirst}
          </button>
        </div>
      )}
    </div>
  );
}
