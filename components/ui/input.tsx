"use client";

import { type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-[color:var(--color-text-secondary)]">
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          "w-full px-3 py-2 rounded-xl bg-[color:var(--color-surface)] border border-[color:var(--color-edge)] text-[color:var(--color-text-primary)] placeholder:text-[color:var(--color-text-muted)]",
          "focus:outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]/50 focus:border-transparent",
          "text-sm transition-colors duration-150",
          error && "border-[color:var(--color-danger)]/50 focus:ring-[color:var(--color-danger)]/50",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-[color:var(--color-danger)]">{error}</p>}
    </div>
  );
}
