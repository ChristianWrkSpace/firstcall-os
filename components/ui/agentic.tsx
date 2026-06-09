"use client";

import { cn } from "@/lib/cn";

export function AiBadge({
  className,
}: {
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium tracking-[0.15em] uppercase",
        "bg-[#5B82B8]/10 text-[#5B82B8] border border-[#5B82B8]/20",
        className
      )}
      title="AI-generated"
    >
      <svg className="w-2.5 h-2.5" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 0l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6z" />
      </svg>
      AI
    </span>
  );
}

export function ConfidenceMeter({
  level,
  className,
}: {
  level: "high" | "medium" | "low";
  className?: string;
}) {
  const color = level === "high" ? "#D97757" : level === "medium" ? "#F59E0B" : "#EF4444";
  const pct = level === "high" ? 92 : level === "medium" ? 65 : 38;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-[9px] font-medium tracking-[0.15em] uppercase text-[color:var(--color-text-muted)]">
        Confidence
      </span>
      <div className="flex-1 h-1 rounded-full bg-[color:var(--color-surface)]">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function InlineSuggestion({
  suggestion,
  onAccept,
  onDismiss,
}: {
  suggestion: string;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-[#5B82B8]/5 border border-[#5B82B8]/15">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <AiBadge />
          <span className="text-[10px] text-[color:var(--color-text-muted)]">suggests</span>
        </div>
        <p className="text-sm text-[color:var(--color-text-secondary)]">{suggestion}</p>
      </div>
      <div className="flex gap-1.5 shrink-0">
        <button
          onClick={onAccept}
          className="px-2.5 py-1 text-[10px] font-medium rounded-lg bg-[#5B82B8]/15 text-[#5B82B8] hover:bg-[#5B82B8]/25 transition-colors"
        >
          Apply
        </button>
        <button
          onClick={onDismiss}
          className="px-2.5 py-1 text-[10px] rounded-lg text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-secondary)] transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

export function AgentPulse({
  label,
  active = false,
}: {
  label: string;
  active?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "relative flex h-2 w-2",
          active && "animate-pulse-ambient"
        )}
      >
        <span
          className={cn(
            "inline-flex h-2 w-2 rounded-full",
            active ? "bg-[#D97757]" : "bg-[color:var(--color-text-muted)]"
          )}
        />
      </span>
      <span className={cn(
        "text-[10px] tracking-[0.15em] uppercase font-medium",
        active ? "text-[#D97757]" : "text-[color:var(--color-text-muted)]"
      )}>
        {label}
      </span>
    </span>
  );
}
