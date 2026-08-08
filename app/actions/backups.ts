"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { performBackup } from "@/lib/backups";
import { countBackupMismatches, type BackupEnvelope } from "@/lib/backup-integrity";
import { logAudit } from "@/lib/audit";
import { createHash } from "node:crypto";

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
  const { data: backup } = await admin
    .from("backups_log")
    .select("id")
    .eq("storage_path", storagePath)
    .eq("status", "ok")
    .maybeSingle();
  if (!backup) return { error: "Backup not found." };

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

  let parsed: BackupEnvelope;
  try {
    const text = await blob.text();
    parsed = JSON.parse(text);
  } catch {
    return { error: "Backup file is not valid JSON — file is corrupt." };
  }

  const expectedCounts = (latest.row_counts ?? {}) as Record<string, number>;
  const { mismatches, integrityErrors, totalRows } = countBackupMismatches(parsed, expectedCounts);

  if (Array.isArray(parsed.storage_objects)) {
    for (const rawEntry of parsed.storage_objects) {
      if (
        typeof rawEntry !== "object" ||
        rawEntry === null ||
        !("backup_path" in rawEntry) ||
        !("sha256" in rawEntry) ||
        typeof rawEntry.backup_path !== "string" ||
        typeof rawEntry.sha256 !== "string"
      ) {
        integrityErrors.push("Storage manifest contains an invalid entry.");
        continue;
      }
      const { data: objectBlob, error: objectError } = await admin.storage
        .from("backups")
        .download(rawEntry.backup_path);
      if (objectError || !objectBlob) {
        integrityErrors.push(`Missing storage backup object: ${rawEntry.backup_path}.`);
        continue;
      }
      const digest = createHash("sha256")
        .update(Buffer.from(await objectBlob.arrayBuffer()))
        .digest("hex");
      if (digest !== rawEntry.sha256) {
        integrityErrors.push(`Storage checksum mismatch: ${rawEntry.backup_path}.`);
      }
    }
  }

  const ok = mismatches.length === 0 && integrityErrors.length === 0;

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
      integrity_errors: integrityErrors,
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
    integrityErrors,
    storagePath: latest.storage_path,
  };
}
