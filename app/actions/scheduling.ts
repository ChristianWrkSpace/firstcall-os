"use server";

import { createAdminClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

async function requireUser() {
  return getCurrentUser();
}

export async function setScheduledAt(jobId: string, scheduledAt: string | null) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("jobs")
    .update({
      scheduled_at: scheduledAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/schedule");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function assignTech(jobId: string, profileId: string) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { error } = await admin.from("job_assignments").insert({
    job_id: jobId,
    profile_id: profileId,
  });
  if (error) {
    if (error.message.includes("duplicate")) {
      return { error: "Tech already assigned to this job." };
    }
    return { error: error.message };
  }

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/schedule");
  return { ok: true };
}

export async function unassignTech(assignmentId: string, jobId: string) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("job_assignments")
    .delete()
    .eq("id", assignmentId);
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/schedule");
  return { ok: true };
}

export async function setLeadTech(jobId: string, profileId: string | null) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("jobs")
    .update({
      lead_tech_id: profileId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/schedule");
  return { ok: true };
}
