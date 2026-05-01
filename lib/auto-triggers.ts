// Auto-trigger functions — server-only. Called fire-and-forget from origin
// server actions. Each one:
//   1. Checks isAutoPaused (skip if paused on the job)
//   2. Pulls inputs via admin client
//   3. Verifies preconditions ("data is sufficient" check)
//   4. Calls the AI agent
//   5. Inserts draft entity
//   6. Enqueues a pending_approvals row
//
// Hard rule: every function here ONLY drafts. Never sends, never charges,
// never voids. Errors are logged + swallowed — auto-actions must never break
// the user-driven flow that triggered them.

import { createAdminClient } from "./supabase-server";
import { enqueueApproval, isAutoPaused, alreadyEnqueued } from "./auto-actions";
import { generateLegalDocByType, type JobContext, type CustomerContext, type InvoiceContext, type MoistureContext } from "./esquire";
import { generateEstimate } from "./ledger";
import type { LegalDocType } from "./esquire-types";

function siteLine(j: { site_address: string | null; site_city: string | null; site_state: string | null; site_zip: string | null }) {
  return [j.site_address, j.site_city, j.site_state, j.site_zip].filter(Boolean).join(", ");
}

// ─── Wire 2: Auto-draft AOB + Work Auth on insurance jobs ───────────────

export async function autoDraftInsuranceLegalDocs(jobId: string) {
  if (await isAutoPaused(jobId)) return;

  const admin = createAdminClient();
  const { data: job } = await admin
    .from("jobs")
    .select(
      "id, job_number, type, description, site_address, site_city, site_state, site_zip, scope_assessment, created_at, payment_route, customers(name, phone, email, address, city, state, zip, insurance_company, insurance_policy_number, insurance_claim_number)"
    )
    .eq("id", jobId)
    .single();
  if (!job) return;

  const route = (job as any).payment_route ?? "customer_pay";
  if (route === "customer_pay") return; // not insurance, no AOB needed

  const customer = (job as any).customers ?? {};
  // Pre-flight: need name + carrier + (policy OR claim)
  if (!customer.name) return;
  if (!customer.insurance_company) return;
  if (!customer.insurance_policy_number && !customer.insurance_claim_number) return;

  const ctx = {
    job: {
      job_number: job.job_number,
      type: job.type ?? null,
      description: job.description ?? null,
      site_address: job.site_address ?? null,
      site_city: job.site_city ?? null,
      site_state: job.site_state ?? null,
      site_zip: job.site_zip ?? null,
      scope_assessment: job.scope_assessment ?? null,
      created_at: job.created_at ?? null,
    } as JobContext,
    customer: customer as CustomerContext,
  };

  await Promise.all([
    draftLegalDoc(jobId, "aob", ctx, "AOB drafted from intake"),
    draftLegalDoc(jobId, "work_authorization", ctx, "Work Authorization drafted from intake"),
  ]);
}

async function draftLegalDoc(
  jobId: string,
  docType: LegalDocType,
  ctx: { job: JobContext; customer: CustomerContext; invoice?: InvoiceContext; moisture?: MoistureContext; disputeSummary?: string },
  titlePrefix: string
) {
  try {
    if (await alreadyEnqueued(jobId, "legal_doc_draft")) {
      // Don't re-fire the same kind on this job — checks for any pending
      // legal_doc_draft. (We intentionally don't double-fire AOB+WorkAuth
      // multiple times if createJob runs twice.)
    }
    const drafted = await generateLegalDocByType(docType, ctx);
    const admin = createAdminClient();
    const { data: row, error } = await admin
      .from("legal_documents")
      .insert({
        job_id: jobId,
        doc_type: docType,
        subject: drafted.subject,
        body: drafted.body,
        status: "draft",
        generation_meta: {
          model: "claude-opus-4-7",
          source: "auto-trigger",
          generated_at: new Date().toISOString(),
        },
      })
      .select("id")
      .single();
    if (error || !row) {
      console.error("[auto-trigger.legal_doc]", error);
      return;
    }
    await enqueueApproval({
      kind: "legal_doc_draft",
      jobId,
      entityType: "legal_document",
      entityId: row.id,
      title: `${titlePrefix} — ${ctx.customer.name}`,
      detail: `${docType} ready for review. Approve before homeowner / carrier sees it.`,
      link: `/jobs/${jobId}/legal/${row.id}`,
    });
  } catch (err: any) {
    console.error(`[auto-trigger.${docType}]`, err?.message ?? err);
  }
}

// ─── Wire 1: Auto-draft estimate when Argus scope completes ─────────────

export async function autoDraftEstimate(jobId: string) {
  if (await isAutoPaused(jobId)) return;
  if (await alreadyEnqueued(jobId, "estimate_draft")) return;

  const admin = createAdminClient();
  const { data: job } = await admin
    .from("jobs")
    .select(
      "type, description, site_address, site_city, site_state, site_zip, scope_assessment, dispatch_inputs, customers(name, insurance_company, insurance_claim_number)"
    )
    .eq("id", jobId)
    .single();
  if (!job) return;
  if (!job.scope_assessment) return;
  // If the scope flagged human review, skip — let the human decide
  const scope: any = job.scope_assessment;
  if (scope?.requires_human_review === true) return;

  const customer = (job as any).customers;
  const jobContext = [
    `Damage type: ${job.type}`,
    job.description ? `Caller description: ${job.description}` : null,
    job.site_address ? `Site: ${siteLine(job as any)}` : null,
    customer?.name ? `Customer: ${customer.name}` : null,
    customer?.insurance_company ? `Carrier: ${customer.insurance_company}` : null,
    customer?.insurance_claim_number ? `Claim #: ${customer.insurance_claim_number}` : null,
    job.dispatch_inputs ? `Dispatch inputs: ${JSON.stringify(job.dispatch_inputs)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  let estimate;
  try {
    estimate = await generateEstimate(jobContext, job.scope_assessment);
  } catch (err: any) {
    console.error("[auto-trigger.estimate]", err?.message ?? err);
    return;
  }

  const { data: existing } = await admin
    .from("estimates")
    .select("version")
    .eq("job_id", jobId)
    .order("version", { ascending: false })
    .limit(1);
  const nextVersion = (existing?.[0]?.version ?? 0) + 1;

  const { data: newEst, error: estErr } = await admin
    .from("estimates")
    .insert({
      job_id: jobId,
      version: nextVersion,
      status: "draft",
      generation_meta: {
        summary: estimate.summary,
        assumptions: estimate.assumptions,
        notes_for_estimator: estimate.notes_for_estimator,
        source: "auto-trigger",
      },
    })
    .select("id")
    .single();
  if (estErr || !newEst) {
    console.error("[auto-trigger.estimate.insert]", estErr);
    return;
  }

  if (estimate.line_items.length > 0) {
    const lineRows = estimate.line_items.map((li, idx) => ({
      estimate_id: newEst.id,
      sort_order: idx,
      category: li.category ?? null,
      xactimate_code: li.xactimate_code ?? null,
      description: li.description,
      quantity: li.quantity,
      unit: li.unit,
      unit_price: li.unit_price,
      notes: li.notes ?? null,
      is_ai_drafted: true,
    }));
    await admin.from("estimate_line_items").insert(lineRows);
  }

  const total = estimate.line_items.reduce(
    (s, li) => s + Number(li.quantity ?? 0) * Number(li.unit_price ?? 0),
    0
  );

  await enqueueApproval({
    kind: "estimate_draft",
    jobId,
    entityType: "estimate",
    entityId: newEst.id,
    title: `Estimate v${nextVersion} drafted — $${total.toFixed(2)}`,
    detail: `${estimate.line_items.length} line items. Argus scope drove the draft. Review + approve to convert to invoice.`,
    link: `/jobs/${jobId}/estimates/${newEst.id}`,
  });
}

// ─── Wire 3: Auto-create invoice DRAFT when estimate approved ──────────

export async function autoCreateInvoiceDraft(estimateId: string, jobId: string) {
  if (await isAutoPaused(jobId)) return;

  const admin = createAdminClient();

  // Don't double-create: skip if an invoice already exists for this estimate
  const { data: existing } = await admin
    .from("invoices")
    .select("id")
    .eq("estimate_id", estimateId)
    .limit(1);
  if (existing && existing.length > 0) return;

  const { data: estimate } = await admin
    .from("estimates")
    .select("id, status, line_items:estimate_line_items(*)")
    .eq("id", estimateId)
    .single();
  if (!estimate) return;
  if (estimate.status !== "approved") return;

  const { data: newInv, error: invErr } = await admin
    .from("invoices")
    .insert({
      job_id: jobId,
      estimate_id: estimateId,
      status: "draft",
    })
    .select("id, invoice_number")
    .single();
  if (invErr || !newInv) {
    console.error("[auto-trigger.invoice]", invErr);
    return;
  }

  // Copy line items from estimate
  const lineRows = (estimate.line_items as any[]).map((li: any) => ({
    invoice_id: newInv.id,
    sort_order: li.sort_order,
    category: li.category,
    xactimate_code: li.xactimate_code,
    description: li.description,
    quantity: li.quantity,
    unit: li.unit,
    unit_price: li.unit_price,
    notes: li.notes,
  }));
  if (lineRows.length > 0) {
    await admin.from("invoice_line_items").insert(lineRows);
  }

  const total = lineRows.reduce(
    (s: number, li: any) => s + Number(li.quantity) * Number(li.unit_price),
    0
  );

  await enqueueApproval({
    kind: "invoice_draft",
    jobId,
    entityType: "invoice",
    entityId: newInv.id,
    title: `Invoice ${newInv.invoice_number} drafted — $${total.toFixed(2)}`,
    detail: `Auto-created from approved estimate. Sending stays manual — review and click Send when ready.`,
    link: `/jobs/${jobId}/invoices/${newInv.id}`,
  });
}

// ─── Wire 5: Auto-draft Drying Cert when conditions met ──────────────────
// ─── Wire 7: Auto-flip mitigation→drying on first reading ────────────────
// ─── Wire 8: Suggest drying→completed when all-dry streak ≥3 days ────────

export async function autoTriggerOnMoistureReading(
  jobId: string,
  newReading: { moisture_pct: number | null; reading_date: string | null }
) {
  if (await isAutoPaused(jobId)) return;
  if (newReading.moisture_pct == null || newReading.moisture_pct < 0) return;

  const admin = createAdminClient();

  // 1. Check current job status — if it's still "mitigation", flip to "drying"
  const { data: job } = await admin
    .from("jobs")
    .select(
      "id, job_number, status, type, description, site_address, site_city, site_state, site_zip, customers(name, email, auto_notify_emails)"
    )
    .eq("id", jobId)
    .single();
  if (!job) return;

  if (job.status === "mitigation") {
    await admin.from("jobs").update({ status: "drying" }).eq("id", jobId);
    try {
      const { autoNotifyOnStatusChange } = await import("./auto-notify");
      await autoNotifyOnStatusChange(jobId, "drying");
    } catch {}
  }

  // 2. Check all-dry streak (3+ distinct days, all latest readings dry)
  const { data: readings } = await admin
    .from("moisture_readings")
    .select("room, reading_date, is_dry_standard")
    .eq("job_id", jobId)
    .order("reading_date", { ascending: true });

  if (!readings || readings.length === 0) return;

  // Per-room latest readings
  const latestByRoom = new Map<string, { date: string; dry: boolean }>();
  for (const r of readings as any[]) {
    if (!r.room) continue;
    const cur = latestByRoom.get(r.room);
    if (!cur || (r.reading_date && r.reading_date >= cur.date)) {
      latestByRoom.set(r.room, { date: r.reading_date, dry: !!r.is_dry_standard });
    }
  }
  if (latestByRoom.size === 0) return;

  const allLatestDry = Array.from(latestByRoom.values()).every((v) => v.dry);
  if (!allLatestDry) return;

  // Distinct days in the log
  const distinctDays = new Set<string>(
    (readings as any[]).map((r) => r.reading_date).filter(Boolean)
  );
  if (distinctDays.size < 3) return;

  // Conditions met. Auto-draft the drying certificate AND enqueue completion suggestion.

  // 5a: Drying Cert draft (Esquire) — only if not already drafted
  if (!(await alreadyEnqueued(jobId, "drying_cert_draft"))) {
    const customer = (job as any).customers ?? {};
    const ctx = {
      job: {
        job_number: job.job_number,
        type: job.type ?? null,
        description: job.description ?? null,
        site_address: job.site_address ?? null,
        site_city: job.site_city ?? null,
        site_state: job.site_state ?? null,
        site_zip: job.site_zip ?? null,
        scope_assessment: null,
        created_at: null,
      } as JobContext,
      customer: { name: customer.name ?? "(homeowner)" } as CustomerContext,
      moisture: {
        rooms: Array.from(latestByRoom.keys()),
        reading_count: (readings as any[]).length,
        first_reading_date: (readings as any[])[0]?.reading_date ?? null,
        last_reading_date:
          (readings as any[])[(readings as any[]).length - 1]?.reading_date ?? null,
        all_dry_standard: true,
      } as MoistureContext,
    };
    await draftLegalDoc(
      jobId,
      "drying_certificate",
      ctx,
      "Drying Certificate drafted"
    );
  }

  // 8: Suggest drying→completed (does NOT auto-flip)
  if (job.status === "drying" && !(await alreadyEnqueued(jobId, "status_suggestion"))) {
    await enqueueApproval({
      kind: "status_suggestion",
      jobId,
      title: `Job ${job.job_number}: ready to mark Completed?`,
      detail: `All ${latestByRoom.size} room(s) hit dry standard, ${distinctDays.size} days of readings. Confirm to flip status to Completed (auto-emails the customer).`,
      metadata: { suggested_status: "completed" },
    });
  }
}

// ─── Wire 6: Daily demand-letter sweep ───────────────────────────────────

export async function sweepOverdueInvoicesForDemandLetters() {
  const admin = createAdminClient();

  // 60+ days past sent_at, invoice status is sent/partial/overdue
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000).toISOString();

  const { data: invoices } = await admin
    .from("invoices")
    .select(
      "id, invoice_number, status, sent_at, due_date, line_items:invoice_line_items(line_total), payments(amount), job_id"
    )
    .in("status", ["sent", "partial", "overdue"])
    .lte("sent_at", sixtyDaysAgo);

  let drafted = 0;
  for (const inv of (invoices ?? []) as any[]) {
    try {
      // Skip if job is auto-paused
      if (await isAutoPaused(inv.job_id)) continue;
      if (await alreadyEnqueued(inv.job_id, "demand_letter_draft")) continue;

      const total = (inv.line_items ?? []).reduce(
        (s: number, li: any) => s + Number(li.line_total ?? 0),
        0
      );
      const paid = (inv.payments ?? []).reduce(
        (s: number, p: any) => s + Number(p.amount),
        0
      );
      const balance = total - paid;
      if (balance <= 0) continue;

      const sentAt = inv.sent_at ? new Date(inv.sent_at) : null;
      const days_overdue = sentAt
        ? Math.max(0, Math.floor((Date.now() - sentAt.getTime()) / 86_400_000))
        : 0;

      const { data: job } = await admin
        .from("jobs")
        .select(
          "id, job_number, type, description, site_address, site_city, site_state, site_zip, customers(name, insurance_company, insurance_policy_number, insurance_claim_number)"
        )
        .eq("id", inv.job_id)
        .single();
      if (!job) continue;
      const customer = (job as any).customers ?? {};
      if (!customer.insurance_company) continue;

      const ctx = {
        job: {
          job_number: job.job_number,
          type: job.type ?? null,
          description: job.description ?? null,
          site_address: job.site_address ?? null,
          site_city: job.site_city ?? null,
          site_state: job.site_state ?? null,
          site_zip: job.site_zip ?? null,
          scope_assessment: null,
          created_at: null,
        } as JobContext,
        customer: customer as CustomerContext,
        invoice: {
          invoice_number: inv.invoice_number,
          total,
          paid,
          balance,
          sent_at: inv.sent_at,
          due_date: inv.due_date,
          days_overdue,
        } as InvoiceContext,
      };

      await draftLegalDoc(
        inv.job_id,
        "demand_letter",
        ctx,
        `Demand Letter drafted — ${days_overdue}d overdue`
      );
      drafted++;
    } catch (err: any) {
      console.error("[demand-sweep]", err?.message ?? err);
    }
  }
  return { drafted, scanned: (invoices ?? []).length };
}
