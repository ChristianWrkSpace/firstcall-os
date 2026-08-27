"use client";

import { type ReactNode, type MouseEventHandler } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "glass" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-[color:var(--color-primary)] hover:bg-[#eef1f2] text-[#111315] border border-transparent",
  glass: "bg-[color:var(--color-surface-strong)] hover:bg-[color:var(--color-surface-raised)] text-[color:var(--color-text-primary)] border border-[color:var(--color-edge-strong)]",
  ghost: "text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-strong)] border border-transparent",
  danger: "bg-[color:var(--color-blocker-muted)] hover:bg-[#422020] text-[color:var(--color-blocker)] border border-[color:var(--color-blocker-edge)]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs rounded-[6px]",
  md: "px-4 py-2 text-sm rounded-[6px]",
  lg: "px-5 py-2.5 text-base rounded-[6px]",
};

export function Button({ variant = "primary", size = "md", loading = false, icon, children, className, disabled, onClick, type = "button" }: {
  variant?: ButtonVariant; size?: ButtonSize; loading?: boolean; icon?: ReactNode; children: ReactNode; className?: string; disabled?: boolean; onClick?: MouseEventHandler<HTMLButtonElement>; type?: "button" | "submit" | "reset";
}) {
  return (
    <button
      onClick={onClick}
      type={type}
      className={cn("inline-flex items-center justify-center gap-2 font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-text-primary)] disabled:opacity-40 disabled:cursor-not-allowed", variantClasses[variant], sizeClasses[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <svg aria-hidden="true" className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0A12 12 0 0 0 0 12h4Z" />
        </svg>
      ) : icon ? <span className="w-4 h-4" aria-hidden="true">{icon}</span> : null}
      {children}
    </button>
  );
}
