import { createAdminClient } from "@/lib/supabase-server";
import Link from "next/link";
import {
  LEGAL_DOC_BY_VALUE,
  LEGAL_STATUS_BADGE,
  type LegalDocStatus,
} from "@/lib/esquire-types";
import LegalDocActions from "./LegalDocActions";

// Always force dynamic — never cache the doc page. After approval/discard
// the same URL must reflect the new state immediately.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LegalDocPage({
  params,
}: {
  params: Promise<{ id: string; docId: string }>;
}) {
  const { id: jobId, docId } = await params;
  // Use admin client. Middleware already gated this route to authenticated
  // dashboard users — at this point we trust them. Admin client bypasses RLS
  // so we never see a "doc exists but RLS blocked" 404 (the bug from earlier).
  const admin = createAdminClient();

  // Base-schema columns first (always exist). The optional e-sign columns
  // (signing_token, signature_*, last_send_attempt) come from later migrations
  // (022 + 023) — fetch them in a separate query that gracefully handles
  // "column does not exist" if those migrations haven't been run yet.
  const [{ data: docBase, error: docErr }, { data: job }] = await Promise.all([
    admin
      .from("legal_documents")
      .select(
        "id, doc_type, subject, body, status, created_at, sent_at, sent_to, signed_at, signed_by_name, approved_at, generated_by, approved_by"
      )
      .eq("id", docId)
      .maybeSingle(),
    admin
      .from("jobs")
      .select("id, job_number, customers(name, email)")
      .eq("id", jobId)
      .maybeSingle(),
  ]);
  if (docErr) {
    console.error(`[legal-doc-page] base select failed: ${docErr.message}`);
  }

  // Optional columns — degrade gracefully if migrations 022/023 haven't run
  let optional: {
    signing_token?: string | null;
    signature_data?: any;
    signature_ip?: string | null;
    signature_user_agent?: string | null;
    last_send_attempt?: any;
  } = {};
  if (docBase) {
    const { data: opt } = await admin
      .from("legal_documents")
      .select(
        "signing_token, signature_data, signature_ip, signature_user_agent, last_send_attempt"
      )
      .eq("id", docId)
      .maybeSingle();
    if (opt) optional = opt as typeof optional;
  }
  const doc = docBase ? { ...docBase, ...optional } : null;

  // Friendly "removed" view if the doc was deleted (instead of a hard 404)
  if (!doc) {
    // Log for diagnosis: does the doc truly not exist? Or did the lookup fail?
    console.warn(
      `[legal-doc-page] Doc not found via admin client. docId=${docId} jobId=${jobId}`
    );
    return (
      <div className="p-4 md:p-8 max-w-3xl">
        <Link
          href={`/jobs/${jobId}`}
          className="text-ink-3 hover:text-ink text-sm transition-colors"
        >
          ← Back to job
        </Link>
        <div className="mt-6 glass-card p-8">
          <h1 className="text-xl font-bold text-ink">Document not found</h1>
          <p className="text-ink-2 text-sm mt-2 leading-relaxed">
            This document was discarded or never existed. If a legal document
            was already approved, sent, or signed, it cannot be deleted —
            those records stay on the job permanently. If you discarded a draft
            and need a new one, generate a fresh draft from the job's Esquire
            panel.
          </p>
          <p className="text-ink-3 text-[11px] font-mono mt-3">
            doc id: {docId}
          </p>
          {jobId && (
            <Link
              href={`/jobs/${jobId}`}
              className="inline-block mt-5 px-4 py-2 bg-cta hover:bg-cta-deep text-white text-sm font-medium rounded-lg"
            >
              Open the job
            </Link>
          )}
        </div>
      </div>
    );
  }
  if (!job) {
    return (
      <div className="p-4 md:p-8 max-w-3xl">
        <p className="text-ink-2 text-sm">Job not found.</p>
      </div>
    );
  }

  const meta = LEGAL_DOC_BY_VALUE[doc.doc_type as keyof typeof LEGAL_DOC_BY_VALUE];
  const customer = (job as any).customers;
  const signingUrl =
    doc.signing_token && meta?.needsSignature
      ? `${process.env.NEXT_PUBLIC_APP_URL ?? "https://firstcall-os.vercel.app"}/sign/${doc.signing_token}`
      : null;

  return (
    <div className="p-4 md:p-8 max-w-4xl print-page">
      {/* App chrome — hidden on print */}
      <div className="mb-4 no-print">
        <Link
          href={`/jobs/${jobId}`}
          className="text-ink-3 hover:text-ink text-sm transition-colors"
        >
          ← Job {job.job_number}
        </Link>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <h1 className="text-2xl font-bold text-ink">
            {meta?.label ?? doc.doc_type}
          </h1>
          <span
            className={`text-xs px-2.5 py-0.5 rounded-full font-medium uppercase ${LEGAL_STATUS_BADGE[doc.status as LegalDocStatus] ?? ""}`}
          >
            {doc.status}
          </span>
        </div>
        <p className="text-ink-3 text-xs mt-1">
          Generated {new Date(doc.created_at).toLocaleString()}
          {doc.approved_at && ` · approved ${new Date(doc.approved_at).toLocaleString()}`}
          {doc.sent_at && ` · sent to ${doc.sent_to ?? "(unknown)"} ${new Date(doc.sent_at).toLocaleString()}`}
          {doc.signed_at && ` · signed by ${doc.signed_by_name ?? "(unknown)"} ${new Date(doc.signed_at).toLocaleString()}`}
        </p>
      </div>

      <LegalDocActions
        docId={doc.id}
        jobId={jobId}
        status={doc.status as LegalDocStatus}
        subject={doc.subject ?? ""}
        body={doc.body}
        needsSignature={meta?.needsSignature ?? false}
        needsRecipient={meta?.needsRecipient ?? false}
        defaultRecipient={
          meta?.value === "demand_letter" || meta?.value === "notice_of_appraisal"
            ? "(carrier email)"
            : customer?.email ?? ""
        }
        signingUrl={signingUrl}
        signedByName={doc.signed_by_name ?? null}
        signedAt={doc.signed_at ?? null}
        signatureIp={doc.signature_ip ?? null}
        signatureUserAgent={doc.signature_user_agent ?? null}
        lastSendAttempt={(doc as any).last_send_attempt ?? null}
        canManualSend={
          (meta?.needsSignature ?? false) &&
          (doc.status === "approved" || doc.status === "sent")
        }
      />
    </div>
  );
}
