"use client";

import { cn } from "@/lib/cn";

type BadgeVariant = "neutral" | "primary" | "positive" | "caution" | "danger";

const badgeVariants: Record<BadgeVariant, string> = {
  neutral: "bg-[color:var(--color-surface-strong)] text-[color:var(--color-text-secondary)] border-[color:var(--color-edge-strong)]",
  primary: "bg-[color:var(--color-water-muted)] text-[color:var(--color-water)] border-[color:var(--color-water-edge)]",
  positive: "bg-[color:var(--color-verified-muted)] text-[color:var(--color-verified)] border-[color:var(--color-verified-edge)]",
  caution: "bg-[color:var(--color-attention-muted)] text-[color:var(--color-attention)] border-[color:var(--color-attention-edge)]",
  danger: "bg-[color:var(--color-blocker-muted)] text-[color:var(--color-blocker)] border-[color:var(--color-blocker-edge)]",
};

export function Badge({ children, variant = "neutral", className }: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded-[6px] text-xs font-medium border", badgeVariants[variant], className)}>{children}</span>;
}

export const statusVariant = (status: string): BadgeVariant => {
  const s = status.toLowerCase();
  if (["completed", "paid", "signed", "done", "approved"].includes(s)) return "positive";
  if (["cancelled", "voided", "rejected", "failed"].includes(s)) return "danger";
  if (["drying", "mitigation"].includes(s)) return "primary";
  if (["in_progress", "processing", "sent"].includes(s)) return "neutral";
  if (["lead", "inspection", "draft", "pending"].includes(s)) return "caution";
  return "neutral";
};
