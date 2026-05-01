"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, type NavItem } from "@/lib/nav";
import { signOut } from "@/app/actions/auth";
import Logo from "@/components/Logo";
import SearchTrigger from "./SearchTrigger";

export default function MobileNav({
  items,
}: {
  items?: readonly NavItem[];
}) {
  const navItems = items ?? NAV_ITEMS;
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close drawer when route changes
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll when drawer open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Mobile top bar — pt accounts for iOS status bar / notch when running
          as installed PWA (display:standalone) so the hamburger isn't tucked
          under the system clock. */}
      <header
        className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 pb-3 bg-[#0E1012]/90 backdrop-blur-2xl border-b border-white/[0.06]"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="p-2 -ml-2 text-white hover:text-blue-400 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
            />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <Logo variant="mark" size={28} />
          <p className="text-white text-sm font-semibold">FirstCall OS</p>
        </div>
        <SearchTrigger variant="mobile" />
      </header>

      {/* Drawer overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        />
      )}

      {/* Drawer */}
      <aside
        className={`md:hidden fixed top-0 bottom-0 left-0 z-50 w-72 bg-[#0E1012]/95 backdrop-blur-2xl border-r border-white/[0.08] flex flex-col transform transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand + close — top padding respects notch when drawer is open */}
        <div
          className="flex items-center justify-between gap-2.5 px-4 pb-5 border-b border-white/[0.06]"
          style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top))" }}
        >
          <Logo variant="banner" size={28} />
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="p-2 text-zinc-400 hover:text-white text-2xl min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                  active
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                }`}
              >
                <span className="text-lg leading-none w-5 text-center">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Sign out */}
        <div className="px-2 py-3 border-t border-zinc-800">
          <form action={signOut}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors text-sm text-left"
            >
              <span className="text-lg leading-none w-5 text-center">→</span>
              Sign out
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
