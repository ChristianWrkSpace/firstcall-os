"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import Logo from "@/components/Logo";
import type { NavItem } from "@/lib/nav";

/**
 * AppDock — the command-first replacement for the 20-item SaaS rail.
 *
 * A whisper-thin vertical glass dock: a few primary verbs as glyphs in the
 * dark, each lighting up with a flyout label on hover. The long tail of the
 * old rail lives behind the ⌘K palette ("Ask"), reached by intent. Tagged
 * with viewTransitionName=app-dock so it stays anchored while pages glide.
 */
export default function AppDock({
  items,
  me,
}: {
  items: NavItem[];
  me: { name: string; role: string };
}) {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (pathname === href) return true;
    return pathname.startsWith(href + "/");
  }

  function openPalette() {
    window.dispatchEvent(new Event("open-command-palette"));
  }

  return (
    <aside
      style={{ viewTransitionName: "app-dock" }}
      className="hidden md:flex w-16 shrink-0 flex-col items-center py-4 gap-2 bg-white/[0.02] backdrop-blur-2xl border-r border-white/[0.06] z-30"
    >
      {/* Brand mark — home */}
      <Link
        href="/command-center"
        aria-label="FirstCall OS — home"
        className="mb-1 h-10 w-10 rounded-xl flex items-center justify-center hover:bg-white/[0.04] transition-colors"
      >
        <Logo variant="mark" size={26} priority />
      </Link>

      {/* Ask / search — the primary way to go anywhere or do anything */}
      <DockButton onClick={openPalette} label="Ask · ⌘K" glyph={<AskGlyph />} primary />

      <div className="my-1 h-px w-6 bg-white/[0.06]" />

      {/* Primary verbs */}
      <nav className="flex flex-col items-center gap-1.5">
        {items.map((item) => (
          <DockLink
            key={item.href}
            href={item.href}
            label={item.label}
            glyph={<span className="text-[17px] leading-none">{item.icon}</span>}
            active={isActive(item.href)}
          />
        ))}
      </nav>

      {/* Footer — role chip + sign out */}
      <div className="mt-auto flex flex-col items-center gap-2">
        <span
          title={`${me.name} · ${me.role}`}
          className="h-9 w-9 rounded-full bg-gradient-to-br from-[#6B8AD9]/40 to-[#5FBDB0]/40 ring-1 ring-white/10 flex items-center justify-center text-[11px] font-semibold text-white/90 uppercase"
        >
          {(me.name?.[0] ?? "?").toUpperCase()}
        </span>
        <form action={signOut}>
          <DockButton type="submit" label="Sign out" glyph={<span className="text-base leading-none">→</span>} />
        </form>
      </div>
    </aside>
  );
}

/* ── Dock atoms ─────────────────────────────────────────────────────────── */

function DockLink({
  href,
  label,
  glyph,
  active,
}: {
  href: string;
  label: string;
  glyph: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link href={href} className="group relative">
      <span
        className={`h-10 w-10 rounded-xl flex items-center justify-center transition-colors ${
          active
            ? "bg-white/[0.07] text-white ring-1 ring-[#5FBDB0]/30"
            : "text-white/55 hover:text-white hover:bg-white/[0.04]"
        }`}
      >
        {glyph}
      </span>
      {active && (
        <span className="absolute -left-[7px] top-1/2 -translate-y-1/2 h-5 w-1 rounded-full bg-[#5FBDB0]" aria-hidden />
      )}
      <Flyout label={label} />
    </Link>
  );
}

function DockButton({
  onClick,
  label,
  glyph,
  primary = false,
  type = "button",
}: {
  onClick?: () => void;
  label: string;
  glyph: React.ReactNode;
  primary?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button type={type} onClick={onClick} className="group relative" aria-label={label}>
      <span
        className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all ${
          primary
            ? "bg-gradient-to-br from-[#6B8AD9] to-[#5FBDB0] text-white shadow-[0_0_18px_rgba(95,189,176,0.3)] hover:shadow-[0_0_26px_rgba(95,189,176,0.45)]"
            : "text-white/45 hover:text-white hover:bg-white/[0.04]"
        }`}
      >
        {glyph}
      </span>
      <Flyout label={label} />
    </button>
  );
}

function Flyout({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-[52px] top-1/2 -translate-y-1/2 z-50 whitespace-nowrap rounded-lg bg-[#15181B] border border-white/[0.08] px-2.5 py-1 text-xs text-white/90 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.8)]">
      {label}
    </span>
  );
}

function AskGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
