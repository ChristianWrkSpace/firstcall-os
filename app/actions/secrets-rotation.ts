"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";

export async function markSecretRotated(secretName: string, notes: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };
  if (user.role !== "owner" && user.role !== "manager") {
    return { error: "Only owners and managers can record rotations." };
  }
  if (!secretName.trim()) return { error: "Secret name required." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("secrets_rotation_log").insert({
    secret_name: secretName.trim(),
    rotated_by: user.id,
    notes: notes.trim() || null,
  });

  if (error) return { error: error.message };

  logAudit({
    user,
    action: "secret.rotated",
    entity_type: "secret",
    details: { secret_name: secretName.trim(), notes: notes.trim() || null },
  });

  revalidatePath("/settings/secrets-rotation");
  return { ok: true };
}
