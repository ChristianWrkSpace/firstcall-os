"use server";

import { createAdminClient } from "@/lib/supabase-server";
import { generateEstimate } from "@/lib/ledger";
import { loadPriceBook } from "@/lib/price-book";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { autoCreateInvoiceDraft } from "@/lib/auto-triggers";
import { resolveApprovalsForEntity } from "@/lib/auto-actions";
import { logAgentOutcome } from "@/lib/agent-feedback";
import { requireInputs, PreconditionError } from "@/lib/agent-preconditions";
import { requirePermission } from "@/lib/auth-helpers";

export async function generateEstimateForJob(jobId: string) {
  const auth = await requirePermission("estimates.edit");
  if ("error" in auth) return auth;
  const user = auth.user;

  const admin = createAdminClient();

  // Fetch job + scope
  const { data: job, error: jobErr } = await admin
    .from("jobs")
    .select(
      "type, description, site_address, site_city, site_state, site_zip, scope_assessment, dispatch_inputs, customers(name, insurance_company, insurance_claim_number)"
    )
    .eq("id", jobId)
    .single();
  if (jobErr || !job) return { error: "Job not found." };

  const customer = job.customers as any;

  // Law 1 — Bounded Inputs. Ledger needs scope (from Argus), ceiling_height
  // (sqft × ceiling = airflow + dehu sizing math), and a customer name for
  // the estimate header. Refuse-if-missing rather than draft a bad estimate.
  try {
    requireInputs(
      "ledger.estimate_draft",
      {
        scope_assessment: job.scope_assessment,
        ceiling_height_ft: job.dispatch_inputs?.ceiling_height_ft,
        customer_name: customer?.name,
      },
      ["scope_assessment", "ceiling_height_ft", "customer_name"],
      "Run Argus scope analysis, fill the Dispatch Inputs panel (ceiling height), and confirm the customer name before drafting an estimate."
    );
  } catch (err) {
    if (err instanceof PreconditionError) return { error: err.message };
    throw err;
  }

  const jobContext = [
    `Damage type: ${job.type}`,
    job.description ? `Caller description: ${job.description}` : null,
    job.site_address
      ? `Site: ${[job.site_address, job.site_city, job.site_state, job.site_zip].filter(Boolean).join(", ")}`
      : null,
    customer?.name ? `Customer: ${customer.name}` : null,
    customer?.insurance_company ? `Carrier: ${customer.insurance_company}` : null,
    customer?.insurance_claim_number ? `Claim #: ${customer.insurance_claim_number}` : null,
    job.dispatch_inputs ? `Dispatch inputs: ${JSON.stringify(job.dispatch_inputs)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  // Load the price book once up front. Ledger uses it as the unit_price
  // ground truth; we use it again below to tag each line as 'book' or
  // 'guessed' so the office can see at-a-glance which prices to scrutinize.
  const priceBook = await loadPriceBook();

  let estimate;
  try {
    estimate = await generateEstimate(jobContext, job.scope_assessment, priceBook);
  } catch (err: any) {
    return { error: err.message ?? "Estimate generation failed." };
  }

  // Determine version (one above the highest existing)
  const { data: existingEstimates } = await admin
    .from("estimates")
    .select("version")
    .eq("job_id", jobId)
    .order("version", { ascending: false })
    .limit(1);
  const nextVersion = (existingEstimates?.[0]?.version ?? 0) + 1;

  // Insert estimate header
  const { data: newEst, error: estErr } = await admin
    .from("estimates")
    .insert({
      job_id: jobId,
      version: nextVersion,
      status: "draft",
      generated_by: user.id,
      generation_meta: {
        summary: estimate.summary,
        assumptions: estimate.assumptions,
        notes_for_estimator: estimate.notes_for_estimator,
      },
    })
    .select("id")
    .single();
  if (estErr || !newEst) return { error: estErr?.message ?? "Failed to create estimate." };

  // Insert line items. Tag each line with pricing_source so the operator can
  // tell book-anchored prices from LLM guesses on the estimate page. A line
  // is 'book' iff its xactimate_code matches a book entry AND the unit_price
  // it actually persisted matches the book price (Ledger is instructed to use
  // the book verbatim, but trust-but-verify — if it deviated, treat as guess).
  const lineRows = estimate.line_items.map((li, idx) => {
    const code = li.xactimate_code ?? null;
    const bookEntry = code ? priceBook.get(code) : undefined;
    const matchesBook =
      !!bookEntry && Math.abs(Number(bookEntry.unit_price) - Number(li.unit_price)) < 0.01;
    const pricing_source: "book" | "guessed" = matchesBook ? "book" : "guessed";
    return {
      estimate_id: newEst.id,
      sort_order: idx,
      category: li.category ?? null,
      xactimate_code: code,
      description: li.description,
      quantity: li.quantity,
      unit: li.unit,
      unit_price: li.unit_price,
      notes: li.notes ?? null,
      is_ai_drafted: true,
      pricing_source,
    };
  });

  if (lineRows.length > 0) {
    const { error: linesErr } = await admin
      .from("estimate_line_items")
      .insert(lineRows);
    if (linesErr) return { error: linesErr.message };
  }

  revalidatePath(`/jobs/${jobId}`);
  redirect(`/jobs/${jobId}/estimates/${newEst.id}`);
}

export async function updateLineItem(
  lineItemId: string,
  updates: {
    description?: string;
    quantity?: number;
    unit?: string;
    unit_price?: number;
    xactimate_code?: string;
    notes?: string;
  },
  estimateId: string,
  jobId: string
) {
  const auth = await requirePermission("estimates.edit");
  if ("error" in auth) return auth;

  const admin = createAdminClient();
  const { error } = await admin
    .from("estimate_line_items")
    .update({ ...updates, is_ai_drafted: false })
    .eq("id", lineItemId);
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}/estimates/${estimateId}`);
  return { ok: true, error: undefined };
}

export async function addLineItem(
  estimateId: string,
  jobId: string,
  formData: FormData
) {
  const auth = await requirePermission("estimates.edit");
  if ("error" in auth) return auth;

  const admin = createAdminClient();

  const description = (formData.get("description") as string)?.trim();
  const quantity = Number(formData.get("quantity")) || 1;
  const unit = (formData.get("unit") as string) || "EA";
  const unit_price = Number(formData.get("unit_price")) || 0;
  const xactimate_code = (formData.get("xactimate_code") as string)?.trim() || null;
  const category = (formData.get("category") as string)?.trim() || null;

  if (!description) return { error: "Description required." };

  const { data: maxRow } = await admin
    .from("estimate_line_items")
    .select("sort_order")
    .eq("estimate_id", estimateId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const sort_order = (maxRow?.[0]?.sort_order ?? -1) + 1;

  const { error } = await admin.from("estimate_line_items").insert({
    estimate_id: estimateId,
    sort_order,
    description,
    quantity,
    unit,
    unit_price,
    xactimate_code,
    category,
    is_ai_drafted: false,
  });
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}/estimates/${estimateId}`);
  return { ok: true, error: undefined };
}

export async function deleteLineItem(
  lineItemId: string,
  estimateId: string,
  jobId: string
) {
  const auth = await requirePermission("estimates.edit");
  if ("error" in auth) return auth;

  const admin = createAdminClient();
  const { error } = await admin
    .from("estimate_line_items")
    .delete()
    .eq("id", lineItemId);
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}/estimates/${estimateId}`);
  return { ok: true, error: undefined };
}

export async function approveEstimate(estimateId: string, _jobId: string) {
  const auth = await requirePermission("estimates.approve");
  if ("error" in auth) return auth;
  const user = auth.user;

  const admin = createAdminClient();
  const { data: approvedEstimate, error } = await admin
    .from("estimates")
    .update({
      status: "approved",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", estimateId)
    .select("job_id")
    .single();
  if (error || !approvedEstimate) {
    return { error: error?.message ?? "Estimate not found." };
  }
  const canonicalJobId = approvedEstimate.job_id;

  // Auto-resolve any pending_approvals on this estimate (the office just acted on it)
  after(() => resolveApprovalsForEntity("estimate", estimateId, user.id, "estimate approved"));

  // Detect manual edits via is_ai_drafted=false on any line item. Honest about
  // the partial signal: catches added/replaced lines, misses qty/price tweaks
  // on AI-drafted lines (no updated_at column to compare). Better than nothing.
  const { data: lines } = await admin
    .from("estimate_line_items")
    .select("is_ai_drafted")
    .eq("estimate_id", estimateId);
  const manualLineCount = (lines ?? []).filter((l: any) => l.is_ai_drafted === false).length;
  const wasEdited = manualLineCount > 0;

  // Recursive feedback: approval is a positive signal for Ledger; flag edits
  // separately so the prompt evolves toward less-corrected drafts.
  after(() =>
    logAgentOutcome({
      agent: "ledger",
      task: "estimate_draft",
      outcome: wasEdited ? "approved_with_edits" : "approved_unchanged",
      jobId: canonicalJobId,
      entityType: "estimate",
      entityId: estimateId,
      userId: user.id,
      delta: wasEdited ? { manual_line_count: manualLineCount } : null,
    })
  );

  // Wire 3: invoice draft creation. Stays in DRAFT status — sending remains
  // manual per the "no auto-send" rule.
  after(() => autoCreateInvoiceDraft(estimateId, user.id));

  revalidatePath(`/jobs/${canonicalJobId}/estimates/${estimateId}`);
  return { ok: true, error: undefined };
}

export async function markEstimateSent(
  estimateId: string,
  jobId: string,
  sentTo: string
) {
  const auth = await requirePermission("estimates.send");
  if ("error" in auth) return auth;

  const admin = createAdminClient();
  const { error } = await admin
    .from("estimates")
    .update({
      status: "sent",
      sent_to: sentTo || null,
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", estimateId);
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}/estimates/${estimateId}`);
  return { ok: true, error: undefined };
}

export async function rejectEstimate(estimateId: string, jobId: string) {
  const auth = await requirePermission("estimates.approve");
  if ("error" in auth) return auth;
  const user = auth.user;

  const admin = createAdminClient();
  const { error } = await admin
    .from("estimates")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", estimateId);
  if (error) return { error: error.message };

  // Recursive feedback: rejection is the strongest learning signal.
  after(() =>
    logAgentOutcome({
      agent: "ledger",
      task: "estimate_draft",
      outcome: "rejected",
      jobId,
      entityType: "estimate",
      entityId: estimateId,
      userId: user.id,
    })
  );

  revalidatePath(`/jobs/${jobId}/estimates/${estimateId}`);
  return { ok: true, error: undefined };
}

export async function deleteEstimate(estimateId: string, jobId: string) {
  const auth = await requirePermission("estimates.delete");
  if ("error" in auth) return auth;

  const admin = createAdminClient();
  const { error } = await admin.from("estimates").delete().eq("id", estimateId);
  if (error) return { error: "Unable to delete the estimate." };

  revalidatePath(`/jobs/${jobId}`);
  redirect(`/jobs/${jobId}`);
}
