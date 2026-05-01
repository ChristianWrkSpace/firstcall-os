"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { sendEmail, getFromAddress } from "@/lib/resend";

interface SignInput {
  token: string;
  typed_name: string;
  agreed: boolean;
}

/**
 * Public server action — signs a legal document via the tokenized URL.
 * No auth required: the signing_token IS the auth.
 *
 * ESIGN/UETA compliance:
 *   1. Intent to sign — they typed their name AND ticked the agreement box.
 *   2. Consent to do business electronically — agreement copy on the page
 *      includes the consent statement.
 *   3. Association with the record — we save the doc body version implicit
 *      via the doc id; signature_data references it.
 *   4. Signer ID — IP + user agent + timestamp captured.
 *   5. Retention — DB record is durable + auditable.
 */
export async function signLegalDoc(
  input: SignInput
): Promise<{ ok: true; jobNumber: string } | { error: string }> {
  if (!input.agreed) {
    return { error: "You must check the agreement box to sign." };
  }
  const typedName = input.typed_name.trim();
  if (typedName.length < 2) {
    return { error: "Type your full legal name." };
  }
  if (!input.token) return { error: "Missing token." };

  const admin = createAdminClient();

  const { data: doc } = await admin
    .from("legal_documents")
    .select("id, doc_type, status, body, subject, job_id, signing_token, sent_to")
    .eq("signing_token", input.token)
    .single();
  if (!doc) return { error: "This signing link is invalid or has expired." };

  if (doc.status === "signed") {
    return { error: "This document has already been signed." };
  }
  if (doc.status === "void") {
    return { error: "This document has been voided." };
  }
  if (doc.status === "draft") {
    // Approval flips draft → sent before email; if we somehow get here pre-approval, refuse.
    return {
      error: "This document hasn't been finalized yet. Please reply to the email and we'll help.",
    };
  }

  // Capture signer evidence
  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    hdrs.get("x-real-ip") ??
    null;
  const userAgent = hdrs.get("user-agent") ?? null;

  const signatureData = {
    typed_name: typedName,
    agreed: true,
    signed_at: new Date().toISOString(),
    method: "typed_name_e_signature",
    consent_text:
      "I agree this typed signature is valid for this document and I consent to do business electronically with First Call Mitigation. (ESIGN Act / Tex. UETA)",
  };

  const { error: updateError } = await admin
    .from("legal_documents")
    .update({
      status: "signed",
      signed_at: new Date().toISOString(),
      signed_by_name: typedName,
      signature_data: signatureData,
      signature_ip: ip,
      signature_user_agent: userAgent,
    })
    .eq("id", doc.id);
  if (updateError) return { error: updateError.message };

  // Audit log
  await admin.from("audit_logs").insert({
    action: "legal_doc.signed_online",
    entity_type: "legal_document",
    entity_id: doc.id,
    details: {
      doc_type: doc.doc_type,
      typed_name: typedName,
      ip,
      user_agent: userAgent,
      job_id: doc.job_id,
    },
    ip_address: ip,
  });

  // Auto-resolve any pending_approvals on this doc
  await admin
    .from("pending_approvals")
    .update({
      status: "approved",
      resolved_at: new Date().toISOString(),
      resolution_notes: "signed by customer via /sign",
    })
    .eq("entity_type", "legal_document")
    .eq("entity_id", doc.id)
    .eq("status", "pending");

  // Notify office (fire-and-forget after response)
  const { data: job } = await admin
    .from("jobs")
    .select("job_number, customers(name, email)")
    .eq("id", doc.job_id)
    .single();
  const jobNumber = job?.job_number ?? "(unknown)";
  const customer = (job as any)?.customers ?? {};

  after(async () => {
    try {
      const officeEmail = getFromAddress();
      const safeOffice = officeEmail.replace(/^.*<|>.*$/g, "");
      await sendEmail({
        to: safeOffice,
        subject: `✓ Signed: ${doc.doc_type} — Job ${jobNumber}`,
        html: `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#18181b;">
          <div style="max-width:600px;margin:24px auto;padding:24px;border:1px solid #e4e4e7;border-radius:8px;">
            <h2 style="margin:0 0 12px 0;">Document signed by customer</h2>
            <p style="margin:0 0 8px 0;font-size:14px;">
              <strong>${customer.name ?? "(name)"}</strong> just signed the
              <strong>${doc.doc_type.replace(/_/g, " ")}</strong> for Job
              <span style="font-family:monospace;">${jobNumber}</span>.
            </p>
            <ul style="font-size:13px;color:#27272a;line-height:1.7;padding-left:20px;margin:16px 0;">
              <li>Signed name: <strong>${typedName}</strong></li>
              <li>Signed at: ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })} CT</li>
              <li>IP: ${ip ?? "(unknown)"}</li>
              <li>Browser: ${(userAgent ?? "(unknown)").slice(0, 80)}</li>
            </ul>
            <p style="margin:16px 0 0 0;font-size:13px;color:#71717a;">
              Doc status is now <strong>signed</strong>. Audit trail in /settings/audit.
            </p>
          </div>
        </body></html>`,
      });
    } catch (err) {
      console.error("[sign.notify-office]", err);
    }
  });

  return { ok: true, jobNumber };
}
