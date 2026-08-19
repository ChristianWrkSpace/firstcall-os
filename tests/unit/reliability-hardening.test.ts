import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("boring reliability hardening", () => {
  it("deduplicates automated legal documents before AI work and at the database boundary", () => {
    const triggers = source("lib/auto-triggers.ts");
    const migration = source("supabase/migrations/038_boring_reliability.sql");

    expect(triggers).toContain("automationKey");
    expect(triggers).toContain('automation_key: automationKey');
    expect(triggers).toContain('.eq("automation_key", automationKey)');
    expect(triggers).toContain("isUniqueViolation");
    expect(migration).toContain("automation_key text");
    expect(migration).toMatch(/create unique index[^;]+legal_documents[^;]+automation_key/i);
  });

  it("claims one-time customer notifications before sending email", () => {
    const notify = source("lib/auto-notify.ts");
    const resend = source("lib/resend.ts");
    const migration = source("supabase/migrations/038_boring_reliability.sql");
    const claimPosition = notify.indexOf("dedupe_key: dedupeKey");
    const sendPosition = notify.indexOf("await sendEmail");

    expect(migration).toContain("dedupe_key text");
    expect(migration).toMatch(/create unique index[^;]+customer_notifications[^;]+dedupe_key/i);
    expect(claimPosition).toBeGreaterThan(-1);
    expect(sendPosition).toBeGreaterThan(claimPosition);
    expect(notify).toContain("idempotencyKey: dedupeKey");
    expect(notify).toContain('.delete().eq("id", claim.id)');
    expect(resend).toContain("idempotencyKey?: string");
  });

  it("keeps test jobs out of automation and clearly separates them in operations", () => {
    const actions = source("app/actions/jobs.ts");
    const form = source("app/(dashboard)/jobs/new/NewJobForm.tsx");
    const jobsPage = source("app/(dashboard)/jobs/page.tsx");
    const autoPauseToggle = source("app/(dashboard)/jobs/[id]/AutoPauseToggle.tsx");
    const autoActions = source("lib/auto-actions.ts");
    const migration = source("supabase/migrations/038_boring_reliability.sql");

    expect(actions).toContain('formData.get("is_test") === "on"');
    expect(actions).toContain("auto_actions_paused: isTest");
    expect(form).toContain('name="is_test"');
    expect(jobsPage).toContain('type Filter = "active" | "completed" | "cancelled" | "test" | "all"');
    expect(jobsPage).toContain('query = query.eq("is_test", true)');
    expect(jobsPage).toContain('query = query.eq("is_test", false)');
    expect(autoActions).toContain('select("auto_actions_paused, is_test")');
    expect(autoActions).toContain("data.is_test");
    expect(migration).toContain("is_test boolean not null default false");
    expect(autoPauseToggle).toContain("isTest: boolean");
    expect(autoPauseToggle).toContain("disabled={pending || isTest}");
  });

  it("excludes test jobs from daily operations and financial reporting", () => {
    const commandCenter = source("lib/command-center-data.ts");
    const pnl = source("lib/job-pnl.ts");
    const reports = source("app/(dashboard)/reports/page.tsx");
    const myDay = source("app/(dashboard)/my-day/page.tsx");
    const paperwork = source("app/(dashboard)/documents/page.tsx");
    const echoContext = source("lib/echo-context.ts");
    const solomon = source("app/actions/solomon.ts");
    const adjusters = source("app/(dashboard)/reports/adjusters/page.tsx");
    const techPerformance = source("app/(dashboard)/reports/tech-performance/page.tsx");

    expect(commandCenter.match(/eq\("is_test", false\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(pnl).toContain('.eq("is_test", false)');
    expect(reports.match(/eq\("is_test", false\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(myDay).toContain('!j.is_test');
    expect(paperwork).toContain('filter((doc: any) => !normalizeJob(doc.jobs).isTest)');
    expect(reports).toContain('jobs!inner(is_test)');
    expect(commandCenter).toContain('jobs!inner(is_test)');
    expect(echoContext.match(/eq\("is_test", false\)/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
    expect(solomon.match(/eq\("is_test", false\)/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
    expect(adjusters).toContain('.eq("jobs.is_test", false)');
    expect(techPerformance).toContain('.eq("jobs.is_test", false)');
  });

  it("prevents direct or cascading deletion of committed records", () => {
    const migration = source("supabase/migrations/038_boring_reliability.sql");

    expect(migration).toContain("protect_committed_legal_document");
    expect(migration).toContain("old.status not in ('draft', 'void')");
    expect(migration).toContain("protect_job_financial_history");
    expect(migration).toContain("from public.payments p");
    expect(migration).toContain("from public.legal_documents d");
    expect(migration).toContain("protect_committed_invoice");
    expect(migration).toContain("protect_committed_estimate");
    expect(migration).toContain("protect_signed_job_document");
    expect(migration).toContain('drop policy if exists "backoffice access payments"');
    expect(migration).toContain('create policy "backoffice read payments"');
  });

  it("makes uploaded-document deletion fail closed and auditable", () => {
    const documents = source("app/actions/documents.ts");

    expect(documents).toContain('.select("*")');
    expect(documents).toContain("if (doc.signed || doc.signed_at)");
    expect(documents).toContain("storageError");
    expect(documents).toContain("deleteError");
    expect(documents).toContain('action: "job_document.deleted"');
    expect(documents).toContain("await logAudit");
    expect(documents).not.toContain("filename: doc.filename");
    const rowDelete = documents.indexOf('.delete()\n    .eq("id", documentId)');
    const storageDelete = documents.indexOf(".remove([doc.storage_path])");
    expect(rowDelete).toBeGreaterThan(-1);
    expect(storageDelete).toBeGreaterThan(rowDelete);
    expect(documents).toContain('.eq("signed", false)');
    expect(documents).toContain('.is("signed_at", null)');
    expect(documents).toContain("restoreError");
  });

  it("preserves automation tombstones when automated legal drafts are removed", () => {
    const approvals = source("app/actions/approvals.ts");
    const esquire = source("app/actions/esquire.ts");
    const migration = source("supabase/migrations/038_boring_reliability.sql");

    expect(approvals).toContain('select("status, automation_key")');
    expect(approvals).toContain('update({ status: "void" })');
    expect(approvals).toContain('.eq("status", "draft")');
    expect(approvals).toContain('.select("id")');
    expect(approvals).toContain("archived_underlying");
    expect(esquire).toContain('select("job_id, doc_type, status, automation_key")');
    expect(esquire).toContain("if (existing.automation_key)");
    expect(esquire).toContain('.eq("status", "draft")');
    expect(esquire).toContain('.select("id")');
    expect(esquire).toContain('action: "legal_doc.voided"');
    expect(migration).toContain("protect_legal_document_status_transition");
    expect(migration).toContain("new.status = 'void'");
    expect(migration).toContain("old.status not in ('draft', 'void')");
  });

  it("gates destructive approval cleanup to management", () => {
    const approvals = source("app/actions/approvals.ts");

    expect(approvals).toContain('deleteUnderlying && user.role !== "owner" && user.role !== "manager"');
    expect(approvals).toContain("Only owners and managers can delete underlying drafts");
  });

  it("marks simulated calls as test jobs and blocks every outbound send path", () => {
    const simulation = source("app/(dashboard)/calls/simulate/page.tsx");
    const calls = source("app/actions/calls.ts");
    const autoSend = source("lib/auto-send-legal-doc.ts");

    expect(simulation).toContain('name="is_test" value="on"');
    expect(calls).toContain('formData.get("is_test") === "on"');
    expect(calls).toContain("is_test: isTest");
    expect(calls).toContain("auto_actions_paused: isTest");
    expect(autoSend).toContain("auto_actions_paused, is_test");
    expect(autoSend).toContain("if (job.is_test)");
  });

  it("binds manual demand letters to the selected job and avoids retaining deleted PII", () => {
    const esquire = source("app/actions/esquire.ts");
    const pii = source("app/actions/pii.ts");

    expect(esquire).toContain('.eq("job_id", input.jobId)');
    expect(pii).not.toContain("name: snapshot.name");
    expect(pii).not.toContain("email: snapshot.email");
    expect(pii).not.toContain("phone: snapshot.phone");
  });

  it("authenticates before constructing an admin client for call-created jobs", () => {
    const calls = source("app/actions/calls.ts");
    const authPosition = calls.indexOf("const user = await getCurrentUser()");
    const adminPosition = calls.indexOf("const admin = createAdminClient()");

    expect(authPosition).toBeGreaterThan(-1);
    expect(adminPosition).toBeGreaterThan(authPosition);
  });
});
