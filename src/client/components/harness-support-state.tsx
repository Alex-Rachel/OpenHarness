"use client";
import { TriangleAlert } from "lucide-react";
import { useTranslation } from "@/i18n";


type MaybeMessage = string | null | undefined;

type HarnessUnsupportedStateProps = {
  className?: string;
};

const UNSUPPORTED_REPO_MARKERS = [
  "不存在或不是目录",
] as const;

export function getHarnessUnsupportedRepoMessage(...messages: MaybeMessage[]): string | null {
  const matched = messages.find((message) => (
    typeof message === "string"
    && UNSUPPORTED_REPO_MARKERS.some((marker) => message.includes(marker))
  ));

  if (!matched) {
    return null;
  }

  return "当前仓库路径无效或不可访问，当前页面无法渲染该视图。";
}

export function HarnessUnsupportedState({
  className,
}: HarnessUnsupportedStateProps) {
  const { t } = useTranslation();

  return (
    <div className={className ?? "mt-4 flex items-start gap-3 rounded-sm border border-[var(--dt-status-warning)]/25 bg-[var(--dt-status-warning-subtle)] px-4 py-4"}>
      <TriangleAlert className="h-5 w-5 shrink-0 text-[var(--dt-status-warning)]" viewBox="0 0 20 20" fill="currentColor"/>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-[var(--dt-status-warning)]">
          仓库不支持 Harness
        </div>
        <div className="mt-1 text-[12px] leading-5 text-[var(--dt-status-warning)]">
          {t.harness.supportState.invalidRepoPath}
        </div>
      </div>
    </div>
  );
}
