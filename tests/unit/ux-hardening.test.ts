import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../..");
const source = (path: string) => readFileSync(resolve(repoRoot, path), "utf8");

describe("UX hardening", () => {
  it("keeps command-center affordances truthful and navigable", () => {
    const page = source("app/(dashboard)/command-center/page.tsx");

    expect(page).not.toContain('href: "/reports/ar"');
    expect(page).toContain('href: "/ar"');
    expect(page).toContain('href={`/jobs/${job.id}`}');
    expect(page).toContain('<SearchTrigger variant="command-center" />');
    expect(page).not.toContain('placeholder="What do you need?');
  });

  it("does not advertise the owner-only progress route in navigation", () => {
    expect(source("lib/nav.ts")).not.toContain('href: "/progress"');
    expect(source("app/(dashboard)/progress/page.tsx")).toBeTruthy();
  });

  it("keeps the practical operations home and paperwork queue accurate and guarded", () => {
    const home = source("app/(dashboard)/command-center/page.tsx");
    const paperwork = source("app/(dashboard)/documents/page.tsx");

    expect(home).toContain('const BUSINESS_TIME_ZONE = "America/Chicago"');
    expect(home).toContain("if (cutoff) invoicesQuery = invoicesQuery.gte");
    expect(home).not.toContain('.limit(8);');
    expect(paperwork).toContain('await requireRoles(["owner", "manager", "office"])');
    expect(paperwork).toContain('["draft", "approved", "sent"].includes(doc.status)');
  });

  it("shows hashed portal links as active instead of silently replacing them", () => {
    const job = source("app/(dashboard)/jobs/[id]/page.tsx");
    const customerShare = source("app/(dashboard)/jobs/[id]/CustomerShareCard.tsx");
    const adjusterShare = source("app/(dashboard)/jobs/[id]/AdjusterShareCard.tsx");

    expect(job).toContain("customer_share_token_hash");
    expect(job).toContain("adjuster_share_token_hash");
    expect(customerShare).toContain("Customer portal access is active.");
    expect(adjusterShare).toContain("Adjuster portal access is active.");
  });

  it("supports reduced motion preferences", () => {
    const css = source("app/globals.css");

    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("animation-duration: 0.01ms !important");
    expect(css).toContain("scroll-behavior: auto !important");
  });

  it("exposes accessible mobile drawer and command palette state", () => {
    const mobileNav = source("app/(dashboard)/MobileNav.tsx");
    const palette = source("app/(dashboard)/CommandPalette.tsx");

    expect(mobileNav).toContain("aria-expanded={open}");
    expect(mobileNav).toContain('aria-controls="mobile-navigation-drawer"');
    expect(mobileNav).toContain('e.key === "Escape"');
    expect(mobileNav).toContain("inert={!open}");
    expect(mobileNav).toContain("triggerRef.current?.focus()");

    expect(palette).toContain('role="dialog"');
    expect(palette).toContain('aria-modal="true"');
    expect(palette).toContain('role="combobox"');
    expect(palette).toContain('role="listbox"');
    expect(palette).toContain("aria-activedescendant");
    expect(palette).toContain("openerRef.current?.focus()");
    expect(palette).toContain("const [searchError");
    expect(palette).toContain("Search is temporarily unavailable.");
  });

  it("keeps high-frequency forms and financial tables usable on narrow screens", () => {
    const newJob = source("app/(dashboard)/jobs/new/NewJobForm.tsx");
    const payments = source("app/(dashboard)/jobs/[id]/invoices/[invoiceId]/PaymentsPanel.tsx");
    const estimates = source("app/(dashboard)/jobs/[id]/estimates/page.tsx");
    const invoices = source("app/(dashboard)/jobs/[id]/invoices/page.tsx");
    const estimateLines = source("app/(dashboard)/jobs/[id]/estimates/[estimateId]/LineItemsTable.tsx");
    const invoiceLines = source("app/(dashboard)/jobs/[id]/invoices/[invoiceId]/InvoiceLineTable.tsx");

    expect(newJob).toContain("grid grid-cols-1 sm:grid-cols-2");
    expect(payments).toContain("grid grid-cols-1 sm:grid-cols-2");
    for (const tableSource of [payments, estimates, invoices, estimateLines, invoiceLines]) {
      expect(tableSource).toContain("overflow-x-auto");
    }
  });
});
