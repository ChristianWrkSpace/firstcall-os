"use client";

import { type ReactNode } from "react";

interface DockItem {
  icon: string;
  label: string;
  href: string;
  active?: boolean;
}

export function AmbientDock({ items }: { items: DockItem[] }) {
  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-3 py-2 rounded-lg border bg-[color:var(--color-surface)] shadow-sm" style={{ borderColor: "var(--color-edge)" }}>
      {items.map((item, i) => (
        <a
          key={i}
          href={item.href}
          title={item.label}
          className="flex items-center justify-center w-10 h-10 rounded-xl text-lg transition-all duration-200 hover:scale-110 relative group"
          style={{ backgroundColor: item.active ? "var(--color-surface-strong)" : "transparent" }}
        >
          <span>{item.icon}</span>
          {/* Tooltip on hover */}
          <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{ backgroundColor: "var(--color-surface-strong)", color: "var(--color-text-primary)", border: "1px solid var(--color-edge)" }}>
            {item.label}
          </span>
          {/* Active indicator */}
          {item.active && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#D97757]" />
          )}
        </a>
      ))}
    </nav>
  );
}
