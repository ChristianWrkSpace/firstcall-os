import { createAdminClient } from "./supabase-server";
import { logAudit } from "./audit";
import { sendEmail } from "./resend";

const STALE_HOURS = 48;
const LOOKBACK_DAYS = 14;

type StaleApproval = {
  id: string;
  kind: string;
  title: string;
  job_id: string | null;
  link: string | null;
  age_hours: number;
};

type FailedSend = {
  id: string;
  job_id: string | null;
  doc_type: string | null;
  status: string | null;
  attempted_at: string | null;
  error: string | null;
};

export type ApprovalsDigestResult = {
  stale_approvals: StaleApproval[];
  failed_sends: FailedSend[];
  email_sent_to: string | null;
  ran_at: string;
};

/**
 * Daily approvals digest — surfaces queue items >48h old and any legal-doc
 * sends that failed/skipped since the last run. Output:
 *   1. Email to OPERATOR_EMAIL (if env var set; otherwise heartbeat-only)
 *   2. Audit-log entry as approvals_digest with counts (visible at /activity)
 *
 * Per Turing 2026-05-04: 5 pending approvals vs 3 logged outcomes in 7d
 * (queue growing); 1/1 legal-doc send failure unsurfaced. This closes both.
 */
export async function runApprovalsDigest(): Promise<ApprovalsDigestResult> {
  const admin = createAdminClient();

  const staleCutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString();
  const lookbackCutoff = new Date(
    Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  // 1. Stale pending approvals (>48h old, still pending)
  const { data: staleRows } = await admin
    .from("pending_approvals")
    .select("id, kind, title, job_id, link, created_at")
    .eq("status", "pending")
    .lt("created_at", staleCutoff)
    .order("created_at", { ascending: true });

  const stale_approvals: StaleApproval[] = (staleRows ?? []).map((r: any) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    job_id: r.job_id,
    link: r.link,
    age_hours: Math.round((Date.now() - new Date(r.created_at).getTime()) / 3_600_000),
  }));

  // 2. Failed legal-doc sends in lookback window
  const { data: docRows } = await admin
    .from("legal_documents")
    .select("id, job_id, doc_type, last_send_attempt, updated_at")
    .not("last_send_attempt", "is", null)
    .gte("updated_at", lookbackCutoff);

  const failed_sends: FailedSend[] = (docRows ?? [])
    .filter((d: any) => {
      const s = d.last_send_attempt?.status;
      return s === "failed" || s === "skipped";
    })
    .map((d: any) => ({
      id: d.id,
      job_id: d.job_id,
      doc_type: d.doc_type,
      status: d.last_send_attempt?.status ?? null,
      attempted_at: d.last_send_attempt?.attempted_at ?? null,
      error: d.last_send_attempt?.error ?? null,
    }));

  // 3. Email digest (only if there's something to report AND OPERATOR_EMAIL is set)
  const operatorEmail = process.env.OPERATOR_EMAIL?.trim() || null;
  let email_sent_to: string | null = null;
  if (operatorEmail && (stale_approvals.length > 0 || failed_sends.length > 0)) {
    try {
      await sendEmail({
        to: operatorEmail,
        subject: `[FirstCall OS] ${stale_approvals.length} stale approvals, ${failed_sends.length} failed sends`,
        html: renderDigestHtml(stale_approvals, failed_sends),
      });
      email_sent_to = operatorEmail;
    } catch {
      // Email failure must not break the cron — fall through to audit log.
    }
  }

  await logAudit({
    user: null,
    action: "approvals_digest",
    entity_type: "system",
    details: {
      stale_approvals: stale_approvals.length,
      failed_sends: failed_sends.length,
      email_sent_to,
      stale_kinds: stale_approvals.map((a) => a.kind),
      failed_doc_types: failed_sends.map((f) => f.doc_type),
    },
  });

  return {
    stale_approvals,
    failed_sends,
    email_sent_to,
    ran_at: new Date().toISOString(),
  };
}

function renderDigestHtml(stale: StaleApproval[], failed: FailedSend[]): string {
  const staleRows = stale
    .map(
      (a) =>
        `<tr><td>${escapeHtml(a.kind)}</td><td>${escapeHtml(a.title)}</td><td>${a.age_hours}h</td><td>${
          a.link ? `<a href="${escapeHtml(a.link)}">review</a>` : "-"
        }</td></tr>`
    )
    .join("");

  const failedRows = failed
    .map(
      (f) =>
        `<tr><td>${escapeHtml(f.doc_type ?? "?")}</td><td>${escapeHtml(f.status ?? "?")}</td><td>${escapeHtml(
          f.attempted_at ?? "-"
        )}</td><td>${escapeHtml(f.error ?? "")}</td></tr>`
    )
    .join("");

  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#111;">
      <h2 style="margin:0 0 8px;">FirstCall OS — Approvals Digest</h2>
      <p style="color:#555;margin:0 0 24px;">
        Daily summary of items needing operator attention.
      </p>

      ${
        stale.length > 0
          ? `
        <h3 style="margin:24px 0 8px;color:#b45309;">Stale approvals (>${STALE_HOURS}h)</h3>
        <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px;">
          <thead style="background:#f3f4f6;"><tr><th>Kind</th><th>Title</th><th>Age</th><th>Link</th></tr></thead>
          <tbody>${staleRows}</tbody>
        </table>
      `
          : `<p style="color:#059669;">✓ No stale approvals.</p>`
      }

      ${
        failed.length > 0
          ? `
        <h3 style="margin:24px 0 8px;color:#b91c1c;">Failed legal-doc sends</h3>
        <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px;">
          <thead style="background:#f3f4f6;"><tr><th>Doc type</th><th>Status</th><th>Attempted</th><th>Error</th></tr></thead>
          <tbody>${failedRows}</tbody>
        </table>
      `
          : `<p style="color:#059669;">✓ No failed sends in last ${LOOKBACK_DAYS} days.</p>`
      }

      <p style="color:#9ca3af;font-size:12px;margin-top:32px;">
        Logged to /activity as approvals_digest. Configure recipient via OPERATOR_EMAIL env var.
      </p>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
