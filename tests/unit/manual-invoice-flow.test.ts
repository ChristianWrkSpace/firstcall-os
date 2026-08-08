import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../..");
const source = (path: string) => readFileSync(resolve(repoRoot, path), "utf8");

describe("manual-only billing and invoicing", () => {
  it("removes AI estimates from the practical job workflow", () => {
    const jobPage = source("app/(dashboard)/jobs/[id]/page.tsx");
    const checklist = source("app/(dashboard)/jobs/[id]/JobChecklist.tsx");
    const scopeActions = source("app/actions/scope.ts");
    const help = source("app/(dashboard)/help/page.tsx");
    const reports = source("app/(dashboard)/reports/page.tsx");
    const estimateActions = source("app/actions/estimates.ts");
    const estimatePage = source("app/(dashboard)/jobs/[id]/estimates/[estimateId]/page.tsx");
    const invoiceActions = source("app/actions/invoices.ts");

    expect(jobPage).not.toContain("GenerateEstimateButton");
    expect(jobPage).not.toContain('.from("estimates")');
    expect(jobPage).not.toContain('title="Estimates"');
    expect(checklist).not.toContain("estimateCount");
    expect(checklist).not.toContain('key: "estimate"');
    expect(scopeActions).not.toContain("autoDraftEstimate");
    expect(help).not.toContain("Build the estimate");
    expect(reports).not.toContain('.from("estimates")');
    expect(reports).not.toContain("Avg Estimate");
    expect(reports).toContain("Avg Invoice");
    expect(estimateActions).not.toContain("autoCreateInvoiceDraft");
    expect(estimatePage).not.toContain("GenerateInvoiceButton");
    expect(invoiceActions).not.toContain("createInvoiceFromEstimate");
  });

  it("creates a draft invoice from the saved manual billing amount", () => {
    const editor = source("app/(dashboard)/jobs/[id]/ManualBillingAmount.tsx");
    const button = source("app/(dashboard)/jobs/[id]/CreateManualInvoiceButton.tsx");
    const actions = source("app/actions/invoices.ts");
    const invoiceIndex = source("app/(dashboard)/jobs/[id]/invoices/page.tsx");

    expect(editor).toContain("<CreateManualInvoiceButton");
    expect(editor).toContain("Open invoice");
    expect(button).toContain("Create draft invoice");
    expect(actions).toContain("export async function createInvoiceFromManualAmount");
    expect(actions).toContain('requirePermission("invoices.edit")');
    expect(actions).toContain('"create_manual_invoice_from_job_amount"');
    expect(invoiceIndex).toContain("Enter a manual billing amount");
    expect(invoiceIndex).not.toContain("Approve an estimate first");
  });

  it("creates manual invoices atomically and exposes the RPC only to service_role", () => {
    const sql = source("supabase/migrations/035_manual_invoice_from_job_amount.sql")
      .replace(/\s+/g, " ")
      .toLowerCase();

    expect(sql).toContain("create or replace function public.create_manual_invoice_from_job_amount");
    expect(sql).toContain("from public.jobs where id = p_job_id for update");
    expect(sql).toContain("v_amount is null or v_amount <= 0");
    expect(sql).toContain("insert into public.invoices");
    expect(sql).toContain("insert into public.invoice_line_items");
    expect(sql).toContain("add column if not exists is_manual_billing");
    expect(sql).toContain("create unique index if not exists idx_one_manual_draft_per_job");
    expect(sql).toContain("is_manual_billing = true");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("status = 'draft'");
    expect(sql).toContain("revoke all on function public.create_manual_invoice_from_job_amount");
    expect(sql).toContain("grant execute on function public.create_manual_invoice_from_job_amount");
    expect(sql).toContain("to service_role");
  });

  it("keeps manual provenance immutable and allocates four-digit invoice suffixes", () => {
    const sql = source("supabase/migrations/036_manual_invoice_guards.sql")
      .replace(/\s+/g, " ")
      .toLowerCase();

    expect(sql).toContain("old.is_manual_billing is distinct from new.is_manual_billing");
    expect(sql).toContain("old.estimate_id is distinct from new.estimate_id");
    expect(sql).toContain("new.is_manual_billing := new.estimate_id is null");
    expect(sql).toContain("before update of is_manual_billing, estimate_id on public.invoices");
    expect(sql).toContain("substring(invoice_number from 12)");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("drop function if exists public.create_invoice_from_estimate");
  });

  it("shows the invoice amount and supports viewing or printing without email", () => {
    const invoicePage = source("app/(dashboard)/jobs/[id]/invoices/[invoiceId]/page.tsx");
    const actions = source("app/(dashboard)/jobs/[id]/invoices/[invoiceId]/InvoiceActions.tsx");
    const email = source("lib/abacus-templates.ts");
    const lineTable = source("app/(dashboard)/jobs/[id]/invoices/[invoiceId]/InvoiceLineTable.tsx");
    const printPage = source("app/(dashboard)/jobs/[id]/invoices/[invoiceId]/print/page.tsx");

    expect(invoicePage).toContain("Invoice Total");
    expect(invoicePage).toContain("customers(name, insurance_company, email)");
    expect(invoicePage).toContain("invoice.sent_to ?? (job as any).customers?.email ?? \"\"");
    expect(actions).toContain("View / Print Invoice");
    expect(actions).toContain("No email is needed to view, print, or save this invoice as a PDF.");
    expect(actions).toContain("Email Invoice");
    expect(email).toContain("Invoice Total");
    expect(email).toContain("${fmt(ctx.total)}");
    expect(lineTable).toContain('"Services"');
    expect(printPage).toContain('"Services"');
    expect(email).toContain('"Services"');
  });

  it("reopens an existing active manual invoice instead of creating duplicates", () => {
    const jobPage = source("app/(dashboard)/jobs/[id]/page.tsx");
    const editor = source("app/(dashboard)/jobs/[id]/ManualBillingAmount.tsx");
    const sql = source("supabase/migrations/037_manual_invoice_no_email_flow.sql")
      .replace(/\s+/g, " ")
      .toLowerCase();

    expect(jobPage).toContain("manualActiveInvoice");
    expect(jobPage).toContain('invoice.status !== "void"');
    expect(editor).toContain("Open invoice");
    expect(sql).toContain("i.status <> 'void'");
    expect(sql).toContain("return v_invoice_id");
  });
});
