"use client";

import { type ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";

export function BentoGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-12 gap-4", className)}>
      {children}
    </div>
  );
}

export function BentoCard({
  children,
  span = 4,
  accent = "neutral",
  className,
  delay = 0,
}: {
  children: ReactNode;
  span?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  accent?: "neutral" | "teal" | "amber" | "blue";
  className?: string;
  delay?: number;
}) {
  const accentGlow = accent === "neutral" ? "" :
    accent === "teal" ? "shadow-[0_0_24px_-8px_rgba(95,189,176,0.06)]" :
    accent === "amber" ? "shadow-[0_0_24px_-8px_rgba(245,158,11,0.06)]" :
    "shadow-[0_0_24px_-8px_rgba(107,138,217,0.06)]";

  const accentRing = accent === "neutral" ? "ring-white/[0.06]" :
    accent === "teal" ? "ring-[#5FBDB0]/20" :
    accent === "amber" ? "ring-[#F59E0B]/20" :
    "ring-[#6B8AD9]/20";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: delay * 0.08, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "rounded-2xl p-5 bg-[color:var(--color-surface)] backdrop-blur-2xl ring-1 border border-[color:var(--color-edge)]",
        accentRing,
        accentGlow,
        `md:col-span-${span}`,
        className
      )}
    >
      {children}
    </motion.div>
  );
}
