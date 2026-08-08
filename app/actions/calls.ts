"use server";

import { createAdminClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

interface CallExtraction {
  caller_type: "customer" | "partner";
  partner?: {
    name: string;
    company?: string;
    phone?: string;
    relationship_notes?: string;
  };
  customer: {
    name: string;
    phone?: string;
    email?: string;
    insurance_company?: string;
    insurance_claim_number?: string;
  };
  job: {
    site_address?: string;
    site_city?: string;
    site_state?: string;
    site_zip?: string;
    type: string;
    description?: string;
    urgency?: string;
  };
  summary: string;
}

export async function createJobFromCall(
  _prevState: any,
  formData: FormData
) {
  const admin = createAdminClient();

  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };

  let extraction: CallExtraction;
  try {
    extraction = JSON.parse(formData.get("extraction") as string);
  } catch {
    return { error: "Invalid extraction data." };
  }

  const transcript = formData.get("transcript") as string;

  try {
    // Upsert partner if this is a referral call
    let partnerId: string | null = null;
    if (extraction.caller_type === "partner" && extraction.partner) {
      const p = extraction.partner;
      const { data: existingPartner } = await admin
        .from("partners")
        .select("id")
        .ilike("name", p.name.trim())
        .maybeSingle();

      if (existingPartner) {
        partnerId = existingPartner.id;
      } else {
        const { data: newPartner, error } = await admin
          .from("partners")
          .insert({
            name: p.name.trim(),
            company: p.company ?? null,
            phone: p.phone ?? null,
            notes: p.relationship_notes ?? null,
          })
          .select("id")
          .single();
        if (error) throw error;
        partnerId = newPartner.id;
      }
    }

    // Create customer
    const { data: customer, error: custErr } = await admin
      .from("customers")
      .insert({
        name: extraction.customer.name.trim(),
        phone: extraction.customer.phone ?? null,
        email: extraction.customer.email ?? null,
        insurance_company: extraction.customer.insurance_company ?? null,
        insurance_claim_number: extraction.customer.insurance_claim_number ?? null,
      })
      .select("id")
      .single();
    if (custErr) throw custErr;

    // Create job
    const { data: job, error: jobErr } = await admin
      .from("jobs")
      .insert({
        customer_id: customer.id,
        referred_by_id: partnerId,
        type: extraction.job.type,
        status: "lead",
        site_address: extraction.job.site_address ?? null,
        site_city: extraction.job.site_city ?? null,
        site_state: extraction.job.site_state ?? "TX",
        site_zip: extraction.job.site_zip ?? null,
        description: extraction.job.description ?? null,
      })
      .select("id, job_number")
      .single();
    if (jobErr) throw jobErr;

    // Create call record
    const { error: callErr } = await admin.from("calls").insert({
      job_id: job.id,
      customer_id: customer.id,
      transcript,
      ai_summary: extraction.summary,
    });
    if (callErr) throw callErr;

    // Add urgency note if emergency/urgent
    if (extraction.job.urgency && extraction.job.urgency !== "standard") {
      await admin.from("job_notes").insert({
        job_id: job.id,
        author_id: user.id,
        content: `⚠️ Urgency: ${extraction.job.urgency.toUpperCase()} — captured from intake call.`,
      });
    }

    revalidatePath("/dashboard");
    revalidatePath("/jobs");
    revalidatePath("/calls");

    return { ok: true, jobId: job.id, jobNumber: job.job_number };
  } catch (err: any) {
    console.error("[createJobFromCall]", err);
    return { error: err.message ?? "Failed to create job." };
  }
}
