// Backup helper — called by both the cron route and the manual server action.
// Server-only.

import { createAdminClient } from "./supabase-server";
import { createHash } from "node:crypto";
import { fetchAllPages } from "./backup-integrity";

const BACKUP_TABLES = [
  "agent_invocations",
  "agent_outcomes",
  "audit_logs",
  "backups_log",
  "calls",
  "consumables_used",
  "cost_basis_settings",
  "customer_notifications",
  "customers",
  "echo_conversations",
  "equipment",
  "equipment_assignments",
  "estimate_line_items",
  "estimates",
  "invoice_line_items",
  "invoice_reminders",
  "invoices",
  "job_assignments",
  "job_documents",
  "job_notes",
  "job_photos",
  "job_videos",
  "jobs",
  "legal_documents",
  "moisture_readings",
  "outreach_leads",
  "outreach_messages",
  "partner_investments",
  "partner_payouts",
  "partners",
  "payments",
  "pending_approvals",
  "profiles",
  "secrets_rotation_log",
  "solomon_reports",
  "stripe_payment_events",
  "sub_invoices",
  "subcontractors",
  "tech_labor_entries",
  "unit_price_book",
  "vehicle_expenses",
] as const;

const BACKUP_STORAGE_BUCKETS = ["job-photos", "job-documents"] as const;

interface StorageBackupEntry {
  bucket: string;
  source_path: string;
  backup_path: string;
  bytes: number;
  sha256: string;
}

async function listStorageFiles(
  admin: ReturnType<typeof createAdminClient>,
  bucket: string,
  prefix = ""
): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`Backup failed listing ${bucket}/${prefix}: ${error.message}`);
    const entries = data ?? [];

    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id == null) paths.push(...(await listStorageFiles(admin, bucket, path)));
      else paths.push(path);
    }

    if (entries.length < 100) break;
    offset += entries.length;
  }

  return paths;
}

async function backupStorageObjects(
  admin: ReturnType<typeof createAdminClient>,
  stamp: string
): Promise<StorageBackupEntry[]> {
  const manifest: StorageBackupEntry[] = [];

  for (const bucket of BACKUP_STORAGE_BUCKETS) {
    for (const sourcePath of await listStorageFiles(admin, bucket)) {
      const { data, error } = await admin.storage.from(bucket).download(sourcePath);
      if (error || !data) {
        throw new Error(`Backup failed downloading ${bucket}/${sourcePath}: ${error?.message ?? "missing object"}`);
      }

      const bytes = Buffer.from(await data.arrayBuffer());
      const backupPath = `assets/${stamp}/${bucket}/${sourcePath}`;
      const { error: uploadError } = await admin.storage
        .from("backups")
        .upload(backupPath, bytes, { contentType: data.type || "application/octet-stream", upsert: false });
      if (uploadError) {
        throw new Error(`Backup failed copying ${bucket}/${sourcePath}: ${uploadError.message}`);
      }

      manifest.push({
        bucket,
        source_path: sourcePath,
        backup_path: backupPath,
        bytes: bytes.byteLength,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
  }

  return manifest;
}

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
  const tableChecksums: Record<string, string> = {};
  const payload: Record<string, any[]> = {};

  try {
    for (const t of BACKUP_TABLES) {
      const orderBy =
        t === "stripe_payment_events"
          ? "event_id"
          : t === "unit_price_book"
            ? "xactimate_code"
            : "id";
      const rows = await fetchAllPages(async (from, to) => {
        const { data, error } = await admin
          .from(t)
          .select("*")
          .order(orderBy, { ascending: true })
          .range(from, to);
        if (error) throw new Error(`Backup failed reading ${t}: ${error.message}`);
        return data ?? [];
      });
      rowCounts[t] = rows.length;
      payload[t] = rows;
      tableChecksums[t] = createHash("sha256")
        .update(JSON.stringify(rows))
        .digest("hex");
    }

    const storageObjects = await backupStorageObjects(admin, stamp);

    const json = JSON.stringify(
      {
        meta: {
          schema_version: 2,
          generated_at: startedAt.toISOString(),
          triggered_by: triggeredBy,
          row_counts: rowCounts,
          table_sha256: tableChecksums,
          storage_object_count: storageObjects.length,
        },
        data: payload,
        storage_objects: storageObjects,
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
