"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { globalSearch, type SearchResult } from "@/app/actions/search";

const TYPE_LABELS: Record<SearchResult["type"], string> = {
  job: "Jobs",
  customer: "Customers",
  equipment: "Equipment",
  partner: "Partners",
  outreach: "Outreach",
  call: "Calls",
};

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Cmd+K / Ctrl+K to toggle
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Listen for external "open palette" events (header button)
  useEffect(() => {
    function openHandler() {
      setOpen(true);
    }
    window.addEventListener("open-command-palette", openHandler);
    return () => window.removeEventListener("open-command-palette", openHandler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setActiveIndex(0);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  // Debounced search
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
        setActiveIndex(0);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const navigate = useCallback(
    (result: SearchResult) => {
      setOpen(false);
      router.push(result.href);
    },
    [router]
  );

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIndex]) {
      e.preventDefault();
      navigate(results[activeIndex]);
    }
  }

  if (!open) return null;

  // Group results by type
  const grouped: Record<string, SearchResult[]> = {};
  for (const r of results) {
    if (!grouped[r.type]) grouped[r.type] = [];
    grouped[r.type].push(r);
  }

  return (
    <div
      onClick={() => setOpen(false)}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center p-4 pt-[15vh]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-card border border-edge2 rounded-xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-edge2">
          <SearchIcon className="w-5 h-5 text-ink-3 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search jobs, customers, equipment, partners…"
            className="flex-1 bg-transparent text-ink text-sm placeholder:text-ink-3 focus:outline-none"
          />
          {loading && <span className="text-ink-3 text-xs">…</span>}
          <kbd className="text-ink-3 text-[10px] px-1.5 py-0.5 bg-shade rounded border border-edge2">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div className="overflow-y-auto max-h-[50vh]">
          {query.length < 2 ? (
            <div className="px-4 py-10 text-center text-ink-3 text-sm">
              Type 2+ characters to search.
              <p className="text-xs mt-2">
                <kbd className="text-ink-3 text-[10px] px-1.5 py-0.5 bg-shade rounded border border-edge2">
                  ⌘K
                </kbd>{" "}
                to open from anywhere.
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-10 text-center text-ink-3 text-sm">
              {loading ? "Searching…" : `No results for "${query}".`}
            </div>
          ) : (
            <div>
              {Object.entries(grouped).map(([type, items]) => (
                <div key={type}>
                  <p className="px-4 pt-3 pb-1 text-ink-3 text-[10px] uppercase tracking-wide font-semibold">
                    {TYPE_LABELS[type as SearchResult["type"]] ?? type}
                  </p>
                  {items.map((r) => {
                    const i = results.indexOf(r);
                    const active = i === activeIndex;
                    return (
                      <button
                        key={r.id}
                        onClick={() => navigate(r)}
                        onMouseEnter={() => setActiveIndex(i)}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                          active ? "bg-cta/20" : "hover:bg-shade/60"
                        }`}
                      >
                        <span className="text-base shrink-0 text-info">
                          {r.emoji}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-ink text-sm truncate">{r.title}</p>
                          <p className="text-ink-2 text-xs truncate">
                            {r.subtitle}
                          </p>
                        </div>
                        {r.meta && (
                          <span className="text-ink-3 text-xs shrink-0 capitalize">
                            {r.meta}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-edge2 flex items-center justify-between text-[10px] text-ink-3">
          <span>
            <kbd className="px-1 py-0.5 bg-shade rounded border border-edge2">↑↓</kbd>{" "}
            navigate ·{" "}
            <kbd className="px-1 py-0.5 bg-shade rounded border border-edge2">↵</kbd>{" "}
            open
          </span>
          <span>{results.length} results</span>
        </div>
      </div>
    </div>
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
