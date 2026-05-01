"use client";

import { useState } from "react";

export default function SectionHeader({
  title,
  hint,
  emoji,
  size = "md",
}: {
  title: string;
  hint?: string;
  emoji?: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <div className="flex items-center gap-1.5">
        <h2
          className={`text-white font-semibold ${size === "sm" ? "text-sm" : ""}`}
        >
          {emoji && <span className="mr-1.5">{emoji}</span>}
          {title}
        </h2>
        {hint && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Hide details" : "What is this?"}
            aria-expanded={open}
            className="text-zinc-500 hover:text-white text-[10px] w-4 h-4 rounded-full border border-zinc-700 hover:border-zinc-500 flex items-center justify-center transition-colors leading-none shrink-0"
          >
            ?
          </button>
        )}
      </div>
      {open && hint && (
        <p className="text-zinc-500 text-xs leading-relaxed">{hint}</p>
      )}
    </div>
  );
}
