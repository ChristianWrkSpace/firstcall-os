"use client";

import { useState, useTransition } from "react";
import {
  sendInvoice,
  sendReminder,
  voidInvoice,
} from "@/app/actions/invoices";

export default function InvoiceActions({
  invoiceId,
  jobId,
  status,
  defaultRecipient,
  hasBeenSent,
}: {
  invoiceId: string;
  jobId: string;
  status: string;
  defaultRecipient: string;
  hasBeenSent: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showSend, setShowSend] = useState(false);
  const [recipient, setRecipient] = useState(defaultRecipient);

  function handleSend() {
    if (!recipient.trim()) return setError("Enter a recipient email.");
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const res = await sendInvoice(invoiceId, jobId, recipient.trim());
      if (res.error) setError(res.error);
      else {
        setShowSend(false);
        setInfo("Invoice sent ✓");
      }
    });
  }

  function handleReminder(type: "gentle" | "firm" | "final") {
    if (
      type === "final" &&
      !confirm(
        "Send FINAL NOTICE? This invokes Tex. Ins. Code § 542.058 prompt-pay language."
      )
    )
      return;
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const res = await sendReminder(invoiceId, jobId, type);
      if (res.error) setError(res.error);
      else setInfo(`${type.charAt(0).toUpperCase() + type.slice(1)} reminder sent ✓`);
    });
  }

  function handleVoid() {
    if (!confirm("Void this invoice? Cannot be undone.")) return;
    setError(null);
    startTransition(async () => {
      const res = await voidInvoice(invoiceId, jobId);
      if (res.error) setError(res.error);
    });
  }

  const isOpen = status === "draft" || status === "sent" || status === "partial" || status === "overdue";

  return (
    <div className="flex flex-col gap-2">
      <a
        href={`/jobs/${jobId}/invoices/${invoiceId}/print`}
        target="_blank"
        rel="noopener"
        className="px-3 py-2 bg-cta hover:bg-cta-deep text-white text-sm font-medium rounded-lg transition-colors text-center"
      >
        View / Print Invoice
      </a>
      {status === "draft" && (
        <p className="text-ink-3 text-[11px] leading-snug">
          No email is needed to view, print, or save this invoice as a PDF.
        </p>
      )}

      {/* Send Invoice — draft only */}
      {status === "draft" && !showSend && (
        <button
          onClick={() => setShowSend(true)}
          disabled={pending}
          className="px-3 py-2 bg-cta hover:bg-cta-deep disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          ✉ Email Invoice
        </button>
      )}

      {showSend && (
        <div className="bg-shade border border-edge2 rounded-lg p-3 flex flex-col gap-2">
          <label className="text-ink-2 text-xs uppercase tracking-wide">
            Recipient email
          </label>
          <input
            type="email"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="adjuster@statefarm.com"
            className="px-3 py-2 rounded-lg bg-card border border-edge2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-cta"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowSend(false)}
              className="px-3 py-1.5 text-ink-2 hover:text-ink text-xs"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={pending}
              className="px-3 py-1.5 bg-cta hover:bg-cta-deep disabled:opacity-50 text-white text-xs font-medium rounded-lg"
            >
              {pending ? "Sending…" : "Send via Resend"}
            </button>
          </div>
        </div>
      )}

      {/* Reminders — sent/partial/overdue */}
      {hasBeenSent && status !== "paid" && status !== "void" && (
        <>
          <div className="border-t border-edge2 pt-2 mt-1">
            <p className="text-ink-3 text-[10px] uppercase tracking-wide mb-1.5">
              Send Reminder
            </p>
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => handleReminder("gentle")}
                disabled={pending}
                className="px-3 py-1.5 bg-shade hover:bg-shade disabled:opacity-50 text-ink text-xs rounded-lg text-left"
              >
                😊 Gentle nudge
              </button>
              <button
                onClick={() => handleReminder("firm")}
                disabled={pending}
                className="px-3 py-1.5 bg-honey/10 hover:bg-honey/10 disabled:opacity-50 text-honey text-xs rounded-lg text-left"
              >
                ⚠️ Firm follow-up
              </button>
              <button
                onClick={() => handleReminder("final")}
                disabled={pending}
                className="px-3 py-1.5 bg-red-600/10 hover:bg-red-600/10 disabled:opacity-50 text-red-700 text-xs rounded-lg text-left"
              >
                🚨 Final notice (cites Tex. Ins. Code)
              </button>
            </div>
          </div>
        </>
      )}


      {/* Void */}
      {isOpen && (
        <button
          onClick={handleVoid}
          disabled={pending}
          className="px-3 py-2 bg-shade hover:bg-red-600/20 text-red-700 text-sm rounded-lg transition-colors mt-2"
        >
          Void Invoice
        </button>
      )}

      {error && <p className="text-red-700 text-xs mt-2">{error}</p>}
      {info && <p className="text-pine text-xs mt-2">{info}</p>}
    </div>
  );
}
