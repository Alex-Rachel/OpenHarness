"use client";

import { useId, useRef, useState } from "react";

import {
  BASE_URL_SUGGESTIONS,
  EMPTY_MODEL_FORM,
  SETTINGS_PANEL_BODY_MAX_HEIGHT,
  getModelDefinitionByAlias,
  inputCls,
  labelCls,
  linkActionCls,
  loadModelDefinitions,
  mutedTextCls,
  primaryActionCls,
  saveModelDefinitions,
  sectionHeadCls,
  settingsCardCls,
  type ModelDefinition,
} from "./settings-panel-shared";
import { dangerGhostIconButtonClassName, dangerRequiredMarkClassName, dangerTextClassName } from "./color-system";
import { useTranslation } from "@/i18n";
import { ChevronRight, Plus, Trash2 } from "lucide-react";


export function ModelsTab() {
  const [defs, setDefs] = useState<ModelDefinition[]>(() => loadModelDefinitions());
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [form, setForm] = useState<ModelDefinition>(EMPTY_MODEL_FORM);
  const [aliasError, setAliasError] = useState("");
  const baseUrlListId = useId();
  const aliasInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  const persist = (next: ModelDefinition[]) => {
    setDefs(next);
    saveModelDefinitions(next);
  };

  const handleUpdate = (idx: number, field: keyof ModelDefinition, value: string) => {
    persist(defs.map((definition, definitionIndex) => (definitionIndex === idx ? { ...definition, [field]: value } : definition)));
  };

  const handleDelete = (idx: number) => {
    if (!confirm(`${t.models.deleteConfirm} "${defs[idx].alias}"?`)) return;
    persist(defs.filter((_, definitionIndex) => definitionIndex !== idx));
    if (expandedIdx === idx) setExpandedIdx(null);
  };

  const handleAddModel = () => {
    const alias = form.alias.trim();
    const modelName = form.modelName.trim();
    if (!alias || !modelName) return;
    if (defs.some((definition) => definition.alias === alias)) {
      setAliasError(`"${alias}" ${t.models.aliasAlreadyExists}`);
      return;
    }
    persist([...defs, { ...form, alias, modelName }]);
    setForm(EMPTY_MODEL_FORM);
    setAliasError("");
    aliasInputRef.current?.focus();
  };

  const handleFormKey = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") handleAddModel();
  };

  const canAdd = form.alias.trim().length > 0 && form.modelName.trim().length > 0;

  return (
    <div className="px-4 py-4 space-y-4 overflow-y-auto" style={{ maxHeight: SETTINGS_PANEL_BODY_MAX_HEIGHT }}>
      <datalist id={baseUrlListId}>
        {BASE_URL_SUGGESTIONS.map((url) => <option key={url} value={url} />)}
      </datalist>

      <div className={`${settingsCardCls} space-y-3`}>
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-desktop-accent text-desktop-accent-text">
            <Plus className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}/>
          </div>
          <span className="text-xs font-semibold text-desktop-text-primary">{t.models.addModel}</span>
          <span className={`ml-auto hidden text-[10px] sm:block ${mutedTextCls}`}>{t.models.pressEnterToAdd}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className={labelCls}>{t.models.alias} <span className={dangerRequiredMarkClassName}>*</span></label>
            <input
              ref={aliasInputRef}
              autoFocus
              type="text"
              value={form.alias}
              onChange={(event) => {
                setForm({ ...form, alias: event.target.value });
                setAliasError("");
              }}
              onKeyDown={handleFormKey}
              placeholder={t.models.placeholderAlias}
              className={`${inputCls} ${aliasError ? "border-[var(--danger-border-strong)] focus:ring-[var(--danger-ring)]" : ""}`}
            />
            {aliasError && <p className={`text-[10px] ${dangerTextClassName}`}>{aliasError}</p>}
          </div>
          <div className="space-y-1">
            <label className={labelCls}>{t.models.modelName} <span className={dangerRequiredMarkClassName}>*</span></label>
            <input
              type="text"
              value={form.modelName}
              onChange={(event) => setForm({ ...form, modelName: event.target.value })}
              onKeyDown={handleFormKey}
              placeholder={t.models.placeholderModelName}
              className={`${inputCls} font-mono`}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className={labelCls}>{t.models.baseUrl}</label>
          <input
            type="url"
            list={baseUrlListId}
            value={form.baseUrl ?? ""}
            onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}
            onKeyDown={handleFormKey}
            placeholder={t.models.placeholderBaseUrl}
            className={`${inputCls} font-mono`}
          />
        </div>

        <div className="space-y-1">
          <label className={labelCls}>{t.models.apiKey}</label>
          <input
            type="password"
            value={form.apiKey ?? ""}
            onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
            onKeyDown={handleFormKey}
            placeholder={t.models.placeholderApiKey}
            autoComplete="off"
            className={`${inputCls} font-mono`}
          />
        </div>

        <button
          onClick={handleAddModel}
          disabled={!canAdd}
          className={`${primaryActionCls} w-full py-2`}
        >
          <Plus className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}/>
          {t.models.addModel}
        </button>
      </div>

      {defs.length > 0 && (
        <div className="space-y-1.5">
          <p className={sectionHeadCls}>{t.models.savedModels}</p>
          {defs.map((definition, idx) => {
            const isOpen = expandedIdx === idx;
            return (
              <div key={idx} className="overflow-hidden rounded-[var(--dt-radius-md)] border border-desktop-border bg-desktop-surface">
                <div className="flex items-center gap-2 bg-desktop-surface-muted px-3 py-2">
                  <button
                    onClick={() => setExpandedIdx(isOpen ? null : idx)}
                    className="flex-1 flex items-center gap-2 min-w-0 text-left"
                  >
                    <ChevronRight className={`w-3 h-3 text-desktop-text-tertiary shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}/>
                    <span className="truncate text-xs font-semibold text-desktop-text-primary">{definition.alias}</span>
                    <span className="truncate font-mono text-[10px] text-desktop-text-tertiary">→ {definition.modelName}</span>
                    {definition.baseUrl && (
                      <span className={`hidden truncate font-mono text-[10px] sm:block ${linkActionCls}`}>
                        {definition.baseUrl.replace(/https?:\/\//, "").substring(0, 30)}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(idx)}
                    className={`shrink-0 rounded p-1 ${dangerGhostIconButtonClassName}`}
                    title={t.common.delete}
                  >
                    <Trash2 className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}/>
                  </button>
                </div>
                {isOpen && (
                  <div className="space-y-2.5 border-t border-desktop-border p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className={labelCls}>{t.models.alias}</label>
                        <input type="text" value={definition.alias}
                          onChange={(event) => handleUpdate(idx, "alias", event.target.value)} className={inputCls} />
                      </div>
                      <div className="space-y-1">
                        <label className={labelCls}>{t.models.modelName}</label>
                        <input type="text" value={definition.modelName}
                          onChange={(event) => handleUpdate(idx, "modelName", event.target.value)} className={`${inputCls} font-mono`} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className={labelCls}>{t.models.baseUrl}</label>
                      <input type="url" list={baseUrlListId} value={definition.baseUrl ?? ""}
                        onChange={(event) => handleUpdate(idx, "baseUrl", event.target.value || "")}
                        placeholder={t.models.placeholderBaseUrl} className={`${inputCls} font-mono`} />
                    </div>
                    <div className="space-y-1">
                      <label className={labelCls}>{t.models.apiKey}</label>
                      <input type="password" value={definition.apiKey ?? ""}
                        onChange={(event) => handleUpdate(idx, "apiKey", event.target.value || "")}
                        placeholder={t.models.placeholderApiKey} autoComplete="off" className={`${inputCls} font-mono`} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <p className={`pt-1 text-[10px] ${mutedTextCls}`}>
            {t.models.aliasDescription}
          </p>
        </div>
      )}
    </div>
  );
}

export { getModelDefinitionByAlias };
