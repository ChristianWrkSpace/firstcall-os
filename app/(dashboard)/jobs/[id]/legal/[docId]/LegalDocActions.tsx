"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveLegalDoc,
  deleteLegalDoc,
  manualSendLegalDocToCustomer,
  markLegalDocSent,
  markLegalDocSigned,
  updateLegalDoc,
} from "@/app/actions/esquire";
import type { LegalDocStatus } from "@/lib/esquire-types";

interface SendAttempt {
  attempted_at: string;
  status: "sent" | "skipped" | "failed";
  reason?: string;
  recipient?: string;
}

export default function LegalDocActions({
  docId,
  jobId,
  status,
  subject,
  body,
  needsSignature,
  needsRecipient,
  defaultRecipient,
  signingUrl,
  signedByName,
  signedAt,
  signatureIp,
  signatureUserAgent,
  lastSendAttempt,
  canManualSend,
}: {
  docId: string;
  jobId: string;
  status: LegalDocStatus;
  subject: string;
  body: string;
  needsSignature: boolean;
  needsRecipient: boolean;
  defaultRecipient: string;
  signingUrl?: string | null;
  signedByName?: string | null;
  signedAt?: string | null;
  signatureIp?: string | null;
  signatureUserAgent?: string | null;
  lastSendAttempt?: SendAttempt | null;
  canManualSend?: boolean;
}) {
  const router = useRouter();
  const [copiedSign, setCopiedSign] = useState(false);
  function copySignUrl() {
    if (!signingUrl) return;
    navigator.clipboard.writeText(signingUrl).then(() => {
      setCopiedSign(true);
      setTimeout(() => setCopiedSign(false), 2000);
    });
  }
  const [editing, setEditing] = useState(false);
  const [saveState, saveAction, savePending] = useActionState(
    updateLegalDoc,
    undefined
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [recipient, setRecipient] = useState(defaultRecipient);
  const [signerName, setSignerName] = useState("");

  useEffect(() => {
    if (saveState?.ok) setEditing(false);
  }, [saveState]);

  const editable = status === "draft";
  const canApprove = status === "draft";
  const canMarkSent = status === "approved";
  const canMarkSigned =
    needsSignature && (status === "approved" || status === "sent");
  const canDelete = status !== "signed" && status !== "sent";

  function handleApprove() {
    const homeownerFacing =
      needsSignature && (status === "draft");
    const msg = homeownerFacing
      ? "Approve this document? It will be auto-emailed to the customer for signature, and can no longer be edited."
      : "Approve this document? It can no longer be edited after approval.";
    if (!confirm(msg)) return;
    setError(null);
    startTransition(async () => {
      const res = await approveLegalDoc(docId);
      if (res.error) setError(res.error);
    });
  }

  function handleMarkSent() {
    if (!recipient.trim()) {
      setError("Enter a recipient first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await markLegalDocSent(docId, recipient.trim());
      if (res.error) setError(res.error);
    });
  }

  function handleMarkSigned() {
    if (!signerName.trim()) {
      setError("Enter the signer's name.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await markLegalDocSigned(docId, signerName.trim());
      if (res.error) setError(res.error);
    });
  }

  function handleDelete() {
    if (!confirm("Delete this draft? This cannot be undone.")) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteLegalDoc(docId);
      if (res.error) {
        setError(res.error);
      } else {
        router.push(`/jobs/${jobId}`);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Action bar — hidden on print */}
      <div className="no-print flex flex-wrap gap-2">
        {editable && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 bg-shade hover:bg-shade text-ink text-sm rounded-lg"
          >
            ✏️ Edit
          </button>
        )}
        {canApprove && (
          <button
            onClick={handleApprove}
            disabled={pending}
            className="px-3 py-1.5 bg-cta hover:bg-cta-deep disabled:opacity-50 text-white text-sm font-medium rounded-lg"
          >
            ✓ Approve Draft
          </button>
        )}
        <button
          onClick={() => window.print()}
          className="px-3 py-1.5 bg-shade hover:bg-shade text-ink text-sm rounded-lg"
          title="Use 'Save as PDF' as the destination in the print dialog"
        >
          📥 Download PDF
        </button>
        {canDelete && (
          <button
            onClick={handleDelete}
            disabled={pending}
            className="ml-auto px-3 py-1.5 text-red-700 hover:text-red-700 text-sm rounded-lg"
          >
            Delete draft
          </button>
        )}
        {!canDelete && (
          <span className="ml-auto px-3 py-1.5 text-ink-3 text-xs">
            🔒 Permanent record — cannot be deleted
          </span>
        )}
      </div>

      {error && (
        <p className="no-print text-red-700 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Editor or rendered doc */}
      {editing ? (
        <form action={saveAction} className="flex flex-col gap-3 no-print">
          <input type="hidden" name="doc_id" value={docId} />
          <div className="flex flex-col gap-1.5">
            <label className="text-ink-2 text-xs">Subject</label>
            <input
              name="subject"
              defaultValue={subject}
              className="px-3 py-2 rounded-lg bg-shade border border-edge2 text-ink text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-ink-2 text-xs">Body</label>
            <textarea
              name="body"
              defaultValue={body}
              rows={28}
              className="px-3 py-2 rounded-lg bg-shade border border-edge2 text-ink text-sm font-mono whitespace-pre-wrap leading-relaxed"
            />
          </div>
          {saveState?.error && (
            <p className="text-red-700 text-sm">{saveState.error}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={savePending}
              className="px-4 py-2 bg-cta hover:bg-cta-deep disabled:opacity-50 text-white text-sm font-medium rounded-lg"
            >
              {savePending ? "Saving…" : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-4 py-2 border border-edge2 text-ink-2 hover:bg-shade text-sm rounded-lg"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          {/* Delivery diagnostic — show what the last send attempt did */}
          {lastSendAttempt && (
            <DeliveryStatus attempt={lastSendAttempt} />
          )}

          {/* Manual "Send Now" override */}
          {canManualSend && (
            <ManualSendButton docId={docId} canForce={true} />
          )}

          {/* Signing link card — visible only when there's an active sign URL and not yet signed */}
          {signingUrl && status !== "signed" && (
            <div className="no-print bg-card border border-info/30 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <p className="text-ink-2 text-xs font-semibold">
                  ✍️ Customer signing link
                </p>
                <p className="text-ink-3 text-[11px] mt-0.5">
                  Customer received this in their email. You can re-share it
                  manually if needed.
                </p>
                <p className="text-info text-xs font-mono break-all mt-2">
                  {signingUrl}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={copySignUrl}
                  className="px-3 py-1.5 bg-cta hover:bg-cta-deep text-white text-xs font-medium rounded-lg"
                >
                  {copiedSign ? "✓ Copied" : "📋 Copy link"}
                </button>
                <a
                  href={signingUrl}
                  target="_blank"
                  rel="noopener"
                  className="px-3 py-1.5 bg-shade hover:bg-shade text-ink-2 text-xs rounded-lg"
                >
                  Preview
                </a>
              </div>
            </div>
          )}

          <article className="bg-white text-black rounded-lg p-8 md:p-12 print:p-0 print:rounded-none print:bg-white">
            <header className="border-b-2 border-black pb-4 mb-6 flex items-end justify-between gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-banner.svg"
                alt="First Call Mitigation"
                style={{ height: 48, width: "auto" }}
              />
              <div className="text-right text-[10px] text-ink-3 leading-snug uppercase tracking-wider">
                <p>Austin, Texas</p>
                <p>IICRC Certified</p>
                <p>24/7 Emergency Response</p>
              </div>
            </header>
            <pre className="whitespace-pre-wrap font-serif text-[15px] leading-relaxed">
{body}
            </pre>
            {status === "signed" && signedByName && (
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
                  {signedByName}
                </p>
                <p className="text-ink-3 text-xs mt-2">
                  Signed {signedAt ? new Date(signedAt).toLocaleString() : "—"}
                </p>
                <div className="mt-3 text-[10px] text-ink-3 leading-relaxed">
                  <p>
                    <strong>Audit trail:</strong> IP {signatureIp ?? "—"} ·
                    Browser {(signatureUserAgent ?? "—").slice(0, 80)}
                  </p>
                  <p className="mt-1">
                    Signed via in-app e-signature — ESIGN Act / Texas UETA
                    compliant.
                  </p>
                </div>
              </div>
            )}
          </article>
        </>
      )}

      {/* Sent / signed forms */}
      {!editing && (canMarkSent || canMarkSigned) && (
        <div className="no-print flex flex-col gap-3 mt-2 glass-card p-5">
          {canMarkSent && (
            <div className="flex flex-col gap-2">
              <label className="text-ink-2 text-sm font-medium">
                Mark sent
              </label>
              <p className="text-ink-3 text-xs">
                {needsRecipient
                  ? "Enter the carrier email or contact this was sent to."
                  : "Enter the recipient (homeowner email or 'in person')."}
              </p>
              <div className="flex gap-2">
                <input
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="recipient@example.com"
                  className="flex-1 px-3 py-2 rounded-lg bg-shade border border-edge2 text-ink text-sm"
                />
                <button
                  onClick={handleMarkSent}
                  disabled={pending}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-ink text-sm font-medium rounded-lg"
                >
                  Mark Sent
                </button>
              </div>
            </div>
          )}
          {canMarkSigned && (
            <div className="flex flex-col gap-2">
              <label className="text-ink-2 text-sm font-medium">
                Mark signed
              </label>
              <p className="text-ink-3 text-xs">
                Enter the name of the person who signed (homeowner or technician).
              </p>
              <div className="flex gap-2">
                <input
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Jane Smith"
                  className="flex-1 px-3 py-2 rounded-lg bg-shade border border-edge2 text-ink text-sm"
                />
                <button
                  onClick={handleMarkSigned}
                  disabled={pending}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
                >
                  Mark Signed
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DeliveryStatus({ attempt }: { attempt: SendAttempt }) {
  const colorByStatus = {
    sent: "bg-pine/10 border-green-500/30 text-pine",
    skipped: "bg-honey/10 border-amber-500/30 text-honey",
    failed: "bg-red-600/10 border-red-500/30 text-red-700",
  };
  const iconByStatus = {
    sent: "✅",
    skipped: "⏭️",
    failed: "❌",
  };
  const labelByStatus = {
    sent: "Email delivered",
    skipped: "Send skipped",
    failed: "Send failed",
  };
  return (
    <div
      className={`no-print rounded-xl p-4 border ${colorByStatus[attempt.status]}`}
    >
      <p className="text-xs font-semibold flex items-center gap-2">
        <span>{iconByStatus[attempt.status]}</span>
        <span>{labelByStatus[attempt.status]}</span>
        <span className="text-ink-3 font-normal">
          · {new Date(attempt.attempted_at).toLocaleString()}
        </span>
      </p>
      {attempt.recipient && (
        <p className="text-ink-2 text-xs mt-2 font-mono">
          → {attempt.recipient}
        </p>
      )}
      {attempt.reason && (
        <p className="text-ink-2 text-xs mt-2 leading-snug">
          {attempt.reason}
        </p>
      )}
    </div>
  );
}

function ManualSendButton({
  docId,
  canForce,
}: {
  docId: string;
  canForce: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  function go() {
    if (
      !confirm(
        "Send this document to the customer now? Bypasses any auto-pause / opt-out flags."
      )
    )
      return;
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await manualSendLegalDocToCustomer(docId);
      if (!("ok" in res)) {
        setError(res.error);
        return;
      }
      const a = res.attempt as SendAttempt | null;
      if (!a) {
        setResult("Sent");
      } else if (a.status === "sent") {
        setResult(`✓ Delivered to ${a.recipient ?? "customer"}`);
      } else if (a.status === "skipped") {
        setResult(`Skipped: ${a.reason ?? "no reason given"}`);
      } else {
        setResult(`Failed: ${a.reason ?? "unknown error"}`);
      }
      // Refresh the RSC payload immediately; avoid a full browser reload and
      // the previous artificial 1.5-second delay.
      router.refresh();
    });
  }

  return (
    <div className="no-print flex flex-col gap-2 glass-card p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-ink-2 text-sm font-medium">
            Resend to customer
          </p>
          <p className="text-ink-3 text-xs mt-0.5">
            Push the email through right now. Bypasses auto-pause + opt-out
            flags. Use this if the auto-send was skipped or you want the
            customer to get the email again.
          </p>
        </div>
        <button
          onClick={go}
          disabled={pending}
          className="px-3 py-2 bg-cta hover:bg-cta-deep disabled:opacity-50 text-white text-xs font-medium rounded-lg whitespace-nowrap"
        >
          {pending ? "Sending…" : "📨 Send Now"}
        </button>
      </div>
      {error && <p className="text-red-700 text-xs">{error}</p>}
      {result && <p className="text-ink-2 text-xs">{result}</p>}
    </div>
  );
}
