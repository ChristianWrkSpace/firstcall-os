import type { Role } from "./permissions";

// Workflow-grouped navigation. The sections mirror how work actually flows
// in this org — Now → Work → Field → Money → Growth → Intelligence → System.
//
// Each item carries an optional `roles` allowlist; omit it to make the item
// visible to everyone. The dashboard layout filters by current user's role
// so each person sees only what they need. Server-side page guards still
// enforce access; this is just visibility.

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  hint?: string;                 // optional subtitle shown beneath the label
  roles?: readonly Role[];
}

export interface NavSection {
  title: string;                 // shown as a small uppercase header
  items: readonly NavItem[];
}

const STAFF: readonly Role[] = ["owner", "manager", "office"] as const;
const LEAD: readonly Role[] = ["owner", "manager"] as const;
const ALL_ROLES: readonly Role[] = ["owner", "manager", "office", "technician"] as const;

/**
 * Primary navigation follows the way a restoration company actually works:
 * run today's operation, complete the job, close the paperwork, collect cash.
 *
 * AI labs and system telemetry still exist at their direct routes, but they are
 * intentionally absent here. They are optional tools, not the operating model.
 */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    title: "Operations",
    items: [
      { href: "/command-center", label: "Home",      icon: "⌂", hint: "What needs attention", roles: STAFF },
      { href: "/jobs",           label: "Jobs",      icon: "▣", hint: "All active work" },
      { href: "/schedule",       label: "Schedule",  icon: "▥", hint: "Dispatch and appointments" },
      { href: "/customers",      label: "Customers", icon: "◉" },
    ],
  },
  {
    title: "Field Work",
    items: [
      { href: "/my-day",    label: "My Day",    icon: "☀", hint: "Assigned work" },
      { href: "/equipment", label: "Equipment", icon: "▤", hint: "Inventory and deployment" },
      { href: "/subs",      label: "Subs",      icon: "◇", hint: "Vendors and invoices", roles: STAFF },
    ],
  },
  {
    title: "Office",
    items: [
      { href: "/documents", label: "Paperwork",   icon: "▧", hint: "Documents and signatures", roles: STAFF },
      { href: "/ar",        label: "Receivables", icon: "$", hint: "Invoices and payments", roles: STAFF },
      { href: "/expenses",  label: "Expenses",    icon: "−", hint: "Job and company costs", roles: STAFF },
      { href: "/reports",   label: "Reports",     icon: "◫", hint: "Performance and profit", roles: LEAD },
    ],
  },
  {
    title: "More",
    items: [
      { href: "/calls",    label: "Calls",    icon: "◎", hint: "Lead intake" },
      { href: "/partners", label: "Partners", icon: "◐", hint: "Referral sources", roles: STAFF },
      { href: "/settings", label: "Settings", icon: "⚙", roles: STAFF },
      { href: "/help",     label: "Help",     icon: "?" },
    ],
  },
] as const;

/**
 * Filter every section by role. Drops empty sections so the sidebar
 * never shows a header with nothing under it.
 */
export function navSectionsForRole(
  role: Role | string | null | undefined
): NavSection[] {
  if (!role) return [];
  return NAV_SECTIONS.map((s) => ({
    title: s.title,
    items: s.items.filter(
      (item) => !item.roles || (item.roles as readonly string[]).includes(role)
    ),
  })).filter((s) => s.items.length > 0);
}

/**
 * Backward-compat: flat list of items the user can see. Used by anything
 * that hasn't been updated to render sections (mobile drawer fallback,
 * search palette, etc).
 */
export function navForRole(role: Role | string | null | undefined): NavItem[] {
  return navSectionsForRole(role).flatMap((s) => s.items);
}

// Legacy alias — some older imports use NAV_ITEMS as a flat list.
// Compute it once at module load from the canonical NAV_SECTIONS so we
// only have one source of truth.
export const NAV_ITEMS: readonly NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

export { ALL_ROLES };
