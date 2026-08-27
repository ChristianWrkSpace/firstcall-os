"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase-server";
import { requirePermission } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { ALL_ROLES, type Role } from "@/lib/permissions";
import {
  orchestrateAccountActiveTransition,
  type AccountActiveTransitionResult,
} from "@/lib/account-active-transitions";

/**
 * Invite a new user by email.
 *
 * Sends a Supabase invite email; the link lands on /auth/callback which
 * exchanges the token for a session and forwards to /reset-password so the
 * new user sets their own password. The profile row is upserted immediately
 * with the chosen role, so they land with the right permissions on first
 * login (no "everyone starts as technician, promote later" dance).
 */
export async function inviteUser(
  _prev: { error?: string; ok?: boolean; message?: string } | undefined,
  formData: FormData
) {
  const check = await requirePermission("users.manage");
  if ("error" in check) return { error: check.error };

  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const role = (formData.get("role") as string) as Role;

  if (!name) return { error: "Name is required." };
  if (!email || !email.includes("@")) return { error: "A valid email is required." };
  if (!ALL_ROLES.includes(role)) return { error: "Invalid role." };

  const hdrs = await headers();
  const origin =
    hdrs.get("origin") ??
    `https://${hdrs.get("host") ?? "firstcall-os.vercel.app"}`;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { name },
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) {
    if (error.message.toLowerCase().includes("already")) {
      return { error: "That email already has an account." };
    }
    return { error: error.message };
  }

  // A DB trigger may create the profile on auth-user insert; upsert so the
  // name + chosen role stick either way.
  const { error: profileError } = await admin.from("profiles").upsert({
    id: data.user.id,
    name,
    email,
    role,
    active: true,
  });
  if (profileError) {
    return { error: `Invited, but profile setup failed: ${profileError.message}` };
  }

  await logAudit({
    user: check.user,
    action: "user.invited",
    entity_type: "profile",
    entity_id: data.user.id,
    details: { email, role },
  });

  revalidatePath("/settings/users");
  return { ok: true, message: `Invite sent to ${email} as ${role}.` };
}

export async function changeUserRole(profileId: string, newRole: Role) {
  const check = await requirePermission("users.manage");
  if ("error" in check) return { error: check.error };

  if (profileId === check.user.id && newRole !== "owner") {
    return { error: "You can't demote yourself from Owner." };
  }

  const admin = createAdminClient();

  const { data: target } = await admin
    .from("profiles")
    .select("role, name")
    .eq("id", profileId)
    .single();

  const oldRole = target?.role;

  const { error } = await admin
    .from("profiles")
    .update({ role: newRole })
    .eq("id", profileId);
  if (error) return { error: error.message };

  await logAudit({
    user: check.user,
    action: "user.role_changed",
    entity_type: "profile",
    entity_id: profileId,
    details: {
      target_user: target?.name,
      from: oldRole,
      to: newRole,
    },
  });

  revalidatePath("/settings/users");
  return { ok: true };
}

export async function setUserActive(
  profileId: string,
  desiredActive: boolean,
  idempotencyKey: string
): Promise<AccountActiveTransitionResult> {
  const failure = (message: string, retryable: boolean): AccountActiveTransitionResult => ({
    outcome: "error",
    transitionId: null,
    desiredActive: typeof desiredActive === "boolean" ? desiredActive : false,
    profileActive: null,
    providerState: "unknown",
    transitionStatus: "unavailable",
    retryable,
    message,
  });

  try {
    const check = await requirePermission("users.manage");
    if ("error" in check) return failure("You do not have permission to manage users.", false);

    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuid.test(profileId) || typeof desiredActive !== "boolean" ||
        typeof idempotencyKey !== "string" || !uuid.test(idempotencyKey)) {
      return failure("Invalid account change request.", false);
    }
    if (profileId === check.user.id && !desiredActive) {
      return failure("You can't deactivate yourself.", false);
    }

    return await orchestrateAccountActiveTransition({
      targetProfileId: profileId,
      desiredActive,
      idempotencyKey,
      actorId: check.user.id,
    });
  } catch {
    return failure("Account status could not be confirmed. Please retry.", true);
  } finally {
    for (const path of ["/settings/users", "/settings/security"]) {
      try {
        revalidatePath(path);
      } catch {
        // Cache invalidation must not replace the authoritative transition result.
      }
    }
  }
}
