"use server";

import { createAdminClient } from "@/lib/supabase-server";
import { requirePermission } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { hashBearerToken } from "@/lib/token-hash";

const SHARE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function token(): string {
  return crypto.randomBytes(24).toString("base64url");
}

function shareExpiresAt(): string {
  return new Date(Date.now() + SHARE_TTL_MS).toISOString();
}

export async function generateAdjusterToken(jobId: string) {
  const auth = await requirePermission("portals.manage");
  if ("error" in auth) return auth;

  const admin = createAdminClient();
  const nextToken = crypto.randomBytes(24).toString("base64url");
  const { error } = await admin
    .from("jobs")
    .update({
      adjuster_share_token: null,
      adjuster_share_token_hash: hashBearerToken(nextToken),
      adjuster_share_expires_at: shareExpiresAt(),
    })
    .eq("id", jobId);
  if (error) return { error: "Unable to create the adjuster portal link." };

  revalidatePath(`/jobs/${jobId}`);
  return { ok: true, token: nextToken };
}

export async function regenerateAdjusterToken(jobId: string) {
  const auth = await requirePermission("portals.manage");
  if ("error" in auth) return auth;

  const admin = createAdminClient();
  const nextToken = token();
  const { error } = await admin
    .from("jobs")
    .update({
      adjuster_share_token: null,
      adjuster_share_token_hash: hashBearerToken(nextToken),
      adjuster_share_expires_at: shareExpiresAt(),
    })
    .eq("id", jobId);
  if (error) return { error: "Unable to rotate the adjuster portal link." };

  revalidatePath(`/jobs/${jobId}`);
  return { ok: true, token: nextToken };
}

export async function revokeAdjusterToken(jobId: string) {
  const auth = await requirePermission("portals.manage");
  if ("error" in auth) return auth;

  const admin = createAdminClient();
  const { error } = await admin
    .from("jobs")
    .update({
      adjuster_share_token: null,
      adjuster_share_token_hash: null,
      adjuster_share_expires_at: null,
    })
    .eq("id", jobId);
  if (error) return { error: "Unable to revoke the adjuster portal link." };

  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}
