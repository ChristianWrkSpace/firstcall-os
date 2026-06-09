"use client";

import { useState, useTransition } from "react";
import { recordPayment, deletePayment } from "@/app/actions/invoices";

interface Payment {
  id: string;
  amount: number;
  method: string | null;
  reference: string | null;
  received_at: string;
  notes: string | null;
  recorder?: { name: string } | null;
}

const INPUT =
  "w-full px-3 py-2 rounded-lg bg-shade border border-edge2 text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-cta text-sm";

export default function PaymentsPanel({
  invoiceId,
  jobId,
  payments,
  balance,
  invoiceLocked,
}: {
  invoiceId: string;
  jobId: string;
  payments: Payment[];
  balance: number;
  invoiceLocked: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await recordPayment(invoiceId, jobId, formData);
      if (res.error) setError(res.error);
      else setAdding(false);
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this payment? Invoice status will recompute.")) return;
    startTransition(async () => {
      await deletePayment(id, invoiceId, jobId);
    });
  }

  return (
    <section className="glass-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-ink font-semibold">Payments</h2>
        {!invoiceLocked && balance > 0 && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-info hover:text-info-deep text-xs font-medium"
          >
            + Record Payment
          </button>
        )}
      </div>

      {adding && (
        <form
          action={handleSubmit}
          className="mb-4 bg-shade border border-edge2 rounded-lg p-3 grid grid-cols-2 gap-3"
        >
          <div className="flex flex-col gap-1">
            <label className="text-ink-2 text-xs uppercase tracking-wide">Amount *</label>
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={balance.toFixed(2)}
              className={INPUT}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-ink-2 text-xs uppercase tracking-wide">Method</label>
            <select name="method" className={INPUT}>
              <option value="check">Check</option>
              <option value="ach">ACH / Wire</option>
              <option value="wire">Wire</option>
              <option value="credit_card">Credit Card</option>
              <option value="cash">Cash</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-ink-2 text-xs uppercase tracking-wide">Reference / Check #</label>
            <input name="reference" className={INPUT} placeholder="e.g. 4598" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-ink-2 text-xs uppercase tracking-wide">Received Date</label>
            <input name="received_at" type="date" className={INPUT} />
          </div>
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-ink-2 text-xs uppercase tracking-wide">Notes</label>
            <input name="notes" className={INPUT} placeholder="optional" />
          </div>
          {error && <p className="col-span-2 text-red-700 text-xs">{error}</p>}
          <div className="col-span-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="px-3 py-1.5 text-ink-2 hover:text-ink text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="px-4 py-1.5 bg-cta hover:bg-cta-deep disabled:opacity-50 text-white text-sm font-medium rounded-lg"
            >
              {pending ? "Saving…" : "Record Payment"}
            </button>
          </div>
        </form>
      )}

      {payments.length === 0 ? (
        <p className="text-ink-3 text-sm italic">No payments recorded.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-edge2 text-ink-3 text-xs uppercase tracking-wide">
              <th className="text-left py-2">Date</th>
              <th className="text-left py-2">Method</th>
              <th className="text-left py-2">Ref</th>
              <th className="text-right py-2">Amount</th>
              <th className="text-left py-2 pl-3">Recorded by</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-b border-edge2/40 last:border-0">
                <td className="py-2 text-ink-2 text-xs">
                  {new Date(p.received_at).toLocaleDateString()}
                </td>
                <td className="py-2 text-ink-2 text-xs capitalize">
                  {p.method?.replace("_", " ") ?? "—"}
                </td>
                <td className="py-2 text-ink-2 text-xs font-mono">
                  {p.reference ?? "—"}
                </td>
                <td className="py-2 text-right text-pine font-mono text-sm font-semibold">
                  ${Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="py-2 pl-3 text-ink-3 text-xs">
                  {p.recorder?.name ?? "—"}
                </td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => remove(p.id)}
                    disabled={pending}
                    className="text-red-700 hover:text-red-700 text-xs"
                  >
                    del
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
