"use client";

import type { AgentRole, ModelTier, SpecialistConfig } from "./specialist-manager";

export const AGENT_ROLES = ["ROUTA", "CRAFTER", "GATE", "DEVELOPER"] as const;
export type AgentRoleKey = (typeof AGENT_ROLES)[number];

export const ROLE_DESCRIPTIONS: Record<AgentRoleKey, string> = {
  ROUTA: "Coordinator – plans & delegates",
  CRAFTER: "Implementation – writes code",
  GATE: "Verification – reviews code",
  DEVELOPER: "Solo – plans, implements & verifies",
};

const STORAGE_KEY = "routa.defaultProviders";
const CONNECTIONS_STORAGE_KEY = "routa.providerConnections";
const MODEL_DEFINITIONS_KEY = "routa.modelDefinitions";

export const SETTINGS_PANEL_HEIGHT = "92vh";
export const SETTINGS_PANEL_BODY_MAX_HEIGHT = "calc(92vh - 148px)";

export interface MemoryStats {
  heapUsedMB: number;
  heapTotalMB: number;
  externalMB: number;
  rssMB: number;
  arrayBuffersMB: number;
  usagePercentage: number;
  level: "normal" | "warning" | "critical";
  timestamp: string;
}

export interface MemoryResponse {
  current: MemoryStats;
  peaks: {
    heapUsedMB: number;
    rssMB: number;
  };
  growthRateMBPerMinute: number;
  sessionStore: {
    sessionCount: number;
    activeSseCount: number;
    streamingCount: number;
    totalHistoryMessages: number;
    totalPendingNotifications: number;
    staleSessionCount: number;
  };
  recommendations: string[];
}

export interface AgentModelConfig {
  provider?: string;
  model?: string;
  maxTurns?: number;
}

export interface DefaultProviderSettings {
  ROUTA?: AgentModelConfig;
  CRAFTER?: AgentModelConfig;
  GATE?: AgentModelConfig;
  DEVELOPER?: AgentModelConfig;
}

export function loadDefaultProviders(): DefaultProviderSettings {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: Record<string, unknown> = JSON.parse(raw);
    const normalized: DefaultProviderSettings = {};
    for (const role of AGENT_ROLES) {
      const value = parsed[role];
      if (!value) continue;
      normalized[role] = typeof value === "string" ? { provider: value } : (value as AgentModelConfig);
    }
    return normalized;
  } catch {
    return {};
  }
}

export function saveDefaultProviders(settings: DefaultProviderSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export interface ProviderConnectionConfig {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

export type ProviderConnectionsStorage = Record<string, ProviderConnectionConfig>;

export function loadProviderConnections(): ProviderConnectionsStorage {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CONNECTIONS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ProviderConnectionsStorage) : {};
  } catch {
    return {};
  }
}

export function loadProviderConnectionConfig(providerId: string): ProviderConnectionConfig {
  return loadProviderConnections()[providerId] ?? {};
}

export function saveProviderConnections(storage: ProviderConnectionsStorage): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CONNECTIONS_STORAGE_KEY, JSON.stringify(storage));
}

export interface ModelDefinition {
  alias: string;
  modelName: string;
  baseUrl?: string;
  apiKey?: string;
}

export function loadModelDefinitions(): ModelDefinition[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MODEL_DEFINITIONS_KEY);
    return raw ? (JSON.parse(raw) as ModelDefinition[]) : [];
  } catch {
    return [];
  }
}

export function saveModelDefinitions(defs: ModelDefinition[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MODEL_DEFINITIONS_KEY, JSON.stringify(defs));
}

export function getModelDefinitionByAlias(alias: string): ModelDefinition | undefined {
  if (!alias || typeof window === "undefined") return undefined;
  return loadModelDefinitions().find((definition) => definition.alias === alias);
}

export interface ProviderOption {
  id: string;
  name: string;
  status?: string;
  source?: "static" | "registry";
  command?: string;
}

export function isCustomProvider(provider: ProviderOption): boolean {
  return provider.id.startsWith("custom-");
}

export interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  providers: ProviderOption[];
  initialTab?: SettingsTab;
  onResetOnboarding?: () => void;
  variant?: "modal" | "page";
}

export type SettingsTab =
  | "providers"
  | "registry"
  | "roles"
  | "specialists"
  | "models"
  | "mcp"
  | "webhooks"
  | "schedules"
  | "workflows";

export const inputCls =
  "w-full rounded-[var(--dt-radius-sm)] border border-desktop-border bg-desktop-surface px-2 py-1.5 text-xs text-desktop-text-primary placeholder:text-desktop-text-muted focus:outline-none focus:ring-2 focus:ring-[var(--dt-focus-ring)]/20";
export const labelCls = "text-[10px] font-medium uppercase tracking-wider text-desktop-text-tertiary";
export const sectionHeadCls = "text-xs font-semibold uppercase tracking-wider text-desktop-text-tertiary";
export const settingsCardCls = "rounded-[var(--dt-radius-lg)] border border-desktop-border bg-desktop-surface p-4 shadow-[var(--dt-shadow-sm)]";
export const primaryActionCls =
  "inline-flex items-center justify-center gap-1.5 rounded-[var(--dt-radius-md)] bg-desktop-accent px-3 py-1.5 text-xs font-semibold text-desktop-accent-text shadow-[var(--dt-shadow-sm)] transition-colors hover:bg-desktop-accent-strong disabled:cursor-not-allowed disabled:opacity-40";
export const secondaryActionCls =
  "inline-flex items-center justify-center gap-1.5 rounded-[var(--dt-radius-md)] border border-desktop-border bg-desktop-surface px-3 py-1.5 text-xs font-medium text-desktop-text-secondary shadow-[var(--dt-shadow-sm)] transition-colors hover:bg-desktop-surface-muted hover:text-desktop-text-primary disabled:opacity-50";
export const quietActionCls =
  "inline-flex items-center justify-center gap-1.5 rounded-[var(--dt-radius-sm)] px-2 py-1 text-xs font-medium text-desktop-text-secondary transition-colors hover:bg-desktop-surface-muted hover:text-desktop-text-primary disabled:opacity-50";
export const iconActionCls =
  "rounded-[var(--dt-radius-sm)] p-1 text-desktop-text-tertiary transition-colors hover:bg-desktop-surface-muted hover:text-desktop-text-primary disabled:opacity-50";
export const linkActionCls =
  "text-xs font-medium text-desktop-accent transition-colors hover:text-desktop-accent-strong hover:underline";
export const mutedTextCls = "text-desktop-text-tertiary";
export const successChipCls =
  "border border-[var(--dt-status-success)]/25 bg-[var(--dt-status-success-subtle)] text-[var(--dt-status-success)]";
export const warningChipCls =
  "border border-[var(--dt-status-warning)]/25 bg-[var(--dt-status-warning-subtle)] text-[var(--dt-status-warning)]";
export const infoChipCls =
  "border border-[var(--dt-status-info)]/25 bg-[var(--dt-status-info-subtle)] text-[var(--dt-status-info)]";
export const neutralChipCls =
  "border border-desktop-border bg-desktop-surface-muted text-desktop-text-secondary";
export const successSurfaceCls =
  "border border-[var(--dt-status-success)]/25 bg-[var(--dt-status-success-subtle)] text-[var(--dt-status-success)]";
export const warningSurfaceCls =
  "border border-[var(--dt-status-warning)]/25 bg-[var(--dt-status-warning-subtle)] text-[var(--dt-status-warning)]";

export const BASE_URL_SUGGESTIONS = [
  "https://open.bigmodel.cn/api/anthropic",
  "https://api.minimax.io/anthropic",
  "https://api.minimaxi.com/anthropic",
  "https://api.deepseek.com/anthropic",
  "https://api.moonshot.ai/anthropic",
  "https://api.openai.com/v1",
  "https://api.anthropic.com/v1",
  "https://generativelanguage.googleapis.com/v1beta/openai",
];

export const EMPTY_MODEL_FORM: ModelDefinition = { alias: "", modelName: "", baseUrl: "", apiKey: "" };

export const TIER_LABELS: Record<ModelTier, string> = { FAST: "Fast", BALANCED: "Balanced", SMART: "Smart" };
export const ROLE_CHIP: Record<AgentRole, string> = {
  ROUTA: "role-chip-routa",
  CRAFTER: "role-chip-crafter",
  GATE: "role-chip-gate",
  DEVELOPER: "role-chip-developer",
};

export interface SpecialistForm {
  id: string;
  name: string;
  description: string;
  role: AgentRole;
  defaultModelTier: ModelTier;
  systemPrompt: string;
  roleReminder: string;
  model: string;
}

export const EMPTY_SPECIALIST_FORM: SpecialistForm = {
  id: "",
  name: "",
  description: "",
  role: "CRAFTER",
  defaultModelTier: "BALANCED",
  systemPrompt: "",
  roleReminder: "",
  model: "",
};

export type SpecialistsTabProps = {
  modelDefs: ModelDefinition[];
};

export type GroupedSpecialists = {
  category: string;
  label: string;
  specialists: SpecialistConfig[];
};
