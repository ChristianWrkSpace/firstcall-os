"use client";

import { type ReactNode, type ElementType } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";

/* ─── Types ────────────────────────────────────────────────────── */
type Accent = "neutral" | "teal" | "amber" | "blue";
type Depth = "surface" | "elevated" | "floating";

const ACCENT_RING: Record<Accent, string> = {
  neutral: "ring-white/[0.06]",
  teal: "ring-[#5FBDB0]/25",
  amber: "ring-[#F59E0B]/25",
  blue: "ring-[#6B8AD9]/25",
};

const ACCENT_GLOW: Record<Accent, string> = {
  neutral: "",
  teal: "shadow-[0_0_32px_-8px_rgba(95,189,176,0.08)]",
  amber: "shadow-[0_0_32px_-8px_rgba(245,158,11,0.08)]",
  blue: "shadow-[0_0_32px_-8px_rgba(107,138,217,0.08)]",
};

const DEPTH_CLASS: Record<Depth, string> = {
  surface: "bg-[color:var(--color-surface)] backdrop-blur-2xl border-[color:var(--color-edge)]",
  elevated: "bg-[color:var(--color-surface-strong)] backdrop-blur-[28px] border-white/[0.08]",
  floating: "bg-[color:var(--color-surface-strong)] backdrop-blur-[40px] border-white/[0.10] shadow-[0_20px_64px_-24px_rgba(0,0,0,0.8)]",
};

/* ─── GlassV2 — The One True Glass Surface ─────────────────────── */
export function GlassV2({
  children,
  className,
  accent = "neutral",
  depth = "surface",
  as: Component = "div",
  motion: animate = true,
  ...props
}: {
  children: ReactNode;
  className?: string;
  accent?: Accent;
  depth?: Depth;
  as?: ElementType;
  motion?: boolean;
}) {
  const Comp = animate ? motion.create(Component as any) : Component;
  const animateProps = animate
    ? { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } }
    : {};

  return (
    <Comp
      className={cn(
        "rounded-2xl ring-1",
        DEPTH_CLASS[depth],
        ACCENT_RING[accent],
        ACCENT_GLOW[accent],
        className
      )}
      {...animateProps}
      {...props}
    >
      {children}
    </Comp>
  );
}

/* ─── PanelHeader ───────────────────────────────────────────────── */
export function PanelHeader({
  title,
  sub,
  right,
  emoji,
  className,
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
  emoji?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between mb-5", className)}>
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-[color:var(--color-text-primary)]">
          {emoji && <span className="mr-2">{emoji}</span>}
          {title}
        </h2>
        {sub && <p className="text-[11px] text-[color:var(--color-text-muted)] mt-0.5">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

/* ─── CountChip ─────────────────────────────────────────────────── */
type ChipTone = "neutral" | "teal" | "amber" | "blue";

const CHIP_TONE: Record<ChipTone, string> = {
  neutral: "bg-white/[0.04] text-white/70",
  teal: "bg-[#5FBDB0]/10 text-[#5FBDB0]",
  amber: "bg-[#F59E0B]/10 text-[#F59E0B]",
  blue: "bg-[#6B8AD9]/10 text-[#6B8AD9]",
};

export function CountChip({
  count,
  label,
  tone = "neutral",
}: {
  count: number;
  label?: string;
  tone?: ChipTone;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium tracking-[0.18em] uppercase backdrop-blur-md", CHIP_TONE[tone])}>
      <span className="tabular-nums">{count}</span>
      {label && <span>{label}</span>}
    </span>
  );
}

/* ─── PulseDot ──────────────────────────────────────────────────── */
export function PulseDot({ tone = "teal" }: { tone?: "teal" | "amber" | "blue" }) {
  const color = tone === "teal" ? "#5FBDB0" : tone === "amber" ? "#F59E0B" : "#6B8AD9";
  return (
    <span
      className="relative flex h-2.5 w-2.5"
      aria-label={tone === "teal" ? "Active" : tone === "amber" ? "Attention" : "Processing"}
    >
      <span className="animate-ping-ambient absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: color }} />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: color }} />
    </span>
  );
}

/* ─── PageBackdrop ──────────────────────────────────────────────── */
export function PageBackdrop({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative min-h-screen overflow-hidden", className)}>
      {/* Atmospheric layers */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className="absolute inset-0 animate-drift opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 12%, rgba(107,138,217,0.10) 0%, transparent 38%), radial-gradient(circle at 82% 88%, rgba(95,189,176,0.08) 0%, transparent 42%)",
          }}
        />
        <svg className="absolute inset-0 w-full h-full opacity-[0.025]" aria-hidden="true">
          <filter id="noise-svg">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#noise-svg)" />
        </svg>
      </div>
      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
