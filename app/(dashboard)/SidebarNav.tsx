"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavSection } from "@/lib/nav";

/**
 * Workflow-grouped sidebar with active-route highlighting.
 * Section headers are tiny uppercase labels between groups.
 *
 * Active = current path starts with the item's href (so /jobs/123 still
 * lights up "Jobs"). Order matters — more specific matches above generic.
 */
export default function SidebarNav({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    // Exact match wins; otherwise prefix match for nested routes
    if (pathname === href) return true;
    return pathname.startsWith(href + "/");
  }

  return (
    <nav className="flex-1 px-2 py-2 flex flex-col gap-0.5 overflow-y-auto">
      {sections.map((section, i) => (
        <div key={section.title} className={i === 0 ? "" : "mt-3"}>
          <p className="px-3 pt-2 pb-1 text-[9px] uppercase tracking-[0.2em] text-white/30 font-semibold">
            {section.title}
          </p>
          <div className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active
                      ? "bg-white/[0.06] text-white ring-1 ring-white/[0.06]"
                      : "text-white/55 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  <span className={`text-base leading-none ${active ? "" : "opacity-80"}`}>
                    {item.icon}
                  </span>
                  <span className="flex-1 min-w-0 leading-tight">
                    <span className={active ? "text-white" : ""}>{item.label}</span>
                    {item.hint && (
                      <span className="block text-[10px] text-white/35 mt-0.5">
                        {item.hint}
                      </span>
                    )}
                  </span>
                  {active && (
                    <span className="h-1 w-1 rounded-full bg-[#5FBDB0]" aria-hidden />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
