import { describe, it, expect } from "vitest";
import { hasPermission, ROLE_META, ALL_ROLES } from "@/lib/permissions";

describe("hasPermission", () => {
  it("owner has every permission", () => {
    const perms = [
      "jobs.delete",
      "invoices.void",
      "users.manage",
      "audit.view",
      "settings.edit",
    ] as const;
    for (const p of perms) expect(hasPermission("owner", p)).toBe(true);
  });

  it("technician has no money or admin perms", () => {
    expect(hasPermission("technician", "estimates.edit")).toBe(false);
    expect(hasPermission("technician", "invoices.edit")).toBe(false);
    expect(hasPermission("technician", "invoices.send")).toBe(false);
    expect(hasPermission("technician", "users.manage")).toBe(false);
    expect(hasPermission("technician", "audit.view")).toBe(false);
    expect(hasPermission("technician", "ar.view")).toBe(false);
  });

  it("office can send invoices but not delete jobs", () => {
    expect(hasPermission("office", "estimates.edit")).toBe(true);
    expect(hasPermission("office", "invoices.edit")).toBe(true);
    expect(hasPermission("office", "invoices.send")).toBe(true);
    expect(hasPermission("office", "jobs.delete")).toBe(false);
    expect(hasPermission("office", "users.manage")).toBe(false);
  });

  it("manager can do everything except user management + settings", () => {
    expect(hasPermission("manager", "invoices.void")).toBe(true);
    expect(hasPermission("manager", "jobs.delete")).toBe(true);
    expect(hasPermission("manager", "users.manage")).toBe(false);
    expect(hasPermission("manager", "settings.edit")).toBe(false);
  });

  it("office can manage customer portals but technicians cannot", () => {
    expect(hasPermission("owner", "portals.manage")).toBe(true);
    expect(hasPermission("manager", "portals.manage")).toBe(true);
    expect(hasPermission("office", "portals.manage")).toBe(true);
    expect(hasPermission("technician", "portals.manage")).toBe(false);
  });

  it("restricts estimate and payment deletion to owners and managers", () => {
    for (const permission of ["estimates.delete", "payments.delete"] as const) {
      expect(hasPermission("owner", permission)).toBe(true);
      expect(hasPermission("manager", permission)).toBe(true);
      expect(hasPermission("office", permission)).toBe(false);
      expect(hasPermission("technician", permission)).toBe(false);
    }
  });

  it("rejects unknown roles and null", () => {
    expect(hasPermission(null, "invoices.send")).toBe(false);
    expect(hasPermission(undefined, "invoices.send")).toBe(false);
    expect(hasPermission("attacker", "invoices.send" as any)).toBe(false);
  });

  it("ROLE_META covers every role", () => {
    for (const r of ALL_ROLES) {
      expect(ROLE_META[r]).toBeDefined();
      expect(ROLE_META[r].label).toBeTruthy();
    }
  });
});
