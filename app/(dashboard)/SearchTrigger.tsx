"use client";

export default function SearchTrigger({
  variant = "sidebar",
}: {
  variant?: "sidebar" | "mobile" | "command-center";
}) {
  function open() {
    window.dispatchEvent(new Event("open-command-palette"));
  }

  if (variant === "mobile") {
    return (
      <button
        onClick={open}
        aria-label="Search"
        className="p-2 -mr-2 text-ink-2 hover:text-ink"
      >
        <SearchIcon className="w-5 h-5" />
      </button>
    );
  }

  if (variant === "command-center") {
    return (
      <button
        type="button"
        onClick={open}
        aria-label="Search jobs, customers, equipment, partners, outreach, and calls"
        className="w-full flex items-center gap-3 p-4 rounded-2xl border animate-spatial-rise text-left transition-colors hover:bg-[color:var(--color-surface-strong)]"
        style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-edge)" }}
      >
        <span className="text-lg" aria-hidden>⚡</span>
        <span className="flex-1 text-base text-[color:var(--color-text-muted)]">
          Search jobs, customers, equipment, partners, outreach, and calls…
        </span>
        <kbd className="hidden md:inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-medium text-[color:var(--color-text-muted)] bg-[color:var(--color-surface-strong)] border border-[color:var(--color-edge)]">⌘K</kbd>
      </button>
    );
  }

  return (
    <button
      onClick={open}
      className="mx-2 mt-3 mb-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-shade border border-edge2/60 text-ink-2 hover:text-ink hover:border-edge2 transition-colors text-sm"
    >
      <SearchIcon className="w-4 h-4" />
      <span className="flex-1 text-left">Search…</span>
      <kbd className="text-[10px] text-ink-3 px-1 py-0.5 bg-card rounded border border-edge2">
        ⌘K
      </kbd>
    </button>
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
