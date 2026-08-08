"use server";

import { createAdminClient } from "@/lib/supabase-server";
import { requirePermission } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { hashBearerToken } from "@/lib/token-hash";

const SHARE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function generateToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

function shareExpiresAt(): string {
  return new Date(Date.now() + SHARE_TTL_MS).toISOString();
}

export async function generateCustomerShareToken(jobId: string) {
  const auth = await requirePermission("portals.manage");
  if ("error" in auth) return auth;

  const admin = createAdminClient();
  const token = crypto.randomBytes(24).toString("base64url");
  const { error } = await admin
    .from("jobs")
    .update({
      customer_share_token: null,
      customer_share_token_hash: hashBearerToken(token),
      customer_share_expires_at: shareExpiresAt(),
    })
    .eq("id", jobId);
  if (error) return { error: "Unable to create the customer portal link." };

  revalidatePath(`/jobs/${jobId}`);
  return { ok: true, token };
}

export async function regenerateCustomerShareToken(jobId: string) {
  const auth = await requirePermission("portals.manage");
  if ("error" in auth) return auth;

  const admin = createAdminClient();
  const token = generateToken();
  const { error } = await admin
    .from("jobs")
    .update({
      customer_share_token: null,
      customer_share_token_hash: hashBearerToken(token),
      customer_share_expires_at: shareExpiresAt(),
    })
    .eq("id", jobId);
  if (error) return { error: "Unable to rotate the customer portal link." };

  revalidatePath(`/jobs/${jobId}`);
  return { ok: true, token };
}

export async function revokeCustomerShareToken(jobId: string) {
  const auth = await requirePermission("portals.manage");
  if ("error" in auth) return auth;

  const admin = createAdminClient();
  const { error } = await admin
    .from("jobs")
    .update({
      customer_share_token: null,
      customer_share_token_hash: null,
      customer_share_expires_at: null,
    })
    .eq("id", jobId);
  if (error) return { error: "Unable to revoke the customer portal link." };

  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}
