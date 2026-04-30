"use server";

import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

function generateToken(): string {
  // URL-safe random token, 32 chars
  return crypto.randomBytes(24).toString("base64url");
}

export async function generateCustomerShareToken(jobId: string) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  // Reuse existing token if present
  const { data: existing } = await admin
    .from("jobs")
    .select("customer_share_token")
    .eq("id", jobId)
    .single();
  if (existing?.customer_share_token) {
    return { ok: true, token: existing.customer_share_token };
  }

  const token = generateToken();
  const { error } = await admin
    .from("jobs")
    .update({ customer_share_token: token })
    .eq("id", jobId);
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}`);
  return { ok: true, token };
}

export async function regenerateCustomerShareToken(jobId: string) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const token = generateToken();
  const { error } = await admin
    .from("jobs")
    .update({ customer_share_token: token })
    .eq("id", jobId);
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}`);
  return { ok: true, token };
}

export async function revokeCustomerShareToken(jobId: string) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("jobs")
    .update({ customer_share_token: null })
    .eq("id", jobId);
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}
