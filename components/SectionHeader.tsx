"use client";

import { useId, useState } from "react";

export default function SectionHeader({ title, hint, size = "md" }: {
  title: string;
  hint?: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const hintId = useId();

  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <div className="flex items-center gap-2">
        <h2 className={`text-[color:var(--color-text-primary)] font-semibold leading-tight ${size === "sm" ? "text-sm" : "text-base"}`}>{title}</h2>
        {hint && (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? "Hide details" : `About ${title}`}
            aria-expanded={open}
            aria-controls={hintId}
            className="text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)] w-6 h-6 rounded-[6px] border border-[color:var(--color-edge)] hover:border-[color:var(--color-edge-strong)] flex items-center justify-center transition-colors leading-none shrink-0"
          >
            <span aria-hidden="true">?</span>
          </button>
        )}
      </div>
      {open && hint && <p id={hintId} className="text-[color:var(--color-text-muted)] text-sm leading-relaxed max-w-prose">{hint}</p>}
    </div>
  );
}
