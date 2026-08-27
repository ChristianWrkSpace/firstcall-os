"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

export function BentoGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-1 md:grid-cols-12 gap-4", className)}>{children}</div>;
}

export function BentoCard({ children, span = 4, accent = "neutral", className }: {
  children: ReactNode; span?: 1|2|3|4|5|6|7|8|9|10|11|12; accent?: "neutral"|"teal"|"amber"|"blue"; className?: string; delay?: number;
}) {
  const accentRing = accent === "neutral" ? "ring-edge2" : accent === "teal" ? "ring-[#D97757]/20" : accent === "amber" ? "ring-[#F59E0B]/20" : "ring-[#5B82B8]/20";
  return (
    <div className={cn("rounded-lg p-5 bg-[color:var(--color-surface)] ring-1 border border-[color:var(--color-edge)]", accentRing, `md:col-span-${span}`, className)}>
      {children}
    </div>
  );
}
