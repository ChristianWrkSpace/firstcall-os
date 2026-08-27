"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/icons/nav-icons";
import type { NavSection } from "@/lib/nav";

export default function SidebarNav({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav aria-label="Primary navigation" className="flex-1 px-2 py-3 flex flex-col gap-1 overflow-y-auto">
      {sections.map((section, index) => (
        <div key={section.title} className={index === 0 ? "" : "mt-4"}>
          <p className="px-3 pt-1 pb-2 text-xs font-medium text-[color:var(--color-text-muted)]">{section.title}</p>
          <div className="flex flex-col gap-1">
            {section.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`group flex items-center gap-3 px-3 py-2 rounded-[6px] text-sm border-l-2 transition-colors ${active ? "bg-[color:var(--color-surface-strong)] text-[color:var(--color-text-primary)] border-l-[color:var(--color-text-muted)]" : "text-[color:var(--color-text-secondary)] border-l-transparent hover:text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface)]"}`}
                >
                  <NavIcon name={item.icon} className="h-[18px] w-[18px] shrink-0" />
                  <span className="flex-1 min-w-0 leading-tight">
                    <span>{item.label}</span>
                    {item.hint && <span className="block text-xs text-[color:var(--color-text-muted)] mt-0.5 truncate">{item.hint}</span>}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
