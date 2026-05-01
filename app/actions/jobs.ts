"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import crypto from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { autoNotifyOnStatusChange } from "@/lib/auto-notify";
import { autoDraftInsuranceLegalDocs } from "@/lib/auto-triggers";

const VALID_ROUTES = new Set([
  "customer_pay",
  "insurance_primary",
  "insurance_with_deductible",
]);

export async function createJob(
  prevState: { error?: string } | undefined,
  formData: FormData
) {
  const supabase = await createServerSupabaseClient();

  const rawRoute = (formData.get("payment_route") as string) || "customer_pay";
  const payment_route = VALID_ROUTES.has(rawRoute) ? rawRoute : "customer_pay";

  let deductible_amount: number | null = null;
  if (payment_route === "insurance_with_deductible") {
    const raw = (formData.get("deductible_amount") as string) || "";
    const parsed = Number(raw);
    if (!raw || Number.isNaN(parsed) || parsed < 0) {
      return { error: "Enter a valid deductible amount." };
    }
    deductible_amount = parsed;
  }

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .insert({
      name: formData.get("customer_name") as string,
      phone: (formData.get("customer_phone") as string) || null,
      email: (formData.get("customer_email") as string) || null,
      insurance_company: (formData.get("insurance_company") as string) || null,
      insurance_policy_number:
        (formData.get("insurance_policy_number") as string) || null,
      insurance_claim_number:
        (formData.get("insurance_claim_number") as string) || null,
    })
    .select()
    .single();

  if (customerError) return { error: customerError.message };

  // Wire 4: auto-generate customer portal token at create. URL-safe random,
  // matches the existing portal.ts generator. No user interaction needed —
  // office can copy the link from the customer portal panel immediately.
  const customerShareToken = crypto.randomBytes(24).toString("base64url");

  const referredById = (formData.get("referred_by_id") as string) || null;

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      customer_id: customer.id,
      type: formData.get("type") as string,
      description: (formData.get("description") as string) || null,
      site_address: (formData.get("site_address") as string) || null,
      site_city: (formData.get("site_city") as string) || null,
      site_state: (formData.get("site_state") as string) || "TX",
      site_zip: (formData.get("site_zip") as string) || null,
      status: "lead",
      payment_route,
      deductible_amount,
      customer_share_token: customerShareToken,
      referred_by_id: referredById,
    })
    .select()
    .single();

  if (jobError) return { error: jobError.message };

  // Wire 2: AOB + Work Auth drafts when insurance route + sufficient
  // customer data. Esquire calls take ~20-40s. We use Next.js `after()`
  // (not bare `void`) because Vercel kills the worker as soon as the
  // response is sent — including on redirect. `after()` keeps the function
  // alive long enough to finish the AI work after the response.
  after(() => autoDraftInsuranceLegalDocs(job.id));

  redirect(`/jobs/${job.id}`);
}

export async function updatePaymentRoute(
  prevState: { error?: string; ok?: boolean } | undefined,
  formData: FormData
) {
  const supabase = await createServerSupabaseClient();
  const jobId = formData.get("job_id") as string;
  const rawRoute = (formData.get("payment_route") as string) || "customer_pay";
  if (!VALID_ROUTES.has(rawRoute)) {
    return { error: "Invalid payment route." };
  }

  let deductible_amount: number | null = null;
  if (rawRoute === "insurance_with_deductible") {
    const raw = (formData.get("deductible_amount") as string) || "";
    const parsed = Number(raw);
    if (!raw || Number.isNaN(parsed) || parsed < 0) {
      return { error: "Enter a valid deductible amount." };
    }
    deductible_amount = parsed;
  }

  const { error } = await supabase
    .from("jobs")
    .update({ payment_route: rawRoute, deductible_amount })
    .eq("id", jobId);

  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

export interface JobIntakePatch {
  type?: string;
  description?: string | null;
  site_address?: string | null;
  site_city?: string | null;
  site_state?: string | null;
  site_zip?: string | null;
}

const VALID_JOB_TYPES = new Set(["water", "fire", "mold", "storm", "other"]);

/**
 * Edit the core job intake fields (damage type, description, site address)
 * after creation. Office often takes the call before they have the full
 * address — this lets them go back and fix it once the tech is on site.
 */
export async function updateJobIntake(
  jobId: string,
  patch: JobIntakePatch
) {
  const supabase = await createServerSupabaseClient();

  const update: Record<string, unknown> = {};
  if (patch.type !== undefined) {
    if (!VALID_JOB_TYPES.has(patch.type)) return { error: "Invalid damage type." };
    update.type = patch.type;
  }
  if (patch.description !== undefined) {
    update.description = patch.description?.trim() || null;
  }
  if (patch.site_address !== undefined) {
    update.site_address = patch.site_address?.trim() || null;
  }
  if (patch.site_city !== undefined) {
    update.site_city = patch.site_city?.trim() || null;
  }
  if (patch.site_state !== undefined) {
    update.site_state = patch.site_state?.trim().toUpperCase().slice(0, 2) || null;
  }
  if (patch.site_zip !== undefined) {
    update.site_zip = patch.site_zip?.trim() || null;
  }

  if (Object.keys(update).length === 0) return { ok: true };

  const { error } = await supabase
    .from("jobs")
    .update(update)
    .eq("id", jobId);

  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

export async function updateJobStatus(
  prevState: { error?: string } | undefined,
  formData: FormData
) {
  const supabase = await createServerSupabaseClient();
  const jobId = formData.get("job_id") as string;
  const status = formData.get("status") as string;

  const { error } = await supabase
    .from("jobs")
    .update({ status })
    .eq("id", jobId);

  if (error) return { error: error.message };

  // Auto-email customer when status enters a notify-worthy phase. Uses
  // after() so the SMTP call finishes even after this response goes out.
  after(() => autoNotifyOnStatusChange(jobId, status));

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  return { error: undefined };
}

export async function addJobNote(
  prevState: { error?: string; ok?: boolean } | undefined,
  formData: FormData
) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const jobId = formData.get("job_id") as string;
  const content = (formData.get("content") as string).trim();

  if (!content) return { error: "Note cannot be empty." };

  const { error } = await supabase.from("job_notes").insert({
    job_id: jobId,
    author_id: user?.id ?? null,
    content,
    type: "note",
  });

  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}
