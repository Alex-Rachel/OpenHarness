"use client";

import { useTranslation } from "@/i18n";
import { RefreshCw, TriangleAlert, Zap, ArrowUp, ArrowDown, CircleCheck } from "lucide-react";


type StatCardProps = {
  label: string;
  value: string | number;
  max?: string | number;
  description?: string;
  trend?: "up" | "down" | "stable" | string;
  color?: "emerald" | "amber" | "blue" | "violet" | "red";
  icon?: React.ReactNode;
};

const COLOR_CLASSES = {
  emerald: {
    border: "border-[var(--dt-status-success)]/25",
    bg: "bg-[var(--dt-status-success-subtle)]",
    text: "text-[var(--dt-status-success)]",
    accent: "text-[var(--dt-status-success)]",
  },
  amber: {
    border: "border-[var(--dt-status-warning)]/25",
    bg: "bg-[var(--dt-status-warning-subtle)]",
    text: "text-[var(--dt-status-warning)]",
    accent: "text-[var(--dt-status-warning)]",
  },
  blue: {
    border: "border-[var(--dt-status-info)]/25",
    bg: "bg-[var(--dt-status-info-subtle)]",
    text: "text-[var(--dt-status-info)]",
    accent: "text-[var(--dt-status-info)]",
  },
  violet: {
    border: "border-desktop-border",
    bg: "bg-desktop-surface-muted",
    text: "text-desktop-text-primary",
    accent: "text-desktop-accent",
  },
  red: {
    border: "border-desktop-danger-border",
    bg: "bg-desktop-danger-subtle",
    text: "text-desktop-danger-text",
    accent: "text-desktop-danger-text",
  },
};

function StatCard({ label, value, max, description, trend, color = "blue", icon }: StatCardProps) {
  const colors = COLOR_CLASSES[color];
  
  return (
    <div className={`rounded-lg border ${colors.border} ${colors.bg} p-2.5 transition-all hover:shadow-sm`}>
      <div className="flex items-center gap-2">
        {icon && (
          <div className={`shrink-0 ${colors.accent}`}>
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className={`text-[10px] font-semibold uppercase tracking-wide ${colors.text} opacity-75`}>
            {label}
          </div>
          <div className={`mt-0.5 flex items-baseline gap-1 ${colors.text}`}>
            <span className="text-lg font-bold leading-none">
              {value}
            </span>
            {max && (
              <span className="text-[11px] opacity-70">
                / {max}
              </span>
            )}
          </div>
          {description && (
            <div className={`mt-0.5 text-[10px] ${colors.text} opacity-70`}>
              {description}
            </div>
          )}
          {trend && trend !== "stable" && (
            <div className="mt-1 flex items-center gap-1">
              {trend === "up" || (typeof trend === "string" && trend.startsWith("+")) ? (
                <ArrowUp className="h-3 w-3 text-[var(--dt-status-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"/>
              ) : null}
              {trend === "down" || (typeof trend === "string" && trend.startsWith("-")) ? (
                <ArrowDown className="h-3 w-3 text-desktop-danger-text" fill="none" viewBox="0 0 24 24" stroke="currentColor"/>
              ) : null}
              <span className="text-[10px] font-medium">{trend}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type HarnessHealthScoreCardsProps = {
  dimensionCount: number;
  metricCount: number;
  hardGateCount: number;
  hookCount?: number;
  workflowCount?: number;
  fitnessScore?: number;
};

export function HarnessHealthScoreCards({
  dimensionCount,
  metricCount,
  hardGateCount,
  hookCount = 0,
  workflowCount = 0,
  fitnessScore,
}: HarnessHealthScoreCardsProps) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label={t.settings.harness.healthCards.fitnessScore || "Fitness Score"}
        value={fitnessScore !== undefined ? fitnessScore : dimensionCount > 0 ? "—" : "N/A"}
        max={fitnessScore !== undefined ? 100 : undefined}
        description={`${dimensionCount} dimensions`}
        color="emerald"
        icon={
          <CircleCheck className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"/>
        }
      />
      <StatCard
        label={t.settings.harness.healthCards.hardGates || "Hard Gates"}
        value={hardGateCount}
        description={`${metricCount} total metrics`}
        color="amber"
        icon={
          <TriangleAlert className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"/>
        }
      />
      <StatCard
        label={t.settings.harness.healthCards.hooks || "Hook Systems"}
        value={hookCount}
        description="runtime hooks"
        color="blue"
        icon={
          <Zap className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"/>
        }
      />
      <StatCard
        label={t.settings.harness.healthCards.cicd || "CI/CD"}
        value={workflowCount}
        description="active workflows"
        color="violet"
        icon={
          <RefreshCw className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"/>
        }
      />
    </div>
  );
}

