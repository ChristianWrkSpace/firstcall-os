import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("hardening regressions", () => {
  it("gates estimate mutations with active-profile permissions", () => {
    const actions = source("app/actions/estimates.ts");
    expect(actions).not.toContain("async function requireUser");
    expect(actions).toContain('requirePermission("estimates.edit")');
    expect(actions).toContain('requirePermission("estimates.approve")');
    expect(actions).toContain('requirePermission("estimates.send")');
  });

  it("does not disclose signing credentials through the customer portal", () => {
    const portal = source("app/portal/[token]/page.tsx");
    expect(portal).not.toContain("signing_token,");
    expect(portal).not.toContain('href={`/sign/${d.signing_token}`}');
  });

  it("hashes legal signing credentials and checks expiry when consuming them", () => {
    const sender = source("lib/auto-send-legal-doc.ts");
    const signer = source("app/actions/sign.ts");
    expect(sender).toContain("signing_token: hashBearerToken(signingToken)");
    expect(signer).toContain("const tokenHash = hashBearerToken(input.token)");
    expect(signer).toContain('.eq("signing_token", tokenHash)');
    expect(signer.match(/\.gt\("signing_token_expires_at"/g)).toHaveLength(2);
  });

  it("gates invoice mutations and creates invoices transactionally", () => {
    const invoices = source("app/actions/invoices.ts");
    const autoTriggers = source("lib/auto-triggers.ts");
    const estimates = source("app/actions/estimates.ts");
    expect(invoices).not.toContain("async function requireUser");
    expect(invoices).toContain('requirePermission("invoices.edit")');
    expect(invoices).toContain('requirePermission("invoices.send")');
    expect(invoices).toContain('admin.rpc("create_invoice_from_estimate"');
    expect(autoTriggers).toContain('"create_invoice_from_estimate"');
    expect(autoTriggers).not.toContain('.from("invoices")\n    .insert(');
    expect(autoTriggers).toContain("const jobId = estimate.job_id");
    expect(estimates).toContain("const canonicalJobId = approvedEstimate.job_id");
    expect(estimates).toContain("autoCreateInvoiceDraft(estimateId, user.id)");
  });

  it("uses compare-and-swap semantics for job status transitions", () => {
    const jobs = source("app/actions/jobs.ts");
    expect(jobs).toContain('.eq("status", currentJob.status)');
    expect(jobs).toContain("The job changed while you were updating it");
  });

  it("does not log concrete request paths or error messages", () => {
    const instrumentation = source("instrumentation.ts");
    expect(instrumentation).toContain("const route = context.routePath");
    expect(instrumentation).not.toContain("request.path.split");
    expect(instrumentation).not.toContain("error.message");
  });

  it("backs up durable payment state and uploaded evidence", () => {
    const backups = source("lib/backups.ts");
    for (const table of [
      "stripe_payment_events",
      "job_videos",
      "customer_notifications",
      "partner_payouts",
      "partner_investments",
      "subcontractors",
      "sub_invoices",
    ]) {
      expect(backups).toContain(`\"${table}\"`);
    }
    expect(backups).toContain('["job-photos", "job-documents"]');
    expect(backups).toContain("backupStorageObjects");
  });
});
