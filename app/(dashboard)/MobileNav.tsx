"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, NAV_SECTIONS, type NavItem } from "@/lib/nav";
import { signOut } from "@/app/actions/auth";
import Logo from "@/components/Logo";
import { CloseIcon, NavIcon, SignOutIcon } from "@/components/icons/nav-icons";
import SearchTrigger from "./SearchTrigger";

export default function MobileNav({
  items,
}: {
  items?: readonly NavItem[];
}) {
  const navItems = items ?? NAV_ITEMS;
  // Derive sections from the visible flat list (preserves the role filter
  // that the layout already applied) by intersecting NAV_SECTIONS.
  const visibleHrefs = useMemo(
    () => new Set(navItems.map((i) => i.href)),
    [navItems]
  );
  const sections = useMemo(
    () =>
      NAV_SECTIONS.map((s) => ({
        title: s.title,
        items: s.items.filter((i) => visibleHrefs.has(i.href)),
      })).filter((s) => s.items.length > 0),
    [visibleHrefs]
  );
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const wasOpenRef = useRef(false);

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

  // Move focus into the drawer, contain keyboard focus while it is modal,
  // support Escape, and return focus to the menu trigger on close.
  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) triggerRef.current?.focus();
      wasOpenRef.current = false;
      return;
    }

    wasOpenRef.current = true;
    closeRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      {/* Mobile top bar — pt accounts for iOS status bar / notch when running
          as installed PWA (display:standalone) so the hamburger isn't tucked
          under the system clock. */}
      <header
        className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 pb-3 bg-[color:var(--color-bg-deep)]/92 backdrop-blur-md border-b border-[color:var(--color-edge)]"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <button
          ref={triggerRef}
          onClick={() => setOpen(true)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-navigation-drawer"
          className="p-2 -ml-2 rounded-[6px] text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] transition-colors"
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
          <p className="text-[color:var(--color-text-primary)] text-sm font-semibold">FirstCall OS</p>
        </div>
        <SearchTrigger variant="mobile" />
      </header>

      {/* Drawer overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          aria-hidden="true"
          className="md:hidden fixed inset-0 z-40 bg-black/70"
        />
      )}

      {/* Drawer */}
      <aside
        ref={drawerRef}
        id="mobile-navigation-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Main navigation"
        inert={!open}
        className={`md:hidden fixed top-0 bottom-0 left-0 z-50 w-72 bg-[color:var(--color-bg-deep)]/96 backdrop-blur-md border-r border-[color:var(--color-edge)] flex flex-col transform transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand + close — top padding respects notch when drawer is open */}
        <div
          className="flex items-center justify-between gap-2.5 px-4 pb-5 border-b border-[color:var(--color-edge)]"
          style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top))" }}
        >
          <Logo variant="banner" size={28} />
          <button
            ref={closeRef}
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="p-2 rounded-[6px] text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Nav — workflow-grouped sections */}
        <nav className="flex-1 px-2 py-2 flex flex-col gap-0.5 overflow-y-auto">
          {sections.map((section, i) => (
            <div key={section.title} className={i === 0 ? "" : "mt-3"}>
              <p className="px-3 pt-2 pb-2 text-xs font-medium text-[color:var(--color-text-muted)]">
                {section.title}
              </p>
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const active =
                    pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-[6px] border-l-2 transition-colors text-sm ${
                        active
                          ? "bg-[color:var(--color-surface-strong)] text-[color:var(--color-text-primary)] border-l-[color:var(--color-text-muted)]"
                          : "text-[color:var(--color-text-secondary)] border-l-transparent hover:text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface)]"
                      }`}
                    >
                      <NavIcon name={item.icon} className="h-[18px] w-[18px] shrink-0" />
                      <span className="flex-1 leading-tight">
                        {item.label}
                        {item.hint && (
                          <span className="block text-xs text-[color:var(--color-text-muted)] mt-0.5">
                            {item.hint}
                          </span>
                        )}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sign out */}
        <div className="px-2 py-3 border-t border-[color:var(--color-edge)]">
          <form action={signOut}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[6px] text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface)] transition-colors text-sm text-left"
            >
              <SignOutIcon className="h-[18px] w-[18px] shrink-0" />
              Sign out
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
