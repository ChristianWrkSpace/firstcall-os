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

/**
 * Verify the latest successful backup is intact: download it, parse it,
 * count rows in the parsed JSON, and compare to the metadata stored in
 * backups_log.row_counts. Returns OK if every table matches.
 *
 * Lets the office click "Verify" once a quarter and get an honest answer
 * to "is this backup actually restorable?" without needing a sandbox.
 */
export async function verifyLatestBackup() {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };
  if (user.role !== "owner" && user.role !== "manager") {
    return { error: "Owner or manager only." };
  }
  const admin = createAdminClient();

  const { data: latest, error: lookupErr } = await admin
    .from("backups_log")
    .select("id, storage_path, row_counts, bytes, created_at")
    .eq("status", "ok")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lookupErr || !latest) {
    return { error: "No successful backup found." };
  }

  const { data: blob, error: dlErr } = await admin.storage
    .from("backups")
    .download(latest.storage_path);
  if (dlErr || !blob) {
    return { error: dlErr?.message ?? "Could not download backup file." };
  }

  let parsed: Record<string, any[]>;
  try {
    const text = await blob.text();
    parsed = JSON.parse(text);
  } catch {
    return { error: "Backup file is not valid JSON — file is corrupt." };
  }

  const expectedCounts = (latest.row_counts ?? {}) as Record<string, number>;
  const mismatches: Array<{ table: string; expected: number; actual: number }> = [];
  let totalRows = 0;
  for (const [table, expected] of Object.entries(expectedCounts)) {
    const actual = Array.isArray(parsed[table]) ? parsed[table].length : 0;
    totalRows += actual;
    if (actual !== expected) {
      mismatches.push({ table, expected, actual });
    }
  }

  const ok = mismatches.length === 0;

  logAudit({
    user,
    action: "backup.drill_verify",
    entity_type: "backups_log",
    entity_id: latest.id,
    details: {
      storage_path: latest.storage_path,
      backup_age_hours:
        (Date.now() - new Date(latest.created_at).getTime()) / 3_600_000,
      total_rows: totalRows,
      mismatches,
      ok,
    },
  });

  return {
    ok,
    backupAgeHours:
      Math.round(
        ((Date.now() - new Date(latest.created_at).getTime()) / 3_600_000) * 10
      ) / 10,
    totalRows,
    tableCount: Object.keys(expectedCounts).length,
    mismatches,
    storagePath: latest.storage_path,
  };
}
