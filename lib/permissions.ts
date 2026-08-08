// Role-based access control for FirstCall OS.
// Roles live on profiles.role (existing column).
// Server-side enforcement only — never trust the client.

export type Role = "owner" | "manager" | "office" | "technician";

export type Permission =
  // Jobs
  | "jobs.delete"
  | "jobs.cancel"
  // Customers
  | "customers.delete"
  // Estimates / Invoices
  | "estimates.edit"
  | "estimates.send"
  | "estimates.approve"
  | "estimates.delete"
  | "invoices.edit"
  | "invoices.send"
  | "invoices.void"
  | "invoices.record_payment"
  | "invoices.record_payment_view"
  | "payments.delete"
  // Equipment
  | "equipment.retire"
  | "equipment.delete"
  // Documents and public portals
  | "documents.delete"
  | "portals.manage"
  // Partners / Outreach
  | "partners.delete"
  | "outreach.delete"
  // Reports / Money
  | "reports.view_financial"
  | "ar.view"
  // System
  | "users.manage"
  | "audit.view"
  | "settings.edit";

const MATRIX: Record<Role, Permission[]> = {
  owner: [
    "jobs.delete", "jobs.cancel",
    "customers.delete",
    "estimates.edit", "estimates.send", "estimates.approve", "estimates.delete",
    "invoices.edit", "invoices.send", "invoices.void", "invoices.record_payment", "invoices.record_payment_view", "payments.delete",
    "equipment.retire", "equipment.delete",
    "documents.delete", "portals.manage",
    "partners.delete", "outreach.delete",
    "reports.view_financial", "ar.view",
    "users.manage", "audit.view", "settings.edit",
  ],
  manager: [
    "jobs.delete", "jobs.cancel",
    "customers.delete",
    "estimates.edit", "estimates.send", "estimates.approve", "estimates.delete",
    "invoices.edit", "invoices.send", "invoices.void", "invoices.record_payment", "invoices.record_payment_view", "payments.delete",
    "equipment.retire",
    "documents.delete", "portals.manage",
    "partners.delete", "outreach.delete",
    "reports.view_financial", "ar.view",
    "audit.view",
  ],
  office: [
    "jobs.cancel",
    "estimates.edit", "estimates.send", "estimates.approve",
    "invoices.edit", "invoices.send", "invoices.record_payment", "invoices.record_payment_view",
    "documents.delete", "portals.manage",
    "outreach.delete",
    "ar.view",
  ],
  technician: [
    // Techs do field work — they can edit jobs, log moisture, upload photos/docs,
    // assign equipment, but can't delete records or send money-affecting things.
  ],
};

export function hasPermission(role: Role | string | null | undefined, perm: Permission): boolean {
  if (!role) return false;
  const allowed = MATRIX[role as Role];
  if (!allowed) return false;
  return allowed.includes(perm);
}

export const ROLE_META: Record<Role, { label: string; description: string }> = {
  owner: {
    label: "Owner",
    description: "Full access to everything including user management.",
  },
  manager: {
    label: "Manager",
    description: "All operational + financial access. Cannot manage users or edit settings.",
  },
  office: {
    label: "Office",
    description: "Send estimates/invoices, record payments, manage outreach. No deletes, no financial reports.",
  },
  technician: {
    label: "Technician",
    description: "Field work: edit jobs, photos, moisture, equipment assignments. No money or admin.",
  },
};

export const ALL_ROLES: Role[] = ["owner", "manager", "office", "technician"];
