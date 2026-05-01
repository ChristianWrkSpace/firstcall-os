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
 * Workflow phases of the org. Order = chronological intent.
 * NOW → WORK → FIELD → MONEY → GROWTH → INTELLIGENCE → SYSTEM.
 */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    title: "Now",
    items: [
      { href: "/command-center", label: "Command Center", icon: "◉", hint: "Live ops view", roles: STAFF },
      { href: "/my-day",         label: "My Day",         icon: "☀️", hint: "Your jobs today" },
      { href: "/schedule",       label: "Schedule",       icon: "▥",  hint: "Calendar view" },
    ],
  },
  {
    title: "Work",
    items: [
      { href: "/jobs",      label: "Jobs",      icon: "◈" },
      { href: "/calls",     label: "Calls",     icon: "◎",  hint: "Athena intake" },
      { href: "/customers", label: "Customers", icon: "◉" },
    ],
  },
  {
    title: "Field",
    items: [
      { href: "/equipment", label: "Equipment",      icon: "▤" },
      { href: "/subs",      label: "Subcontractors", icon: "🤝", roles: STAFF },
    ],
  },
  {
    title: "Money",
    items: [
      { href: "/ar",       label: "Receivables", icon: "$",  hint: "Invoices owed", roles: STAFF },
      { href: "/expenses", label: "Expenses",    icon: "🚐", hint: "Van + shared",  roles: STAFF },
      { href: "/reports",  label: "Reports",     icon: "◊",  hint: "P&L · Tech · Adjusters", roles: LEAD },
    ],
  },
  {
    title: "Growth",
    items: [
      { href: "/partners", label: "Partners", icon: "◐",  hint: "Plumbers + ROI", roles: STAFF },
      { href: "/activity", label: "Activity", icon: "🎛", hint: "Agent decisions", roles: STAFF },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { href: "/approvals", label: "Approvals", icon: "✓", hint: "Hand-offs", roles: STAFF },
      { href: "/solomon",   label: "Solomon",   icon: "🧠", hint: "FP&A analyst",  roles: LEAD },
      { href: "/turing",    label: "Turing",    icon: "🔬", hint: "Self-audit",    roles: LEAD },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/progress", label: "Progress", icon: "▰", hint: "Roadmap", roles: LEAD },
      { href: "/settings", label: "Settings", icon: "◇", roles: STAFF },
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
