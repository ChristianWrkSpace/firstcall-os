"use server";

import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase-server";
import { generateEstimate } from "@/lib/ledger";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function generateEstimateForJob(jobId: string) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

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
  if (!job.scope_assessment) {
    return { error: "Run Argus scope analysis first — Ledger needs a scope to estimate from." };
  }

  const customer = job.customers as any;
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

  let estimate;
  try {
    estimate = await generateEstimate(jobContext, job.scope_assessment);
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

  // Insert line items
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
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("estimate_line_items")
    .update({ ...updates, is_ai_drafted: false })
    .eq("id", lineItemId);
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}/estimates/${estimateId}`);
  return { ok: true };
}

export async function addLineItem(
  estimateId: string,
  jobId: string,
  formData: FormData
) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

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
  return { ok: true };
}

export async function deleteLineItem(
  lineItemId: string,
  estimateId: string,
  jobId: string
) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("estimate_line_items")
    .delete()
    .eq("id", lineItemId);
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}/estimates/${estimateId}`);
  return { ok: true };
}

export async function approveEstimate(estimateId: string, jobId: string) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("estimates")
    .update({
      status: "approved",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", estimateId);
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}/estimates/${estimateId}`);
  return { ok: true };
}

export async function markEstimateSent(
  estimateId: string,
  jobId: string,
  sentTo: string
) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

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
  return { ok: true };
}

export async function rejectEstimate(estimateId: string, jobId: string) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("estimates")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", estimateId);
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}/estimates/${estimateId}`);
  return { ok: true };
}

export async function deleteEstimate(estimateId: string, jobId: string) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { error } = await admin.from("estimates").delete().eq("id", estimateId);
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}`);
  redirect(`/jobs/${jobId}`);
}
