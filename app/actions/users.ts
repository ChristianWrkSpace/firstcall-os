"use server";

import { createAdminClient } from "@/lib/supabase-server";
import { requirePermission } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { Role } from "@/lib/permissions";

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

export async function setUserActive(profileId: string, active: boolean) {
  const check = await requirePermission("users.manage");
  if ("error" in check) return { error: check.error };

  if (profileId === check.user.id && !active) {
    return { error: "You can't deactivate yourself." };
  }

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("name")
    .eq("id", profileId)
    .single();

  const { error } = await admin
    .from("profiles")
    .update({ active })
    .eq("id", profileId);
  if (error) return { error: error.message };

  await logAudit({
    user: check.user,
    action: active ? "user.activated" : "user.deactivated",
    entity_type: "profile",
    entity_id: profileId,
    details: { target_user: target?.name },
  });

  revalidatePath("/settings/users");
  return { ok: true };
}
