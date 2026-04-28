"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function createJob(
  prevState: { error?: string } | undefined,
  formData: FormData
) {
  const supabase = await createServerSupabaseClient();

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .insert({
      name: formData.get("customer_name") as string,
      phone: (formData.get("customer_phone") as string) || null,
      email: (formData.get("customer_email") as string) || null,
      insurance_company: (formData.get("insurance_company") as string) || null,
      insurance_claim_number:
        (formData.get("insurance_claim_number") as string) || null,
    })
    .select()
    .single();

  if (customerError) return { error: customerError.message };

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
    })
    .select()
    .single();

  if (jobError) return { error: jobError.message };

  redirect(`/jobs/${job.id}`);
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
