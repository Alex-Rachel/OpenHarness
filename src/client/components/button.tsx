"use client";

import React, { ButtonHTMLAttributes, forwardRef } from "react";
import { LoaderCircle } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "desktop-secondary" | "desktop-accent";
type ButtonSize = "xs" | "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, disabled, className = "", children, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded-[var(--dt-radius-md)] transition-all duration-[var(--dt-motion-fast)] focus:outline-none focus:ring-2 focus:ring-[var(--dt-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--dt-bg-primary)] disabled:cursor-not-allowed disabled:opacity-50";

    const variantStyles: Record<ButtonVariant, string> = {
      primary:
        "border border-transparent bg-desktop-accent text-desktop-accent-text shadow-[var(--dt-shadow-sm)] hover:bg-desktop-accent-strong",
      secondary:
        "border border-desktop-border bg-desktop-surface text-desktop-text-primary shadow-[var(--dt-shadow-sm)] hover:bg-desktop-surface-muted",
      ghost:
        "border border-transparent bg-transparent text-desktop-text-secondary hover:bg-desktop-surface-muted hover:text-desktop-text-primary",
      danger:
        "border border-transparent bg-[var(--danger-solid)] text-[var(--danger-on-solid)] hover:bg-[var(--danger-solid-hover)] focus:ring-[var(--danger-ring)]",
      "desktop-secondary":
        "border border-desktop-border bg-desktop-surface text-desktop-text-secondary shadow-[var(--dt-shadow-sm)] hover:bg-desktop-surface-muted hover:text-desktop-text-primary",
      "desktop-accent":
        "border border-transparent bg-desktop-accent text-desktop-accent-text shadow-[var(--dt-shadow-sm)] hover:bg-desktop-accent-strong",
    };

    const sizeStyles: Record<ButtonSize, string> = {
      xs: "px-2 py-1 text-xs",
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2 text-sm",
      lg: "px-6 py-3 text-base",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {loading && (
          <LoaderCircle className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}/>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
