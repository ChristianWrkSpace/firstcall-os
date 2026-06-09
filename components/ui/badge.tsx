"use client";

import { cn } from "@/lib/cn";

type BadgeVariant = "neutral" | "primary" | "positive" | "caution" | "danger";

const badgeVariants: Record<BadgeVariant, string> = {
  neutral: "bg-[color:var(--color-surface)] text-[color:var(--color-text-secondary)] border-[color:var(--color-edge)]",
  primary: "bg-[#6B8AD9]/10 text-[#6B8AD9] border-[#6B8AD9]/20",
  positive: "bg-[#5FBDB0]/10 text-[#5FBDB0] border-[#5FBDB0]/20",
  caution: "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20",
  danger: "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20",
};

export function Badge({
  children,
  variant = "neutral",
  className,
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium tracking-[0.18em] uppercase border",
        badgeVariants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export const statusVariant = (status: string): BadgeVariant => {
  const s = status.toLowerCase();
  if (["completed", "paid", "signed", "done", "approved"].includes(s)) return "positive";
  if (["cancelled", "voided", "rejected", "failed"].includes(s)) return "danger";
  if (["drying", "mitigation", "in_progress", "processing", "sent"].includes(s)) return "primary";
  if (["lead", "inspection", "draft", "pending"].includes(s)) return "caution";
  return "neutral";
};
