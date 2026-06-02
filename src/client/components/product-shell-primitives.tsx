"use client";

import type { HTMLAttributes, ReactNode } from "react";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const toneClasses: Record<Tone, string> = {
  neutral: "border-desktop-border bg-desktop-surface-muted text-desktop-text-secondary",
  success: "border-[var(--dt-status-success)]/25 bg-[var(--dt-status-success-subtle)] text-[var(--dt-status-success)]",
  warning: "border-[var(--dt-status-warning)]/25 bg-[var(--dt-status-warning-subtle)] text-[var(--dt-status-warning)]",
  danger: "border-desktop-danger-border bg-desktop-danger-subtle text-desktop-danger-text",
  info: "border-[var(--dt-status-info)]/25 bg-[var(--dt-status-info-subtle)] text-[var(--dt-status-info)]",
};

export function ProductSurface({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "rounded-[var(--dt-radius-lg)] border border-desktop-border bg-desktop-surface shadow-[var(--dt-shadow-sm)]",
        className,
      )}
      {...props}
    />
  );
}

export function ProductPanel({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cx(
        "rounded-[var(--dt-radius-lg)] border border-desktop-border bg-desktop-surface-elevated shadow-[var(--dt-shadow-md)]",
        className,
      )}
      {...props}
    />
  );
}

export function ProductHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cx("flex flex-col gap-4 border-b border-desktop-border pb-5 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-desktop-text-tertiary">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-desktop-text-primary md:text-5xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 max-w-2xl text-sm leading-6 text-desktop-text-secondary">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function ProductPill({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}

export function ProductEmptyState({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("rounded-[var(--dt-radius-lg)] border border-dashed border-desktop-border bg-desktop-surface-muted p-6", className)}>
      <div className="max-w-md">
        <div className="text-sm font-semibold text-desktop-text-primary">{title}</div>
        {description ? <p className="mt-2 text-sm leading-6 text-desktop-text-secondary">{description}</p> : null}
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}
