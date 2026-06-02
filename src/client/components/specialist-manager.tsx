"use client";

import { useState, useEffect, useCallback } from "react";
import { desktopAwareFetch } from "../utils/diagnostics";
import { Select } from "./select";
import { useTranslation } from "@/i18n";
import { SquarePen, Trash2, X, Briefcase } from "lucide-react";
import {
  iconActionCls,
  infoChipCls,
  inputCls,
  labelCls,
  mutedTextCls,
  neutralChipCls,
  primaryActionCls,
  secondaryActionCls,
  warningChipCls,
} from "./settings-panel-shared";
import { dangerGhostIconButtonClassName, dangerSurfaceClassName } from "./color-system";


// ─── Types ─────────────────────────────────────────────────────────────────

export interface SpecialistConfig {
  id: string;
  name: string;
  description?: string;
  role: AgentRole;
  defaultModelTier: ModelTier;
  systemPrompt: string;
  roleReminder: string;
  source: "user" | "bundled" | "hardcoded";
  enabled?: boolean;
  defaultProvider?: string;
  defaultAdapter?: string;
  model?: string;
}

export type AgentRole = "ROUTA" | "CRAFTER" | "GATE" | "DEVELOPER";
export type ModelTier = "FAST" | "BALANCED" | "SMART";

// Helper functions to get labels from translation
function getRoleLabels(t: ReturnType<typeof useTranslation>["t"]): Record<AgentRole, string> {
  return {
    ROUTA: t.specialists.coordinator,
    CRAFTER: t.specialists.implementor,
    GATE: t.specialists.verifier,
    DEVELOPER: t.specialists.developer,
  };
}

function getRoleDescriptions(t: ReturnType<typeof useTranslation>["t"]): Record<AgentRole, string> {
  return {
    ROUTA: t.specialists.coordinatorDesc,
    CRAFTER: t.specialists.implementorDesc,
    GATE: t.specialists.verifierDesc,
    DEVELOPER: t.specialists.developerDesc,
  };
}

function getTierLabels(t: ReturnType<typeof useTranslation>["t"]): Record<ModelTier, string> {
  return {
    FAST: t.specialists.fast,
    BALANCED: t.specialists.balanced,
    SMART: t.specialists.smart,
  };
}

// ─── Component Props ───────────────────────────────────────────────────────

interface SpecialistManagerProps {
  open: boolean;
  onClose: () => void;
}

interface SpecialistForm {
  id: string;
  name: string;
  description: string;
  role: AgentRole;
  defaultModelTier: ModelTier;
  systemPrompt: string;
  roleReminder: string;
  defaultProvider: string;
  defaultAdapter: string;
  model?: string;
}

// ─── Specialist Manager Component ───────────────────────────────────────────

export function SpecialistManager({ open, onClose }: SpecialistManagerProps) {
  const { t } = useTranslation();
  const requiresPostgresMessage = t.specialists.requiresPostgres;
  const failedToLoadMessage = t.specialists.failedToLoad;
  const [specialists, setSpecialists] = useState<SpecialistConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Form state
  const [form, setForm] = useState<SpecialistForm>({
    id: "",
    name: "",
    description: "",
    role: "CRAFTER",
    defaultModelTier: "BALANCED",
    systemPrompt: "",
    roleReminder: "",
    defaultProvider: "",
    defaultAdapter: "",
    model: "",
  });

  const loadSpecialists = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await desktopAwareFetch("/api/specialists");
      if (!response.ok) {
        if (response.status === 501) {
          setError(requiresPostgresMessage);
        } else {
          throw new Error(failedToLoadMessage);
        }
        return;
      }
      const data = await response.json();
      setSpecialists(data.specialists || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : failedToLoadMessage);
    } finally {
      setLoading(false);
    }
  }, [failedToLoadMessage, requiresPostgresMessage]);

  // Load specialists on open
  useEffect(() => {
    if (open) {
      void loadSpecialists();
    }
  }, [open, loadSpecialists]);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const response = await desktopAwareFetch("/api/specialists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      if (!response.ok) throw new Error(t.specialists.failedToSync);
      await loadSpecialists();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.specialists.failedToSync);
    } finally {
      setSyncing(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await desktopAwareFetch("/api/specialists", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t.specialists.failedToSave);
      }
      await loadSpecialists();
      setEditingId(null);
      setShowCreateForm(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.specialists.failedToSave);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t.specialists.deleteConfirm)) return;
    setLoading(true);
    setError(null);
    try {
      const response = await desktopAwareFetch(`/api/specialists?id=${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(t.specialists.failedToDelete);
      await loadSpecialists();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.specialists.failedToDelete);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (specialist: SpecialistConfig) => {
    setEditingId(specialist.id);
    setForm({
      id: specialist.id,
      name: specialist.name,
      description: specialist.description || "",
      role: specialist.role,
      defaultModelTier: specialist.defaultModelTier,
      systemPrompt: specialist.systemPrompt,
      roleReminder: specialist.roleReminder,
      defaultProvider: specialist.defaultProvider || "",
      defaultAdapter: specialist.defaultAdapter || "",
      model: specialist.model || "",
    });
    setShowCreateForm(true);
  };

  const resetForm = () => {
    setForm({
      id: "",
      name: "",
      description: "",
      role: "CRAFTER",
      defaultModelTier: "BALANCED",
      systemPrompt: "",
      roleReminder: "",
      defaultProvider: "",
      defaultAdapter: "",
      model: "",
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setShowCreateForm(false);
    resetForm();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Dialog */}
      <div className="relative mx-4 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[var(--dt-radius-lg)] border border-desktop-border bg-desktop-surface shadow-[var(--dt-shadow-md)]">
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-desktop-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-desktop-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}/>
            <h2 className="text-sm font-semibold text-desktop-text-primary">{t.specialists.manageSpecialists}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              className={secondaryActionCls}
            >
              {syncing ? `${t.common.loading}...` : t.specialists.sync}
            </button>
            <button
              onClick={onClose}
              className={iconActionCls}
            >
              <X className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}/>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5">
          {error && (
            <div className={`mb-4 rounded-[var(--dt-radius-md)] p-3 text-sm ${dangerSurfaceClassName}`}>
              <p>{error}</p>
            </div>
          )}

          {!showCreateForm ? (
            <>
              {/* Specialists List */}
              <div className="mb-4 flex justify-between items-center">
                <p className="text-sm text-desktop-text-secondary">
                  {specialists.length} {t.specialists.configured}
                </p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className={primaryActionCls}
                >
                  {t.specialists.newSpecialist}
                </button>
              </div>

              <div className="space-y-3">
                {specialists.map((specialist) => (
                  <div
                    key={specialist.id}
                    className="rounded-[var(--dt-radius-md)] border border-desktop-border bg-desktop-surface-muted p-4"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-desktop-text-primary">{specialist.name}</h3>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            specialist.source === "user"
                              ? warningChipCls
                              : specialist.source === "bundled"
                              ? infoChipCls
                              : neutralChipCls
                          }`}>
                            {t.specialists.source[specialist.source] || specialist.source}
                          </span>
                          <span className={`rounded px-2 py-0.5 text-xs ${neutralChipCls}`}>
                            {getRoleLabels(t)[specialist.role]}
                          </span>
                        </div>
                        {specialist.description && (
                          <p className="mb-2 text-sm text-desktop-text-secondary">{specialist.description}</p>
                        )}
                        <div className="space-y-1">
                          <p className={`text-xs ${mutedTextCls}`}>
                            {t.specialists.tier}: {getTierLabels(t)[specialist.defaultModelTier]}
                          </p>
                          {specialist.defaultProvider ? (
                            <p className={`text-xs ${mutedTextCls}`}>
                              {t.specialists.provider}: <span className="font-mono">{specialist.defaultProvider}</span>
                            </p>
                          ) : null}
                          {specialist.defaultAdapter ? (
                            <p className={`text-xs ${mutedTextCls}`}>
                              {t.specialists.adapter}: <span className="font-mono">{specialist.defaultAdapter}</span>
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        {specialist.source === "user" && (
                          <>
                            <button
                              onClick={() => handleEdit(specialist)}
                              className={iconActionCls}
                            >
                              <SquarePen className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}/>
                            </button>
                            <button
                              onClick={() => handleDelete(specialist.id)}
                              className={`rounded p-1.5 ${dangerGhostIconButtonClassName}`}
                            >
                              <Trash2 className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}/>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {specialists.length === 0 && !loading && (
                <div className={`py-12 text-center ${mutedTextCls}`}>
                  <p>{t.specialists.noSpecialistsFound} {t.specialists.noSpecialistsHint}</p>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Create/Edit Form */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-desktop-text-primary">
                  {editingId ? t.specialists.editSpecialist : t.specialists.newSpecialistForm}
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  {/* ID */}
                  <div>
                    <label className={labelCls}>
                      {t.specialists.id} *
                    </label>
                    <input
                      type="text"
                      value={form.id}
                      onChange={(e) => setForm({ ...form, id: e.target.value })}
                      disabled={!!editingId}
                      placeholder={t.specialists.idPlaceholder}
                      className={`${inputCls} px-3 py-2 text-sm disabled:opacity-50`}
                    />
                  </div>

                  {/* Name */}
                  <div>
                    <label className={labelCls}>
                      {t.specialists.name} *
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder={t.specialists.namePlaceholder}
                      className={`${inputCls} px-3 py-2 text-sm`}
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className={labelCls}>
                    {t.specialists.description}
                  </label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder={t.specialists.descriptionPlaceholder}
                    className={`${inputCls} px-3 py-2 text-sm`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Role */}
                  <div>
                    <label className={labelCls}>
                      {t.specialists.role} *
                    </label>
                    <Select
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value as AgentRole })}
                      className={`${inputCls} px-3 py-2 text-sm`}
                    >
                      {Object.entries(getRoleLabels(t)).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label} - {getRoleDescriptions(t)[key as AgentRole]}
                        </option>
                      ))}
                    </Select>
                  </div>

                  {/* Model Tier */}
                  <div>
                    <label className={labelCls}>
                      {t.specialists.defaultModelTier} *
                    </label>
                    <Select
                      value={form.defaultModelTier}
                      onChange={(e) => setForm({ ...form, defaultModelTier: e.target.value as ModelTier })}
                      className={`${inputCls} px-3 py-2 text-sm`}
                    >
                      {Object.entries(getTierLabels(t)).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Default Provider */}
                  <div>
                    <label className={labelCls}>
                      {t.specialists.defaultAcpProvider}
                    </label>
                    <input
                      type="text"
                      value={form.defaultProvider}
                      onChange={(e) => setForm({ ...form, defaultProvider: e.target.value })}
                      placeholder={t.specialists.defaultProviderPlaceholder}
                      className={`${inputCls} px-3 py-2 text-sm`}
                    />
                    <p className={`mt-1 text-xs ${mutedTextCls}`}>
                      {t.specialists.defaultProviderHint}
                    </p>
                  </div>

                  {/* Default Adapter */}
                  <div>
                    <label className={labelCls}>
                      {t.specialists.defaultAdapterLabel}
                    </label>
                    <input
                      type="text"
                      value={form.defaultAdapter}
                      onChange={(e) => setForm({ ...form, defaultAdapter: e.target.value })}
                      placeholder={t.specialists.defaultAdapterPlaceholder}
                      className={`${inputCls} px-3 py-2 text-sm`}
                    />
                    <p className={`mt-1 text-xs ${mutedTextCls}`}>
                      {t.specialists.defaultAdapterHint}
                    </p>
                  </div>
                </div>

                {/* Model Override */}
                <div>
                  <label className={labelCls}>
                    {t.specialists.modelOverride}
                  </label>
                  <input
                    type="text"
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    placeholder={t.specialists.modelOverridePlaceholder}
                    className={`${inputCls} px-3 py-2 text-sm`}
                  />
                  <p className={`mt-1 text-xs ${mutedTextCls}`}>
                    {t.specialists.modelOverrideHint}
                  </p>
                </div>

                {/* System Prompt */}
                <div>
                  <label className={labelCls}>
                    {t.specialists.systemPromptLabel} *
                  </label>
                  <textarea
                    value={form.systemPrompt}
                    onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
                    placeholder={t.specialists.systemPromptPlaceholder}
                    rows={8}
                    className={`${inputCls} px-3 py-2 font-mono text-sm`}
                  />
                </div>

                {/* Role Reminder */}
                <div>
                  <label className={labelCls}>
                    {t.specialists.roleReminderLabel}
                  </label>
                  <input
                    type="text"
                    value={form.roleReminder}
                    onChange={(e) => setForm({ ...form, roleReminder: e.target.value })}
                    placeholder={t.specialists.roleReminderPlaceholder}
                    className={`${inputCls} px-3 py-2 text-sm`}
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 border-t border-desktop-border pt-4">
                  <button
                    onClick={handleCancelEdit}
                    disabled={loading}
                    className={`${secondaryActionCls} px-4 py-2 text-sm`}
                  >
                    {t.specialists.cancel}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={loading || !form.id || !form.name || !form.systemPrompt}
                    className={`${primaryActionCls} px-4 py-2 text-sm`}
                  >
                    {loading ? t.specialists.saving : editingId ? t.common.update : t.common.create}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
