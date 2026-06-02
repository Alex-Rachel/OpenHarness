"use client";

import { useMemo } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

import type { FitnessSpecSummary } from "@/client/hooks/use-harness-settings-data";

import { buildHarnessFitnessFilesDashboardModel } from "./harness-fitness-files-dashboard-model";
import { useTranslation } from "@/i18n";
import { HarnessUnsupportedState } from "./harness-support-state";
import { HarnessSectionCard, HarnessSectionStateFrame } from "./harness-section-card";

type HarnessFitnessFilesDashboardProps = {
  specFiles: FitnessSpecSummary[];
  selectedSpec: FitnessSpecSummary | null;
  loading: boolean;
  error?: string | null;
  unsupportedMessage?: string | null;
  embedded?: boolean;
};

function DimensionDensityTooltip({ active, payload }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) {
    return null;
  }

  const datum = payload[0]?.payload as {
    label: string;
    fileName: string;
    score: number;
    metricCount: number;
    hardGateCount: number;
    weight: number;
    thresholdPass: number;
    thresholdWarn: number;
  };

  return (
    <div className="rounded-sm border border-desktop-border bg-desktop-surface-elevated px-3 py-2 text-[11px] shadow-[var(--dt-shadow-md)]">
      <div className="font-semibold text-desktop-text-primary">{datum.label}</div>
      <div className="mt-1 text-desktop-text-secondary">{datum.fileName}</div>
      <div className="mt-2 text-desktop-text-primary">score {datum.score}</div>
      <div className="text-desktop-text-secondary">{datum.metricCount} metrics</div>
      <div className="text-desktop-text-secondary">{datum.hardGateCount} hard gates</div>
      <div className="text-desktop-text-secondary">weight {datum.weight}</div>
      <div className="text-desktop-text-secondary">pass {datum.thresholdPass} · warn {datum.thresholdWarn}</div>
    </div>
  );
}

export function HarnessFitnessFilesDashboard({
  specFiles,
  selectedSpec,
  loading,
  error,
  unsupportedMessage,
  embedded = false,
}: HarnessFitnessFilesDashboardProps) {
  const { t } = useTranslation();
  const model = useMemo(
    () => buildHarnessFitnessFilesDashboardModel(specFiles, selectedSpec),
    [selectedSpec, specFiles],
  );

  const content = (
    <>
      {unsupportedMessage ? (
        <HarnessUnsupportedState className="rounded-sm border border-[var(--dt-status-warning)]/25 bg-[var(--dt-status-warning-subtle)] px-4 py-4 text-[11px] text-[var(--dt-status-warning)]" />
      ) : null}

      {loading ? (
        <HarnessSectionStateFrame>{t.harness.fitnessFiles.loadingFiles}</HarnessSectionStateFrame>
      ) : null}

      {error ? <HarnessSectionStateFrame tone="error">{error}</HarnessSectionStateFrame> : null}

      {!unsupportedMessage && !loading && !error ? (
        <div className="mt-3" data-testid="harness-fitness-files-dashboard">
          <section className="rounded-sm border border-desktop-border bg-desktop-bg-primary/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-desktop-text-secondary">{t.harness.fitnessFiles.dimensionRadar}</div>
                <p className="mt-1 text-[12px] leading-5 text-desktop-text-secondary">
                  {t.harness.fitnessFiles.dimensionRadarDescription}
                </p>
              </div>
              {model.selectedDimension ? (
                <div className="rounded-full border border-[var(--dt-status-success)]/25 bg-[var(--dt-status-success-subtle)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--dt-status-success)]">
                  {model.selectedDimension.label} · score {model.selectedDimension.score}
                </div>
              ) : null}
            </div>

            {model.dimensions.length > 0 ? (
              <div className="mt-4 h-[360px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <RadarChart data={model.dimensions} outerRadius="70%">
                    <PolarGrid stroke="var(--dt-border-light)" />
                    <PolarAngleAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--dt-text-secondary)" }} />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, 100]}
                      tick={{ fontSize: 10, fill: "var(--dt-text-tertiary)" }}
                      tickCount={6}
                    />
                    <Tooltip content={(props) => <DimensionDensityTooltip {...props} />} />
                    <Radar
                      name={t.harness.fitnessFiles.specScore}
                      dataKey="score"
                      stroke="var(--dt-status-info)"
                      fill="var(--dt-status-info)"
                      fillOpacity={0.28}
                      isAnimationActive={false}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="mt-4 rounded-sm border border-dashed border-desktop-border px-3 py-5 text-sm text-desktop-text-secondary">
                {t.harness.fitnessFiles.noDimensionFiles}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </>
  );

  if (embedded) {
    return <div className="space-y-3">{content}</div>;
  }

  return (
    <HarnessSectionCard
      title="Entrix Fitness"
      variant="full"
    >
      {content}
    </HarnessSectionCard>
  );
}
