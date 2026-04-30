"use server";

import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function recordMoistureReading(jobId: string, formData: FormData) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const room = (formData.get("room") as string)?.trim();
  if (!room) return { error: "Room is required." };

  const admin = createAdminClient();
  const { error } = await admin.from("moisture_readings").insert({
    job_id: jobId,
    reading_date:
      (formData.get("reading_date") as string) ||
      new Date().toISOString().split("T")[0],
    room,
    location_detail: (formData.get("location_detail") as string)?.trim() || null,
    material: (formData.get("material") as string) || null,
    moisture_pct: parseNullableNum(formData.get("moisture_pct")),
    rh_pct: parseNullableNum(formData.get("rh_pct")),
    temp_f: parseNullableNum(formData.get("temp_f")),
    gpp: parseNullableNum(formData.get("gpp")),
    is_dry_standard: formData.get("is_dry_standard") === "on",
    notes: (formData.get("notes") as string)?.trim() || null,
    recorded_by: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

export async function deleteMoistureReading(readingId: string, jobId: string) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  await admin.from("moisture_readings").delete().eq("id", readingId);
  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

function parseNullableNum(v: FormDataEntryValue | null): number | null {
  if (v === null || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}
