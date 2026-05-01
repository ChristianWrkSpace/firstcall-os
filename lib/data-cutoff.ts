/**
 * UI-level cutoff for hiding pre-launch test data without deleting it.
 *
 * Why this exists: the owner ran the system in test mode before going
 * live. Wiping the DB was an option but they preferred to keep the rows
 * around for reference. This module returns an ISO timestamp; list
 * queries then add `.gte("created_at", cutoff)` so anything older just
 * doesn't appear in the UI.
 *
 * Detail pages (/jobs/[id], /customers/[id], etc.) intentionally do
 * NOT apply this filter — direct URLs still resolve so historical
 * references (an old AOB, an old estimate PDF) keep working.
 *
 * Override via the `DATA_CUTOFF` env var (ISO 8601). Set to "" to
 * disable filtering entirely (e.g. during a data audit).
 */

const FALLBACK_CUTOFF = "2026-05-01T18:00:00Z";

export function getDataCutoff(): string | null {
  const raw = process.env.DATA_CUTOFF;
  if (raw === "") return null;
  return raw ?? FALLBACK_CUTOFF;
}
