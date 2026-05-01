// Backup helper — called by both the cron route and the manual server action.
// Server-only.

import { createAdminClient } from "./supabase-server";

const BACKUP_TABLES = [
  "customers",
  "jobs",
  "job_notes",
  "estimates",
  "estimate_line_items",
  "invoices",
  "invoice_line_items",
  "payments",
  "equipment",
  "equipment_assignments",
  "moisture_readings",
  "legal_documents",
  "job_documents",
  "outreach_leads",
  "outreach_messages",
  "audit_logs",
  "profiles",
] as const;

export interface BackupResult {
  ok: true;
  file: string;
  bytes: number;
  tables: number;
  rows: number;
}

export async function performBackup(
  triggeredBy: "cron" | "manual",
  userId: string | null
): Promise<BackupResult> {
  const admin = createAdminClient();
  const startedAt = new Date();
  const stamp = startedAt.toISOString().replace(/[:.]/g, "-");
  const fileName = `backup-${stamp}.json`;

  const { data: logRow } = await admin
    .from("backups_log")
    .insert({
      triggered_by: triggeredBy,
      triggered_user: userId,
      status: "running",
      storage_path: fileName,
    })
    .select("id")
    .single();
  const logId = logRow?.id ?? null;

  const rowCounts: Record<string, number> = {};
  const payload: Record<string, any[]> = {};

  try {
    for (const t of BACKUP_TABLES) {
      const { data, error } = await admin.from(t).select("*");
      if (error) {
        console.warn(`[backup] ${t} skipped: ${error.message}`);
        rowCounts[t] = -1;
        payload[t] = [];
        continue;
      }
      rowCounts[t] = data?.length ?? 0;
      payload[t] = data ?? [];
    }

    const json = JSON.stringify(
      {
        meta: {
          generated_at: startedAt.toISOString(),
          triggered_by: triggeredBy,
          row_counts: rowCounts,
        },
        data: payload,
      },
      null,
      2
    );
    const bytes = Buffer.byteLength(json, "utf8");

    const { error: uploadError } = await admin.storage
      .from("backups")
      .upload(fileName, json, {
        contentType: "application/json",
        cacheControl: "no-cache",
        upsert: false,
      });
    if (uploadError) throw new Error(uploadError.message);

    if (logId) {
      await admin
        .from("backups_log")
        .update({
          status: "ok",
          bytes,
          row_counts: rowCounts,
          finished_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }

    return {
      ok: true,
      file: fileName,
      bytes,
      tables: Object.keys(rowCounts).length,
      rows: Object.values(rowCounts).reduce((s, n) => s + Math.max(0, n), 0),
    };
  } catch (err: any) {
    if (logId) {
      await admin
        .from("backups_log")
        .update({
          status: "failed",
          error: err?.message ?? String(err),
          finished_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }
    throw err;
  }
}
