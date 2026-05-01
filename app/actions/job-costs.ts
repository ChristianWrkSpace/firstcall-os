"use server";

import { createAdminClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

export async function logTechLabor(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData
) {
  const me = await getCurrentUser();
  if (!me) return { error: "Not authenticated." };

  const job_id = formData.get("job_id") as string;
  const profile_id = (formData.get("profile_id") as string) || me.id;
  const work_date = (formData.get("work_date") as string) || new Date().toISOString().slice(0, 10);
  const hours = Number(formData.get("hours"));
  const hourly_rate = Number(formData.get("hourly_rate"));
  const notes = ((formData.get("notes") as string) ?? "").trim() || null;

  if (!job_id) return { error: "Missing job." };
  if (!Number.isFinite(hours) || hours <= 0) return { error: "Hours must be > 0." };
  if (!Number.isFinite(hourly_rate) || hourly_rate < 0)
    return { error: "Hourly rate must be ≥ 0." };

  const admin = createAdminClient();
  const { error } = await admin.from("tech_labor_entries").insert({
    job_id,
    profile_id,
    work_date,
    hours,
    hourly_rate,
    notes,
  });
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${job_id}`);
  return { ok: true };
}

export async function deleteTechLabor(entryId: string, jobId: string) {
  const me = await getCurrentUser();
  if (!me) return { error: "Not authenticated." };
  const admin = createAdminClient();
  const { error } = await admin.from("tech_labor_entries").delete().eq("id", entryId);
  if (error) return { error: error.message };
  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

export async function logConsumable(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData
) {
  const me = await getCurrentUser();
  if (!me) return { error: "Not authenticated." };

  const job_id = formData.get("job_id") as string;
  const item = ((formData.get("item") as string) ?? "").trim();
  const quantity = Number(formData.get("quantity"));
  const unit_cost = Number(formData.get("unit_cost"));
  const notes = ((formData.get("notes") as string) ?? "").trim() || null;

  if (!job_id) return { error: "Missing job." };
  if (!item) return { error: "Item name is required." };
  if (!Number.isFinite(quantity) || quantity <= 0) return { error: "Quantity must be > 0." };
  if (!Number.isFinite(unit_cost) || unit_cost < 0) return { error: "Unit cost must be ≥ 0." };

  const admin = createAdminClient();
  const { error } = await admin.from("consumables_used").insert({
    job_id,
    item,
    quantity,
    unit_cost,
    notes,
  });
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${job_id}`);
  return { ok: true };
}

export async function deleteConsumable(entryId: string, jobId: string) {
  const me = await getCurrentUser();
  if (!me) return { error: "Not authenticated." };
  const admin = createAdminClient();
  const { error } = await admin.from("consumables_used").delete().eq("id", entryId);
  if (error) return { error: error.message };
  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}
