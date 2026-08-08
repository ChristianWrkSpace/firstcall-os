import { createHash } from "node:crypto";

export interface BackupEnvelope {
  meta?: Record<string, unknown>;
  data?: Record<string, unknown>;
  storage_objects?: unknown;
}

export interface BackupMismatch {
  table: string;
  expected: number;
  actual: number;
}

export function countBackupMismatches(
  payload: BackupEnvelope,
  expectedCounts: Record<string, number>
): { totalRows: number; mismatches: BackupMismatch[]; integrityErrors: string[] } {
  const tables = payload.data ?? {};
  const mismatches: BackupMismatch[] = [];
  const integrityErrors: string[] = [];
  let totalRows = 0;

  const schemaVersion = payload.meta?.schema_version;
  if (schemaVersion !== 1 && schemaVersion !== 2) {
    integrityErrors.push("Unsupported or missing backup schema version.");
  }
  const checksums = payload.meta?.table_sha256;
  const checksumMap =
    typeof checksums === "object" && checksums !== null
      ? (checksums as Record<string, unknown>)
      : {};

  for (const [table, expected] of Object.entries(expectedCounts)) {
    const rows = tables[table];
    const actual = Array.isArray(rows) ? rows.length : 0;
    totalRows += actual;
    if (actual !== expected) mismatches.push({ table, expected, actual });
    if (Array.isArray(rows)) {
      const actualChecksum = createHash("sha256").update(JSON.stringify(rows)).digest("hex");
      if (checksumMap[table] !== actualChecksum) {
        integrityErrors.push(`Checksum mismatch for ${table}.`);
      }
    }
  }

  if (schemaVersion === 2) {
    const objects = Array.isArray(payload.storage_objects) ? payload.storage_objects : [];
    if (payload.meta?.storage_object_count !== objects.length) {
      integrityErrors.push("Storage object manifest count mismatch.");
    }
  }

  return { totalRows, mismatches, integrityErrors };
}

export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize = 1000
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error("pageSize must be a positive integer");
  }

  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
