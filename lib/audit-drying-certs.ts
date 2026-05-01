import { createAdminClient } from "./supabase-server";
import { logAudit } from "./audit";

const STUCK_APPROVAL_DAYS = 7;
const LOOKBACK_DAYS = 30;

type AuditFinding = {
  job_id: string;
  job_number: string | null;
  reason: string;
};

export type DryingCertAuditResult = {
  jobs_audited: number;
  false_negatives: AuditFinding[];
  stuck_approvals: AuditFinding[];
  ran_at: string;
};

/**
 * Sanity-check the drying-cert auto-trigger.
 *
 * Drying-complete conditions (must mirror lib/auto-triggers.ts):
 *   1. ≥3 distinct reading_dates in moisture_readings for the job
 *   2. For every distinct room, the most recent reading has is_dry_standard=true
 *   3. Job is not auto_actions_paused
 *
 * False negative = conditions met, no drying_certificate row.
 * Stuck approval = drying_certificate exists for ≥STUCK_APPROVAL_DAYS but no signed_at.
 */
export async function auditDryingCertAutoDrafts(): Promise<DryingCertAuditResult> {
  const admin = createAdminClient();

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
    .toISOString();

  const { data: jobs } = await admin
    .from("jobs")
    .select("id, job_number, auto_actions_paused, created_at")
    .in("status", ["drying", "completed", "closed"])
    .gte("created_at", since);

  const falseNegatives: AuditFinding[] = [];
  const stuckApprovals: AuditFinding[] = [];

  for (const job of jobs ?? []) {
    if ((job as any).auto_actions_paused) continue;

    const { data: readings } = await admin
      .from("moisture_readings")
      .select("room, reading_date, is_dry_standard")
      .eq("job_id", job.id);

    if (!readings || readings.length === 0) continue;

    // Per-room latest readings
    const latestByRoom = new Map<string, { date: string; dry: boolean }>();
    for (const r of readings as any[]) {
      if (!r.room || !r.reading_date) continue;
      const cur = latestByRoom.get(r.room);
      if (!cur || r.reading_date >= cur.date) {
        latestByRoom.set(r.room, {
          date: r.reading_date,
          dry: !!r.is_dry_standard,
        });
      }
    }
    if (latestByRoom.size === 0) continue;

    const allRoomsDry = Array.from(latestByRoom.values()).every((v) => v.dry);
    const distinctDays = new Set(
      (readings as any[])
        .map((r) => r.reading_date)
        .filter(Boolean) as string[]
    );
    const conditionsMet = distinctDays.size >= 3 && allRoomsDry;

    if (!conditionsMet) continue;

    // Find the latest "dry" date — that's roughly when the trigger should have fired
    const latestDryDate = Array.from(latestByRoom.values())
      .map((v) => v.date)
      .sort()
      .pop();

    const { data: cert } = await admin
      .from("legal_documents")
      .select("id, status, signed_at, created_at")
      .eq("job_id", job.id)
      .eq("doc_type", "drying_certificate")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!cert) {
      falseNegatives.push({
        job_id: job.id,
        job_number: (job as any).job_number ?? null,
        reason: `Drying complete since ${latestDryDate} but no drying_certificate row`,
      });
      continue;
    }

    if (!cert.signed_at) {
      const ageDays = Math.floor(
        (Date.now() - new Date(cert.created_at).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      if (ageDays >= STUCK_APPROVAL_DAYS) {
        stuckApprovals.push({
          job_id: job.id,
          job_number: (job as any).job_number ?? null,
          reason: `Cert drafted ${ageDays}d ago, status=${cert.status}, not signed`,
        });
      }
    }
  }

  const result: DryingCertAuditResult = {
    jobs_audited: (jobs ?? []).length,
    false_negatives: falseNegatives,
    stuck_approvals: stuckApprovals,
    ran_at: new Date().toISOString(),
  };

  // Always emit one heartbeat row to /activity, whether clean or not
  await logAudit({
    user: null,
    action: "drying_cert_audit",
    entity_type: "system",
    details: {
      jobs_audited: result.jobs_audited,
      false_negatives: result.false_negatives.length,
      stuck_approvals: result.stuck_approvals.length,
      false_negative_jobs: result.false_negatives.map((f) => f.job_number ?? f.job_id),
      stuck_approval_jobs: result.stuck_approvals.map((s) => s.job_number ?? s.job_id),
    },
  });

  return result;
}
