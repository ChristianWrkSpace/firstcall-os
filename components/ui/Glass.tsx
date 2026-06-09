// Shared design primitives — Industrial Glassmorphism.
// Extracted from CommandCenterShell so other pages can adopt the look
// incrementally without re-implementing the same Tailwind soup.
//
// Tokens (see also CommandCenterShell):
//   • Foundation:  bg-[#0E1012] page background
//   • Surface:     bg-white/[0.03] backdrop-blur-2xl
//   • Edge:        border-white/[0.06] hairline
//   • Healing Blue: #6B8AD9
//   • Safety Teal:  #5FBDB0
//   • Intervention: amber-400
//   • Body text:   text-white/[0.92]

import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Tenebrism light levels — the one law that governs every surface.
 *   • stage   — the single lit hero. Brighter glass, accent glow, lifted.
 *   • surface — normal working content (~70% presence). The default.
 *   • shadow  — dimmed (~40%), recedes until summoned. The long tail.
 * Only ONE stage should be visible per viewport; teal/amber accent = live now.
 */
export type LightLevel = "stage" | "surface" | "shadow";

export function Glass({
  children,
  className = "",
  accent = "neutral",
  subtle = false,
  level = "surface",
  id,
}: {
  children: ReactNode;
  className?: string;
  accent?: "neutral" | "teal" | "amber" | "blue";
  subtle?: boolean;
  level?: LightLevel;
  id?: string;
}) {
  const ring =
    accent === "teal"
      ? "ring-[#5FBDB0]/15"
      : accent === "amber"
        ? "ring-amber-400/20"
        : accent === "blue"
          ? "ring-[#6B8AD9]/15"
          : "ring-white/[0.04]";

  // Light level drives surface brightness, border, blur and lift. Stage glows
  // with its accent; shadow falls back and brightens on hover (summonable).
  const accentGlow =
    accent === "amber"
      ? "shadow-[0_0_40px_-8px_rgba(245,158,11,0.25)]"
      : accent === "blue"
        ? "shadow-[0_0_40px_-8px_rgba(107,138,217,0.28)]"
        : "shadow-[0_0_40px_-8px_rgba(95,189,176,0.28)]";

  const levelClass =
    level === "stage"
      ? `bg-white/[0.055] border-white/[0.10] backdrop-blur-2xl ${accentGlow}`
      : level === "shadow"
        ? "bg-white/[0.015] border-white/[0.04] backdrop-blur-md opacity-55 hover:opacity-100 hover:bg-white/[0.035] transition-all duration-300"
        : "bg-white/[0.03] border-white/[0.06] backdrop-blur-2xl";

  const shadow =
    level === "stage"
      ? "" // accentGlow already carries the lift
      : subtle
        ? "shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]"
        : "shadow-[0_12px_48px_-16px_rgba(0,0,0,0.8)]";

  return (
    <div id={id} className={`rounded-2xl border ring-1 ${ring} ${levelClass} ${shadow} ${className}`}>
      {children}
    </div>
  );
}

/**
 * Stage — the lit hero block. A Glass at full presence with an entrance rise
 * and an optional eyebrow + title. Use for "what needs you right now".
 */
export function Stage({
  children,
  className = "",
  accent = "teal",
  eyebrow,
  title,
  right,
}: {
  children: ReactNode;
  className?: string;
  accent?: "teal" | "amber" | "blue";
  eyebrow?: string;
  title?: string;
  right?: ReactNode;
}) {
  return (
    <Glass level="stage" accent={accent} className={`p-5 md:p-6 animate-rise-in ${className}`}>
      {(eyebrow || title || right) && (
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            {eyebrow && (
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">{eyebrow}</p>
            )}
            {title && (
              <h2 className="text-lg md:text-xl font-semibold tracking-tight text-white/95 mt-0.5">
                {title}
              </h2>
            )}
          </div>
          {right}
        </div>
      )}
      {children}
    </Glass>
  );
}

/**
 * ShadowSection — a collapsed-by-default panel that lives in shadow until the
 * human pulls it into the light. Pure <details> so it works without JS and
 * stays server-renderable. This is the spine of the re-cut job-detail page.
 */
export function ShadowSection({
  title,
  emoji,
  hint,
  right,
  defaultOpen = false,
  lit = false,
  accent = "teal",
  id,
  children,
}: {
  title: string;
  emoji?: string;
  hint?: string;
  right?: ReactNode;
  defaultOpen?: boolean;
  lit?: boolean;
  accent?: "teal" | "amber" | "blue";
  id?: string;
  children: ReactNode;
}) {
  return (
    <Glass
      level={lit ? "stage" : "shadow"}
      accent={accent}
      id={id}
      className={`scroll-mt-20 ${lit ? "animate-rise-in" : ""}`}
    >
      <details open={defaultOpen || lit}>
        <summary className="cursor-pointer list-none select-none group flex items-start justify-between gap-3 p-5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight text-white/95">
              {emoji && <span className="mr-1.5">{emoji}</span>}
              {title}
              {lit && (
                <span className="ml-2 inline-flex items-center gap-1 align-middle text-[9px] uppercase tracking-[0.15em] text-[#A8DCD3]">
                  <span className="h-1 w-1 rounded-full bg-[#5FBDB0] animate-pulse-soft" /> live
                </span>
              )}
            </h2>
            {hint && <p className="text-[11px] text-white/40 mt-0.5 leading-relaxed">{hint}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {right}
            <span className="text-white/30 text-xs transition-transform group-open:rotate-90">▸</span>
          </div>
        </summary>
        <div className="px-5 pb-5 -mt-1">{children}</div>
      </details>
    </Glass>
  );
}

/** A small KPI tile with a rationed accent. */
export function MetricTile({
  label,
  value,
  accent = "teal",
}: {
  label: string;
  value: number | string;
  accent?: "blue" | "teal" | "emerald" | "violet";
}) {
  const ring =
    accent === "blue"
      ? "ring-blue-400/15"
      : accent === "emerald"
        ? "ring-emerald-400/20"
        : accent === "violet"
          ? "ring-violet-400/20"
          : "ring-[#5FBDB0]/20";
  const text =
    accent === "blue"
      ? "text-blue-200"
      : accent === "emerald"
        ? "text-emerald-300"
        : accent === "violet"
          ? "text-violet-200"
          : "text-[#A8DCD3]";
  return (
    <div className={`rounded-xl bg-white/[0.025] border border-white/[0.05] ring-1 ${ring} p-3`}>
      <p className="text-[10px] uppercase tracking-[0.15em] text-white/40">{label}</p>
      <p className={`text-xl font-semibold tracking-tight mt-1 ${text}`}>{value}</p>
    </div>
  );
}

/** A breathing status dot — the only thing allowed to use live teal at rest. */
export function PulseDot({ color = "#5FBDB0" }: { color?: string }) {
  return (
    <span className="relative inline-flex h-2 w-2">
      <span
        className="absolute inset-0 rounded-full animate-ping-slow"
        style={{ backgroundColor: color, opacity: 0.6 }}
      />
      <span
        className="relative inline-flex rounded-full h-2 w-2"
        style={{ backgroundColor: color }}
      />
    </span>
  );
}

export function PanelHeader({
  title,
  sub,
  right,
  emoji,
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
  emoji?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-white/95">
          {emoji && <span className="mr-1.5">{emoji}</span>}
          {title}
        </h2>
        {sub && <p className="text-[11px] text-white/40 mt-0.5">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

/**
 * PageTitle — the one header every surface opens with. Eyebrow (the section the
 * dock points at), title, optional subtitle/count, and a right-aligned action
 * slot. Standardizing this is most of what makes the app feel like one app.
 */
export function PageTitle({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3 flex-wrap mb-5">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">{eyebrow}</p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-white/95 mt-0.5">{title}</h1>
        {subtitle && <p className="text-white/45 text-sm mt-1">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

/**
 * PageShell — backdrop + the standard column + the standard header in one wrap.
 * Replaces the per-page `<PageBackdrop><div className="p-4 md:p-8 max-w-…">`
 * boilerplate so every surface shares the exact same frame.
 *   width: "narrow" (max-w-3xl) | "default" (4xl) | "wide" (5xl) | "full".
 */
export function PageShell({
  eyebrow,
  title,
  subtitle,
  action,
  width = "default",
  children,
}: {
  eyebrow?: string;
  title?: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  width?: "narrow" | "default" | "wide" | "full";
  children: ReactNode;
}) {
  const maxW =
    width === "narrow"
      ? "max-w-3xl"
      : width === "wide"
        ? "max-w-5xl"
        : width === "full"
          ? "max-w-7xl"
          : "max-w-4xl";
  return (
    <PageBackdrop>
      <div className={`p-4 md:p-8 ${maxW} mx-auto`}>
        {title && (
          <PageTitle eyebrow={eyebrow} title={title} subtitle={subtitle} right={action} />
        )}
        {children}
      </div>
    </PageBackdrop>
  );
}

/**
 * Band — a named "act" in a page. A quiet uppercase label over a hairline that
 * groups a run of sections into one movement. This is the vertebrae: it turns a
 * flat stack of equal-weight panels into a spine you can read top-to-bottom.
 */
export function Band({
  label,
  hint,
  right,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="flex items-baseline justify-between gap-3 mb-2.5 mt-1">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/35 font-medium">
            {label}
          </span>
          {hint && <span className="text-white/25 text-[11px] truncate">{hint}</span>}
        </div>
        {right}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

/**
 * GlassRow — the canonical list row. Every list in the app (jobs, estimates,
 * invoices, approvals, A/R, customers, partners…) is the same object: optional
 * leading glyph, a title block, a right-aligned trailing block, and a chevron
 * that lifts on hover. `href` makes it a Link; otherwise a div.
 */
export function GlassRow({
  href,
  leading,
  title,
  meta,
  sub,
  trailing,
  accent = "neutral",
  index,
  className = "",
}: {
  href?: string;
  leading?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  sub?: ReactNode;
  trailing?: ReactNode;
  accent?: "neutral" | "teal" | "amber" | "blue";
  index?: number;
  className?: string;
}) {
  const accentEdge =
    accent === "teal"
      ? "hover:border-[#5FBDB0]/25"
      : accent === "amber"
        ? "hover:border-amber-400/25"
        : accent === "blue"
          ? "hover:border-[#6B8AD9]/25"
          : "hover:border-white/[0.08]";
  const cls = `group rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.045] ${accentEdge} transition-all px-4 py-3.5 ${index != null ? "animate-rise-in" : ""} ${className}`;
  const style = index != null ? { animationDelay: `${Math.min(index, 12) * 35}ms` } : undefined;

  const inner = (
    <div className="flex items-center gap-4">
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        {meta && <div className="flex items-center gap-2.5 flex-wrap">{meta}</div>}
        <div className="text-white/95 text-sm font-semibold tracking-tight mt-1 truncate">
          {title}
        </div>
        {sub && <div className="text-white/40 text-xs mt-0.5 truncate">{sub}</div>}
      </div>
      {trailing && (
        <div className="shrink-0 text-right flex flex-col items-end gap-1">{trailing}</div>
      )}
      <span className="text-white/20 group-hover:text-white/50 transition-colors shrink-0">→</span>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className={cls} style={style}>
        {inner}
      </Link>
    );
  }
  return (
    <div className={cls} style={style}>
      {inner}
    </div>
  );
}

/** EmptyState — the one way the app says "nothing here yet". */
export function EmptyState({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-16 text-center">
      {icon && <div className="text-2xl mb-2 opacity-60">{icon}</div>}
      <p className="text-white/55 text-sm">{title}</p>
      {children && <div className="text-white/40 text-sm mt-1.5">{children}</div>}
    </div>
  );
}

export function PageBackdrop({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0E1012] text-white/[0.92]">
      {/* Soft radial glows */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          background:
            "radial-gradient(circle at 18% 12%, rgba(107,138,217,0.14) 0%, transparent 38%), radial-gradient(circle at 82% 88%, rgba(95,189,176,0.12) 0%, transparent 42%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.025] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='1'/></svg>\")",
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function CountChip({
  count,
  label,
  tone = "teal",
}: {
  count: number;
  label: string;
  tone?: "teal" | "amber" | "blue" | "neutral";
}) {
  const c =
    tone === "amber"
      ? "bg-amber-400/10 text-amber-300 ring-amber-400/20"
      : tone === "blue"
        ? "bg-[#6B8AD9]/10 text-[#A6B8E7] ring-[#6B8AD9]/20"
        : tone === "neutral"
          ? "bg-white/5 text-white/60 ring-white/10"
          : "bg-[#5FBDB0]/10 text-[#A8DCD3] ring-[#5FBDB0]/20";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md ring-1 text-[10px] uppercase tracking-wide ${c}`}
    >
      <span className="font-mono text-xs">{count}</span>
      <span>{label}</span>
    </span>
  );
}
