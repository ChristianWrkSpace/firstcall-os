"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { performBackup } from "@/lib/backups";
import { logAudit } from "@/lib/audit";

export async function triggerManualBackup() {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };
  if (user.role !== "owner" && user.role !== "manager") {
    return { error: "Only owners and managers can run manual backups." };
  }

  try {
    const result = await performBackup("manual", user.id);
    logAudit({
      user,
      action: "backup.manual_triggered",
      details: { file: result.file, bytes: result.bytes, rows: result.rows },
    });
    revalidatePath("/settings/backups");
    return {
      ok: true as const,
      file: result.file,
      bytes: result.bytes,
      rows: result.rows,
      tables: result.tables,
    };
  } catch (err: any) {
    return { error: err?.message ?? "Backup failed." };
  }
}

export async function getSignedBackupUrl(storagePath: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };
  if (user.role !== "owner") {
    return { error: "Only owners can download backups." };
  }
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("backups")
    .createSignedUrl(storagePath, 60 * 5); // 5 min
  if (error || !data) return { error: error?.message ?? "Could not sign URL." };
  logAudit({
    user,
    action: "backup.downloaded",
    details: { file: storagePath },
  });
  return { ok: true, url: data.signedUrl };
}
