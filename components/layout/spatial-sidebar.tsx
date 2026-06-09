"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { NavSection, NavItem } from "@/lib/nav";

export function SpatialSidebar({ sections, activePath, logo, footer, className }: {
  sections: readonly NavSection[]; activePath: string; logo?: ReactNode; footer?: ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex flex-col h-full", className)}>
      {logo && <div className="px-4 py-5">{logo}</div>}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-6">
        {sections.map((section, si) => (
          <div key={si}>
            <p className="px-3 mb-1.5 text-[9px] font-medium tracking-[0.2em] uppercase text-[color:var(--color-text-muted)]">{section.title}</p>
            <ul className="space-y-0.5">
              {section.items.map((item, ii) => {
                const isActive = activePath === item.href || activePath?.startsWith(item.href + "/");
                return (
                  <li key={ii}>
                    <a href={item.href} className={cn("flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-150 group",
                      isActive ? "bg-[color:var(--color-surface-strong)] text-[color:var(--color-text-primary)]" : "text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface)]")}>
                      {item.icon && <span className="text-base w-5 text-center">{item.icon}</span>}
                      <span className="flex-1">{item.label}</span>
                      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#D97757]" />}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      {footer && <div className="px-4 py-3 border-t border-[color:var(--color-edge)]">{footer}</div>}
    </div>
  );
}
