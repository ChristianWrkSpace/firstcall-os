"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

/**
 * Start TOTP enrollment. Returns the QR code (data URI) + factorId for the
 * caller to render and persist for the verify step. The factor stays in
 * "unverified" state until verifyMfaEnrollment confirms a code.
 */
export async function enrollMfa(): Promise<{
  factorId?: string;
  qrCode?: string;
  secret?: string;
  error?: string;
}> {
  const me = await getCurrentUser();
  if (!me) return { error: "Not authenticated." };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `firstcall-${Date.now()}`,
  });

  if (error || !data) {
    return { error: error?.message ?? "MFA enrollment failed." };
  }

  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

/**
 * Verify the TOTP code from the user's authenticator app. On success the
 * factor flips to "verified" and starts protecting future logins.
 */
export async function verifyMfaEnrollment(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData
) {
  const me = await getCurrentUser();
  if (!me) return { error: "Not authenticated." };

  const factorId = formData.get("factor_id") as string;
  const code = ((formData.get("code") as string) ?? "").trim();
  if (!factorId) return { error: "Missing factor id." };
  if (!/^\d{6}$/.test(code)) return { error: "Code must be 6 digits." };

  const supabase = await createServerSupabaseClient();

  // Step 1: create a challenge for the factor
  const { data: challenge, error: chalErr } = await supabase.auth.mfa.challenge({ factorId });
  if (chalErr || !challenge) {
    return { error: chalErr?.message ?? "Could not start verification." };
  }

  // Step 2: verify the code against the challenge
  const { error: verifyErr } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });
  if (verifyErr) {
    return { error: verifyErr.message };
  }

  logAudit({
    user: me,
    action: "mfa.enrolled",
    entity_type: "auth_factor",
    entity_id: factorId,
    details: { factor_type: "totp" },
  });

  revalidatePath("/settings/security");
  return { ok: true };
}

export async function unenrollMfa(factorId: string) {
  const me = await getCurrentUser();
  if (!me) return { error: "Not authenticated." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { error: error.message };

  logAudit({
    user: me,
    action: "mfa.unenrolled",
    entity_type: "auth_factor",
    entity_id: factorId,
    details: {},
  });

  revalidatePath("/settings/security");
  return { ok: true };
}

export async function listMfaFactors() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return { factors: [], error: error.message };
  return {
    factors: [
      ...(data?.totp ?? []).map((f) => ({
        id: f.id,
        type: "totp" as const,
        friendlyName: f.friendly_name ?? "Authenticator",
        status: f.status,
        createdAt: f.created_at,
      })),
    ],
  };
}
