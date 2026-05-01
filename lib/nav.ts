import type { Role } from "./permissions";

// Role-aware navigation. Each item carries an optional `roles` allowlist —
// omit it to make the item visible to everyone. The dashboard layout filters
// this list by the current user's role so each person sees only what they
// need. Server-side page guards still enforce access; this is just visibility.

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles?: readonly Role[];
}

const STAFF: readonly Role[] = ["owner", "manager", "office"] as const;
const LEAD: readonly Role[] = ["owner", "manager"] as const;
const ALL_ROLES: readonly Role[] = ["owner", "manager", "office", "technician"] as const;

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/my-day", label: "My Day", icon: "☀️" }, // everyone — landing page for techs
  { href: "/command-center", label: "Command Center", icon: "◉", roles: STAFF },
  { href: "/dashboard", label: "Dashboard (classic)", icon: "▦", roles: STAFF },
  { href: "/schedule", label: "Schedule", icon: "▥" }, // everyone — techs check their day
  { href: "/jobs", label: "Jobs", icon: "◈" }, // everyone — techs do field work
  { href: "/customers", label: "Customers", icon: "◉" }, // everyone — contact info
  { href: "/calls", label: "Calls", icon: "◎" }, // everyone — Athena history
  { href: "/equipment", label: "Equipment", icon: "▤" }, // everyone — techs deploy/retrieve
  { href: "/expenses", label: "Expenses", icon: "🚐", roles: STAFF },
  { href: "/subs", label: "Subs", icon: "🤝", roles: STAFF },
  { href: "/partners", label: "Partners", icon: "◐", roles: STAFF },
  { href: "/ar", label: "AR", icon: "$", roles: STAFF },
  { href: "/reports", label: "Reports", icon: "◊", roles: LEAD },
  { href: "/solomon", label: "Solomon", icon: "🧠", roles: LEAD },
  { href: "/turing", label: "Turing", icon: "🔬", roles: LEAD },
  { href: "/activity", label: "Activity", icon: "🎛️", roles: STAFF },
  { href: "/progress", label: "Progress", icon: "▰", roles: LEAD },
  { href: "/help", label: "Help", icon: "?" }, // everyone
  { href: "/settings", label: "Settings", icon: "◇", roles: STAFF },
] as const;

export function navForRole(role: Role | string | null | undefined): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter(
    (item) => !item.roles || (item.roles as readonly string[]).includes(role)
  );
}

export { ALL_ROLES };
