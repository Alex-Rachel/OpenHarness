"use client";

import { useSyncExternalStore } from "react";

import { useTranslation } from "@/i18n";

import {
  getStoredThemePreference,
  resolveThemePreference,
  setThemePreference,
  subscribeToThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from "../utils/theme";
import { Moon, Sun, Monitor } from "lucide-react";


interface ThemeSwitcherProps {
  showLabel?: boolean;
  compact?: boolean;
  className?: string;
}

export function ThemeSwitcher({ showLabel = false, compact = false, className = "" }: ThemeSwitcherProps) {
  const { t } = useTranslation();
  const themeSnapshot = useSyncExternalStore(
    (onStoreChange) => subscribeToThemePreference(() => onStoreChange()),
    () => {
      const nextThemePreference = getStoredThemePreference();
      const nextResolvedTheme = resolveThemePreference(nextThemePreference);
      return `${nextThemePreference}:${nextResolvedTheme}` as const;
    },
    () => "system:light",
  );
  const [themePreference] = themeSnapshot.split(":") as [ThemePreference, ResolvedTheme];

  const buttonBaseClassName = compact
    ? "rounded-md p-1.5 transition-colors"
    : "rounded-md px-2 py-1 text-[11px] font-medium transition-colors";

  const renderButton = (nextTheme: ThemePreference) => {
    const active = themePreference === nextTheme;
    const label = nextTheme === "light" ? t.settings.light : nextTheme === "dark" ? t.settings.dark : t.settings.system;
    const title = nextTheme === "system" ? label : (themePreference === "system" ? `${label} · ${t.settings.system}` : label);

    return (
      <button
        key={nextTheme}
        type="button"
        onClick={() => {
          setThemePreference(nextTheme);
        }}
        className={`${buttonBaseClassName} ${
          active
            ? "bg-desktop-surface text-desktop-text-primary shadow-[var(--dt-shadow-sm)]"
            : "text-desktop-text-secondary hover:text-desktop-text-primary"
        }`}
        aria-pressed={active}
        aria-label={label}
        title={title}
      >
        <span className="flex items-center gap-1.5">
          {nextTheme === "light" ? (
            <Sun className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}/>
          ) : nextTheme === "dark" ? (
            <Moon className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}/>
          ) : (
            <Monitor className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}/>
          )}
          {!compact ? <span>{label}</span> : null}
        </span>
      </button>
    );
  };

  return (
    <div
      className={`flex items-center gap-1 rounded-[var(--dt-radius-md)] border border-desktop-border bg-desktop-surface-muted p-1 ${className}`}
    >
      {showLabel ? (
        <span className="px-1.5 text-[10px] font-medium uppercase tracking-wider text-desktop-text-tertiary">
          {t.settings.theme}
        </span>
      ) : null}
      {renderButton("light")}
      {renderButton("dark")}
      {renderButton("system")}
    </div>
  );
}
