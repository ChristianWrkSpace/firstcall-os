// Auto-send approved homeowner-facing legal docs to the customer by email.
// Server-only. Called via after() from approveLegalDoc.
//
// Hard rules:
//   * Only homeowner-facing doc types (aob / work_authorization /
//     direction_to_pay / drying_certificate). Carrier-bound docs (demand
//     letter, notice of appraisal) STAY MANUAL because the recipient is
//     the insurance company, not the homeowner.
//   * Customer must have an email + auto_notify_emails enabled.
//   * Job must not be auto_actions_paused.
//   * After successful send, mark the doc as 'sent' so the office isn't
//     left clicking "Mark Sent" — that's the click we're killing.
//   * Email includes a tokenized "Sign Online" link to /sign/[token] for
//     in-app e-sign in 2 clicks (no DocuSign vendor cost).

import crypto from "node:crypto";
import { hashBearerToken } from "@/lib/token-hash";
import { createAdminClient } from "./supabase-server";
import { sendEmail } from "./resend";
import type { LegalDocType } from "./esquire-types";

const APP_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://firstcall-os.vercel.app";

const AUTO_SEND_TYPES: LegalDocType[] = [
  "aob",
  "work_authorization",
  "direction_to_pay",
  "drying_certificate",
];

const EMAIL_LOGO_URL = "https://firstcall-os.vercel.app/logo-banner.png";

const SIGN_INSTRUCTIONS_BY_TYPE: Record<string, string> = {
  aob: "Please review the Assignment of Benefits below. If everything looks accurate, click the green Sign Online button — it takes about 30 seconds. We'll handle the rest with your insurance carrier from there.",
  work_authorization:
    "Before our crew can start work at your property, we need this Work Authorization signed. Click the green Sign Online button to e-sign in 30 seconds.",
  direction_to_pay:
    "This Direction to Pay tells your insurance carrier to issue payment for our mitigation work directly to First Call. Click Sign Online to e-sign — quick and free.",
  drying_certificate:
    "Your property has reached dry standard per IICRC S500. Click Sign Online to acknowledge this certificate. We'll forward to your carrier once you've signed.",
};

const SUBJECT_PREFIX_BY_TYPE: Record<string, string> = {
  aob: "Please review and sign — Assignment of Benefits",
  work_authorization: "Please review and sign — Work Authorization",
  direction_to_pay: "Please review and sign — Direction to Pay",
  drying_certificate: "Please review and sign — Drying Certificate",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function generateSigningToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

function shell({
  customerName,
  jobNumber,
  preamble,
  bodyHtml,
  signUrl,
}: {
  customerName: string;
  jobNumber: string;
  preamble: string;
  bodyHtml: string;
  signUrl: string;
}) {
  const firstName = customerName.split(" ")[0] ?? customerName;
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:24px 28px 16px 28px;border-bottom:2px solid #2563eb;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <img src="${EMAIL_LOGO_URL}" alt="First Call Mitigation" height="40" style="display:block;height:40px;width:auto;border:0;outline:none;text-decoration:none;">
              </td>
              <td align="right" style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:1px;vertical-align:middle;">Water · Fire · Mold</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px 28px;line-height:1.6;color:#27272a;">
          <h2 style="margin:0 0 12px 0;color:#18181b;font-size:18px;">Hi ${escapeHtml(firstName)},</h2>
          <p style="margin:0 0 20px 0;font-size:14px;">${escapeHtml(preamble)}</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
            <tr><td align="center">
              <a href="${signUrl}" style="display:inline-block;padding:14px 36px;background:#16a34a;color:#ffffff;font-weight:600;font-size:15px;border-radius:8px;text-decoration:none;border:1px solid #15803d;">
                ✍️ Sign Online — 30 seconds
              </a>
              <p style="margin:8px 0 0 0;font-size:11px;color:#71717a;">No app to install. No printer needed. Free.</p>
            </td></tr>
          </table>

          <p style="margin:0 0 12px 0;font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Document</p>
          <div style="margin:0 0 16px 0;padding:24px;background:#fafafa;border:1px solid #e4e4e7;border-radius:6px;font-family:Georgia,'Times New Roman',serif;font-size:13px;color:#18181b;white-space:pre-wrap;line-height:1.55;">${bodyHtml}</div>
          <p style="margin:16px 0 0 0;font-size:13px;color:#71717a;">Prefer to print and sign by hand? Just reply to this email with a scanned copy. Either way works. Questions? Call <a href="tel:5125550100" style="color:#2563eb;">(512) 555-0100</a>.</p>
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #e4e4e7;background:#fafafa;font-size:11px;color:#71717a;">
          First Call Mitigation · Austin, TX · IICRC Certified · 24/7 Emergency Response<br>
          Job <span style="font-family:Menlo,monospace;">${escapeHtml(jobNumber)}</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

interface SendAttempt {
  attempted_at: string;
  status: "sent" | "skipped" | "failed";
  reason?: string;
  recipient?: string;
}

async function recordAttempt(
  docId: string,
  attempt: SendAttempt,
  jobId?: string,
  docType?: string
) {
  try {
    const admin = createAdminClient();
    await admin
      .from("legal_documents")
      .update({ last_send_attempt: attempt })
      .eq("id", docId);

    await admin.from("audit_logs").insert({
      action: `legal_doc.send_${attempt.status}`,
      entity_type: "legal_document",
      entity_id: docId,
      details: {
        doc_type: docType ?? null,
        job_id: jobId ?? null,
        reason: attempt.reason ?? null,
        recipient: attempt.recipient ?? null,
      },
    });
  } catch (err: any) {
    console.error("[recordAttempt]", err?.message ?? err);
  }
}

/**
 * Run the auto-send. Force=true bypasses the auto-pause + opt-out checks
 * (used by the "Send Now" manual override button).
 */
export async function autoSendLegalDocToCustomer(
  docId: string,
  options: { force?: boolean } = {}
): Promise<void> {
  const force = options.force === true;
  const admin = createAdminClient();

  try {
    const { data: doc } = await admin
      .from("legal_documents")
      .select("id, doc_type, subject, body, status, job_id")
      .eq("id", docId)
      .single();
    if (!doc) {
      await recordAttempt(docId, {
        attempted_at: new Date().toISOString(),
        status: "skipped",
        reason: "Document not found",
      });
      return;
    }

    if (doc.status !== "approved" && doc.status !== "sent") {
      await recordAttempt(docId, {
        attempted_at: new Date().toISOString(),
        status: "skipped",
        reason: `Doc status is "${doc.status}" — must be approved or sent before sending to customer`,
      }, doc.job_id, doc.doc_type);
      return;
    }

    if (!AUTO_SEND_TYPES.includes(doc.doc_type as LegalDocType)) {
      await recordAttempt(docId, {
        attempted_at: new Date().toISOString(),
        status: "skipped",
        reason: `Doc type "${doc.doc_type}" is carrier-bound, not auto-sent to homeowner`,
      }, doc.job_id, doc.doc_type);
      return;
    }

    const { data: job } = await admin
      .from("jobs")
      .select(
        "id, job_number, auto_actions_paused, is_test, customers(name, email, auto_notify_emails)"
      )
      .eq("id", doc.job_id)
      .single();
    if (!job) {
      await recordAttempt(docId, {
        attempted_at: new Date().toISOString(),
        status: "skipped",
        reason: "Job not found",
      }, doc.job_id, doc.doc_type);
      return;
    }

    if (job.is_test) {
      await recordAttempt(docId, {
        attempted_at: new Date().toISOString(),
        status: "skipped",
        reason: "Test jobs cannot send customer documents.",
      }, doc.job_id, doc.doc_type);
      return;
    }

    if (!force && job.auto_actions_paused) {
      await recordAttempt(docId, {
        attempted_at: new Date().toISOString(),
        status: "skipped",
        reason: "Job has auto-actions paused (manual mode). Use 'Send Now' to override.",
      }, doc.job_id, doc.doc_type);
      return;
    }

    const customer = (job as any).customers ?? {};
    if (!customer.email) {
      await recordAttempt(docId, {
        attempted_at: new Date().toISOString(),
        status: "skipped",
        reason: "No email on customer record. Add an email to the customer to enable auto-send.",
      }, doc.job_id, doc.doc_type);
      return;
    }

    if (!force && customer.auto_notify_emails === false) {
      await recordAttempt(docId, {
        attempted_at: new Date().toISOString(),
        status: "skipped",
        reason: "Customer has opted out of auto-emails. Use 'Send Now' to override.",
      }, doc.job_id, doc.doc_type);
      return;
    }

    // Every send rotates the bearer credential and gives it a short lifetime.
    // A forwarded or previously logged link therefore stops working after resend.
    const signingToken = generateSigningToken();
    const { error: tokenError } = await admin
      .from("legal_documents")
      .update({
        signing_token: hashBearerToken(signingToken),
        signing_token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", docId);
    if (tokenError) {
      await recordAttempt(docId, {
        attempted_at: new Date().toISOString(),
        status: "failed",
        reason: "Could not create a secure signing link.",
      }, doc.job_id, doc.doc_type);
      return;
    }

    const signUrl = `${APP_BASE_URL}/sign/${signingToken}`;
    const preamble =
      SIGN_INSTRUCTIONS_BY_TYPE[doc.doc_type] ??
      "Please review the document below and click Sign Online.";
    const subject =
      SUBJECT_PREFIX_BY_TYPE[doc.doc_type] ?? doc.subject ?? "Please review and sign";

    const html = shell({
      customerName: customer.name ?? "there",
      jobNumber: job.job_number,
      preamble,
      bodyHtml: escapeHtml(doc.body),
      signUrl,
    });

    try {
      await sendEmail({
        to: customer.email,
        subject,
        html,
      });
    } catch (sendErr: any) {
      await recordAttempt(docId, {
        attempted_at: new Date().toISOString(),
        status: "failed",
        reason: `Resend rejected the send: ${sendErr?.message ?? sendErr}`,
        recipient: customer.email,
      }, doc.job_id, doc.doc_type);
      return;
    }

    // Mark the doc as sent — kills the manual "Mark Sent" click. Final flip
    // to 'signed' happens automatically when the customer e-signs.
    await admin
      .from("legal_documents")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        sent_to: customer.email,
      })
      .eq("id", docId);

    await recordAttempt(docId, {
      attempted_at: new Date().toISOString(),
      status: "sent",
      recipient: customer.email,
    }, doc.job_id, doc.doc_type);
  } catch (err: any) {
    console.error("[auto-send-legal-doc]", err?.message ?? err);
  }
}
