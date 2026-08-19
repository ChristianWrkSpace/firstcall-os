"use client";

import { useActionState, useTransition } from "react";
import Link from "next/link";
import { logSubInvoice, markSubInvoicePaid } from "@/app/actions/subs";

const INPUT =
  "px-2.5 py-2 rounded-lg bg-shade border border-edge2 text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-cta text-sm min-h-[40px]";

const fmt = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface SubInvoiceRow {
  id: string;
  invoice_number: string | null;
  invoice_date: string;
  amount: number;
  paid_at: string | null;
  description: string | null;
  subcontractors: { name: string } | null;
}

export default function SubInvoices({
  jobId,
  subs,
  invoices,
}: {
  jobId: string;
  subs: Array<{ id: string; name: string; trade: string | null }>;
  invoices: SubInvoiceRow[];
}) {
  const [state, action, pending] = useActionState(logSubInvoice, undefined);
  const [marking, startMark] = useTransition();

  return (
    <div>
      {subs.length === 0 ? (
        <p className="text-sm italic text-ink-3">
          No subcontractors on file yet — add one under{" "}
          <Link href="/subs" className="text-info hover:underline not-italic">
            Subcontractors
          </Link>
          , then log their invoices here.
        </p>
      ) : (
        <form action={action} className="flex flex-wrap gap-1.5 mb-3 items-end">
          <input type="hidden" name="job_id" value={jobId} />
          <div className="flex flex-col gap-1">
            <label className="text-ink-3 text-[10px] uppercase tracking-wide">Sub</label>
            <select name="subcontractor_id" required className={INPUT}>
              {subs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.trade ? ` — ${s.trade}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-ink-3 text-[10px] uppercase tracking-wide">Amount</label>
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="1250.00"
              className={`${INPUT} w-28 font-mono`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-ink-3 text-[10px] uppercase tracking-wide">Date</label>
            <input
              name="invoice_date"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className={INPUT}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-ink-3 text-[10px] uppercase tracking-wide">Invoice #</label>
            <input name="invoice_number" placeholder="optional" className={`${INPUT} w-24`} />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
            <label className="text-ink-3 text-[10px] uppercase tracking-wide">Work done</label>
            <input name="description" placeholder="Drywall hang + finish, master bath" className={INPUT} />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="px-4 py-2 bg-cta hover:bg-cta-deep disabled:opacity-50 text-white text-sm font-medium rounded-lg min-h-[40px]"
          >
            {pending ? "Logging…" : "+ Log"}
          </button>
        </form>
      )}
      {state?.error && <p className="text-red-700 text-xs mb-2">{state.error}</p>}
      {state?.ok && <p className="text-pine text-xs mb-2">✓ Logged — P&L updated.</p>}

      {invoices.length > 0 && (
        <div className="flex flex-col divide-y divide-edge2 border-t border-edge2">
          {invoices.map((inv) => (
            <div key={inv.id} className="flex items-center gap-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="text-ink">
                  {inv.subcontractors?.name ?? "—"}
                  {inv.invoice_number && (
                    <span className="text-ink-3 font-mono text-xs ml-2">#{inv.invoice_number}</span>
                  )}
                </p>
                <p className="text-ink-3 text-xs truncate">
                  {inv.invoice_date}
                  {inv.description ? ` · ${inv.description}` : ""}
                </p>
              </div>
              <span className="font-mono text-ink shrink-0">{fmt(Number(inv.amount))}</span>
              {inv.paid_at ? (
                <span className="text-pine text-xs shrink-0">✓ paid</span>
              ) : (
                <button
                  disabled={marking}
                  onClick={() => startMark(async () => { await markSubInvoicePaid(inv.id); })}
                  className="text-xs px-2.5 py-1 rounded-lg bg-shade hover:bg-edge2 text-ink-2 disabled:opacity-50 shrink-0"
                >
                  Mark paid
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
