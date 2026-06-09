"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { globalSearch, type SearchResult } from "@/app/actions/search";
import type { NavItem } from "@/lib/nav";

const TYPE_LABELS: Record<SearchResult["type"], string> = {
  job: "Jobs",
  customer: "Customers",
  equipment: "Equipment",
  partner: "Partners",
  outreach: "Outreach",
  call: "Calls",
};

// A unified command is either a place to GO (nav destination, resolved
// instantly client-side) or a thing we FOUND (entity, via globalSearch).
type GoCommand = { kind: "go"; href: string; label: string; icon: string; hint?: string };
type FoundCommand = { kind: "found"; result: SearchResult };
type Command = GoCommand | FoundCommand;

/**
 * CommandPalette — the command-first navigator. With the rail gone, ⌘K is how
 * you reach every destination (by intent) and every record (by search). Nav
 * destinations resolve instantly; entities stream in from globalSearch.
 */
export default function CommandPalette({ navItems = [] }: { navItems?: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // ⌘K / Ctrl+K to toggle
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // External "open palette" events (dock "Ask" button, mobile search)
  useEffect(() => {
    function openHandler() {
      setOpen(true);
    }
    window.addEventListener("open-command-palette", openHandler);
    return () => window.removeEventListener("open-command-palette", openHandler);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setActiveIndex(0);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  // Debounced entity search (nav matches are instant, below)
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await globalSearch(query);
        setResults(r);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  // Nav destinations that match the query (or all of them when empty).
  const navMatches = useMemo<GoCommand[]>(() => {
    const q = query.trim().toLowerCase();
    const all = navItems.map<GoCommand>((n) => ({
      kind: "go",
      href: n.href,
      label: n.label,
      icon: n.icon,
      hint: n.hint,
    }));
    if (!q) return all;
    return all.filter(
      (n) => n.label.toLowerCase().includes(q) || n.href.toLowerCase().includes(q)
    );
  }, [navItems, query]);

  // Combined, ordered command list — "Go to" first, then found entities.
  const commands = useMemo<Command[]>(
    () => [...navMatches, ...results.map<Command>((result) => ({ kind: "found", result }))],
    [navMatches, results]
  );

  useEffect(() => setActiveIndex(0), [commands.length]);

  const run = useCallback(
    (cmd: Command) => {
      setOpen(false);
      router.push(cmd.kind === "go" ? cmd.href : cmd.result.href);
    },
    [router]
  );

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, commands.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && commands[activeIndex]) {
      e.preventDefault();
      run(commands[activeIndex]);
    }
  }

  if (!open) return null;

  const foundGroups: Record<string, { cmd: FoundCommand; index: number }[]> = {};
  commands.forEach((cmd, index) => {
    if (cmd.kind !== "found") return;
    const t = cmd.result.type;
    (foundGroups[t] ||= []).push({ cmd, index });
  });

  return (
    <div
      onClick={() => setOpen(false)}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center p-4 pt-[15vh]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-2xl border border-white/[0.08] bg-[#15181B]/95 backdrop-blur-2xl ring-1 ring-[#5FBDB0]/10 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col animate-rise-in"
      >
        {/* Input */}
        <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-white/[0.06]">
          <SearchIcon className="w-5 h-5 text-[#5FBDB0]/70 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Where to? Search jobs, customers, equipment…"
            className="flex-1 bg-transparent text-white/90 text-sm placeholder:text-white/35 focus:outline-none"
          />
          {loading && <span className="text-white/40 text-xs">…</span>}
          <kbd className="text-white/40 text-[10px] px-1.5 py-0.5 bg-white/[0.05] rounded border border-white/[0.08]">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div className="overflow-y-auto max-h-[56vh]">
          {commands.length === 0 ? (
            <div className="px-4 py-10 text-center text-white/40 text-sm">
              {loading ? "Searching…" : query ? `Nothing for "${query}".` : "Start typing…"}
            </div>
          ) : (
            <>
              {navMatches.length > 0 && (
                <Group title="Go to">
                  {navMatches.map((n, i) => (
                    <Row
                      key={n.href}
                      active={i === activeIndex}
                      onHover={() => setActiveIndex(i)}
                      onClick={() => run(n)}
                      glyph={<span className="text-[15px]">{n.icon}</span>}
                      title={n.label}
                      subtitle={n.hint}
                    />
                  ))}
                </Group>
              )}

              {Object.entries(foundGroups).map(([type, rows]) => (
                <Group key={type} title={TYPE_LABELS[type as SearchResult["type"]] ?? type}>
                  {rows.map(({ cmd, index }) => (
                    <Row
                      key={cmd.result.id}
                      active={index === activeIndex}
                      onHover={() => setActiveIndex(index)}
                      onClick={() => run(cmd)}
                      glyph={<span className="text-[15px] text-[#A8DCD3]">{cmd.result.emoji}</span>}
                      title={cmd.result.title}
                      subtitle={cmd.result.subtitle}
                      meta={cmd.result.meta}
                    />
                  ))}
                </Group>
              ))}
            </>
          )}
        </div>

        <div className="px-4 py-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-white/40">
          <span>
            <Kbd>↑↓</Kbd> navigate · <Kbd>↵</Kbd> open · <Kbd>⌘K</Kbd> anywhere
          </span>
          <span>{commands.length} results</span>
        </div>
      </div>
    </div>
  );
}

/* ── Atoms ──────────────────────────────────────────────────────────────── */

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-4 pt-3 pb-1 text-white/35 text-[10px] uppercase tracking-[0.15em] font-semibold">
        {title}
      </p>
      {children}
    </div>
  );
}

function Row({
  active,
  onHover,
  onClick,
  glyph,
  title,
  subtitle,
  meta,
}: {
  active: boolean;
  onHover: () => void;
  onClick: () => void;
  glyph: React.ReactNode;
  title: string;
  subtitle?: string;
  meta?: string;
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onHover}
      className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
        active ? "bg-[#5FBDB0]/12" : "hover:bg-white/[0.04]"
      }`}
    >
      <span className="w-5 text-center shrink-0">{glyph}</span>
      <div className="min-w-0 flex-1">
        <p className="text-white/90 text-sm truncate">{title}</p>
        {subtitle && <p className="text-white/40 text-xs truncate">{subtitle}</p>}
      </div>
      {meta && <span className="text-white/40 text-xs shrink-0 capitalize">{meta}</span>}
      {active && <span className="text-[#5FBDB0] text-xs shrink-0">↵</span>}
    </button>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-1 py-0.5 bg-white/[0.05] rounded border border-white/[0.08]">{children}</kbd>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
      />
    </svg>
  );
}
