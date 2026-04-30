"use server";

import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

function token(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export async function generateAdjusterToken(jobId: string) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("jobs")
    .select("adjuster_share_token")
    .eq("id", jobId)
    .single();
  if (existing?.adjuster_share_token) {
    return { ok: true, token: existing.adjuster_share_token };
  }

  const t = token();
  const { error } = await admin
    .from("jobs")
    .update({ adjuster_share_token: t })
    .eq("id", jobId);
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}`);
  return { ok: true, token: t };
}

export async function regenerateAdjusterToken(jobId: string) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const t = token();
  const { error } = await admin
    .from("jobs")
    .update({ adjuster_share_token: t })
    .eq("id", jobId);
  if (error) return { error: error.message };
  revalidatePath(`/jobs/${jobId}`);
  return { ok: true, token: t };
}

export async function revokeAdjusterToken(jobId: string) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("jobs")
    .update({ adjuster_share_token: null })
    .eq("id", jobId);
  if (error) return { error: error.message };
  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}
