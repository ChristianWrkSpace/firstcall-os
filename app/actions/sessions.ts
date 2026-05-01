"use server";

import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

/**
 * Sign out all OTHER sessions for the current user (keeps the current one).
 * Useful when the user thinks their password was exposed or just changed it.
 */
export async function signOutOtherSessions() {
  const me = await getCurrentUser();
  if (!me) return { error: "Not authenticated." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) return { error: error.message };

  logAudit({
    user: me,
    action: "session.signout_others",
    entity_type: "user",
    entity_id: me.id,
    details: {},
  });
  revalidatePath("/settings/security");
  return { ok: true };
}

/**
 * Sign out a target user from EVERY device, immediately.
 * Owner-only. Used when an account is compromised or an employee leaves.
 */
export async function forceSignOutUser(userId: string) {
  const me = await getCurrentUser();
  if (!me) return { error: "Not authenticated." };
  if (me.role !== "owner") return { error: "Owner only." };

  const admin = createAdminClient();
  // signOut takes a JWT, not a userId — but we can use the admin endpoint
  // to invalidate all refresh tokens for the user via admin.signOut(jwt) is
  // not directly available. Instead invalidate by deleting + re-creating
  // the refresh tokens via admin.updateUserById with a no-op metadata bump.
  // Simpler: use the dedicated admin endpoint.
  const { error } = await admin.auth.admin.signOut(userId, "global");
  if (error) return { error: error.message };

  logAudit({
    user: me,
    action: "session.force_signout",
    entity_type: "user",
    entity_id: userId,
    details: { scope: "global" },
  });
  revalidatePath("/settings/security");
  return { ok: true };
}

/**
 * Owner view: list every user in the org with their last sign-in time so
 * stale accounts surface. Powered by Supabase auth.admin.listUsers.
 */
export async function listAllUserSessions() {
  const me = await getCurrentUser();
  if (!me) return { error: "Not authenticated.", users: [] };
  if (me.role !== "owner") return { error: "Owner only.", users: [] };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error || !data) return { error: error?.message ?? "Lookup failed.", users: [] };

  // Pull profile names alongside auth users
  const userIds = data.users.map((u) => u.id);
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, name, role, active")
    .in("id", userIds);
  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  return {
    users: data.users.map((u) => {
      const p = profileMap.get(u.id) as any;
      return {
        id: u.id,
        email: u.email ?? null,
        name: p?.name ?? u.email ?? "—",
        role: p?.role ?? "—",
        active: p?.active ?? true,
        lastSignInAt: u.last_sign_in_at ?? null,
        createdAt: u.created_at,
      };
    }),
  };
}
