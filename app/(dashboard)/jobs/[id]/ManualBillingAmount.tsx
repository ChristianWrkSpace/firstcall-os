"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updateManualJobAmount } from "@/app/actions/jobs";
import CreateManualInvoiceButton from "./CreateManualInvoiceButton";

export default function ManualBillingAmount({
  jobId,
  initialAmount,
  existingDraftInvoiceId,
}: {
  jobId: string;
  initialAmount: number | null;
  existingDraftInvoiceId: string | null;
}) {
  const [state, action, pending] = useActionState(updateManualJobAmount, undefined);
  const formatted =
    initialAmount == null
      ? "Not entered"
      : `$${Number(initialAmount).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;

  return (
    <div id="billing-amount" className="scroll-mt-24 rounded-xl border border-edge2 bg-tint p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-ink">Manual Billing Amount</p>
          <p className="mt-1 text-xs text-ink-3">
            Enter the amount you plan to bill and save it. No estimate is required.
          </p>
        </div>
        <p className="font-mono text-xl font-bold text-ink">{formatted}</p>
      </div>

      <form action={action} className="mt-4 flex items-end gap-2 flex-wrap">
        <input type="hidden" name="job_id" value={jobId} />
        <label className="flex-1 min-w-48">
          <span className="block text-[10px] uppercase tracking-wide text-ink-3 mb-1">
            Amount to bill
          </span>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3">$</span>
            <input
              name="billing_amount"
              type="number"
              inputMode="decimal"
              min="0"
              max="99999999.99"
              step="0.01"
              defaultValue={initialAmount ?? ""}
              placeholder="1200.00"
              className="w-full rounded-lg border border-edge2 bg-card py-2 pl-7 pr-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-cta"
            />
          </div>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-cta px-4 py-2 text-sm font-semibold text-white hover:bg-cta-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save amount"}
        </button>
      </form>

      {state && "error" in state && <p className="mt-2 text-xs text-red-700">{state.error}</p>}
      {state && "ok" in state && state.ok && (
        <p className="mt-2 text-xs text-pine">Billing amount saved.</p>
      )}
      <div className="mt-4 border-t border-edge2 pt-4">
        {existingDraftInvoiceId ? (
          <>
            <Link
              href={`/jobs/${jobId}/invoices/${existingDraftInvoiceId}`}
              className="inline-flex rounded-lg border border-cta px-4 py-2 text-sm font-semibold text-cta hover:bg-cta/10"
            >
              Open draft invoice
            </Link>
            <p className="mt-2 text-[11px] text-ink-3">
              A manual draft already exists. Open it to review or edit its line items.
            </p>
          </>
        ) : initialAmount != null && initialAmount > 0 ? (
          <>
            <CreateManualInvoiceButton jobId={jobId} />
            <p className="mt-2 text-[11px] text-ink-3">
              Creates an editable draft invoice for {formatted}. Nothing is sent automatically.
            </p>
          </>
        ) : (
          <p className="text-[11px] text-ink-3">
            Save an amount greater than zero to create an invoice.
          </p>
        )}
      </div>
      <p className="mt-2 text-[11px] text-ink-3">Leave it blank and save to clear the amount.</p>
    </div>
  );
}
