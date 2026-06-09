import { createAdminClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import { LEGAL_DOC_BY_VALUE, type LegalDocType } from "@/lib/esquire-types";
import SignForm from "./SignForm";

export default async function SignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: doc } = await admin
    .from("legal_documents")
    .select(
      "id, doc_type, subject, body, status, signed_at, signed_by_name, job_id, signing_token"
    )
    .eq("signing_token", token)
    .single();

  if (!doc) notFound();

  const { data: job } = await admin
    .from("jobs")
    .select("job_number, site_address, customers(name)")
    .eq("id", doc.job_id)
    .single();

  const customer = (job as any)?.customers ?? {};
  const meta = LEGAL_DOC_BY_VALUE[doc.doc_type as LegalDocType];

  // Already-signed view
  const alreadySigned = doc.status === "signed";

  return (
    <div className="min-h-screen bg-card">
      {/* Header */}
      <header
        className="bg-card border-b-2 border-blue-600 px-6 pb-5"
        style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top))" }}
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <img
              src="/logo-banner.svg"
              alt="First Call Mitigation"
              style={{ height: 36, width: "auto" }}
            />
            <p className="text-ink-3 text-xs uppercase tracking-wider">
              Document signing
            </p>
          </div>
          <div className="text-right">
            <p className="text-ink-3 text-xs uppercase tracking-wide">Job</p>
            <p className="text-ink font-mono text-sm">
              {job?.job_number ?? ""}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-8 py-8">
        <h1 className="text-2xl font-bold text-ink">
          {meta?.label ?? doc.doc_type}
        </h1>
        <p className="text-ink-2 text-sm mt-1">
          For {customer.name ?? "the homeowner"} at{" "}
          {job?.site_address ?? "the loss site"}
        </p>

        {alreadySigned ? (
          <div className="bg-pine/10 border border-green-500/30 rounded-xl p-6 mt-6">
            <p className="text-pine font-semibold text-lg">
              ✓ Already signed
            </p>
            <p className="text-ink-2 text-sm mt-2">
              This document was signed by{" "}
              <strong>{doc.signed_by_name ?? "—"}</strong> on{" "}
              {doc.signed_at
                ? new Date(doc.signed_at).toLocaleString()
                : "—"}
              . No further action needed.
            </p>
          </div>
        ) : (
          <SignForm
            token={token}
            customerName={customer.name ?? ""}
            docTypeLabel={meta?.short ?? doc.doc_type}
          />
        )}

        {/* Document body */}
        <article className="bg-white text-black rounded-lg p-6 md:p-10 mt-6 print:p-0 print:rounded-none">
          <header className="border-b-2 border-black pb-4 mb-6 flex items-end justify-between gap-4">
            <img
              src="/logo-banner.svg"
              alt="First Call Mitigation"
              style={{ height: 44, width: "auto" }}
            />
            <div className="text-right text-[10px] text-ink-3 leading-snug uppercase tracking-wider">
              <p>Austin, Texas</p>
              <p>IICRC Certified</p>
              <p>24/7 Emergency Response</p>
            </div>
          </header>
          <pre className="whitespace-pre-wrap font-serif text-[14px] leading-relaxed">
{doc.body}
          </pre>
          {alreadySigned && (
            <div className="mt-8 pt-6 border-t-2 border-black">
              <p className="text-xs uppercase tracking-wider text-ink-3">
                Electronic Signature
              </p>
              <p
                className="text-zinc-900 text-3xl mt-2"
                style={{
                  fontFamily:
                    '"Brush Script MT", "Lucida Handwriting", cursive',
                }}
              >
                {doc.signed_by_name ?? ""}
              </p>
              <p className="text-ink-3 text-xs mt-2">
                Signed{" "}
                {doc.signed_at
                  ? new Date(doc.signed_at).toLocaleString()
                  : "—"}{" "}
                · ESIGN Act / Tex. UETA compliant
              </p>
            </div>
          )}
        </article>

        {/* Trust footer */}
        <footer className="mt-8 text-center text-ink-3 text-xs">
          First Call Mitigation · Austin, TX · IICRC Certified
          <br />
          Your signature is legally binding under the federal ESIGN Act and
          Texas UETA. Audit trail (timestamp, IP, browser) is recorded.
        </footer>
      </main>
    </div>
  );
}
