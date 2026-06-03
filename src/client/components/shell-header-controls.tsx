"use client";

import { DockerStatusIndicator } from "./docker-status-indicator";
import { LanguageSwitcher } from "./language-switcher";
import { McpStatusIndicator } from "./mcp-status-indicator";
import { ThemeSwitcher } from "./theme-switcher";

const isWindows = typeof navigator !== "undefined" && /Win/i.test(navigator.platform || navigator.userAgent);

interface ShellHeaderControlsProps {
  className?: string;
  showPreferencesMenu?: boolean;
  compactStatus?: boolean;
}

export function ShellHeaderControls({
  className = "",
  showPreferencesMenu = false,
  compactStatus = false,
}: ShellHeaderControlsProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {!isWindows && (
        <div className="hidden lg:flex">
          <DockerStatusIndicator compact={compactStatus} />
        </div>
      )}
      <div className="hidden lg:flex">
        <McpStatusIndicator compact={compactStatus} />
      </div>
      {showPreferencesMenu ? (
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeSwitcher compact />
        </div>
      ) : null}
    </div>
  );
}
