import { createServerSupabaseClient } from "@/lib/supabase-server";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  draft:   "bg-zinc-700 text-zinc-300",
  sent:    "bg-blue-500/15 text-blue-400",
  partial: "bg-yellow-500/15 text-yellow-400",
  paid:    "bg-green-500/15 text-green-400",
  overdue: "bg-red-500/15 text-red-400",
  void:    "bg-zinc-800 text-zinc-500",
};

const fmt = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function ARDashboard() {
  const supabase = await createServerSupabaseClient();

  const { data: invoices } = await supabase
    .from("invoices")
    .select(
      "*, line_items:invoice_line_items(line_total), payments(amount), jobs(job_number, customers(name, insurance_company))"
    )
    .not("status", "in", "(void,paid)")
    .order("sent_at", { ascending: true, nullsFirst: false });

  const enriched = (invoices ?? []).map((inv: any) => {
    const total = (inv.line_items ?? []).reduce(
      (s: number, li: any) => s + Number(li.line_total ?? 0),
      0
    );
    const paid = (inv.payments ?? []).reduce(
      (s: number, p: any) => s + Number(p.amount),
      0
    );
    const balance = total - paid;
    const sentMs = inv.sent_at ? new Date(inv.sent_at).getTime() : null;
    const daysOut = sentMs
      ? Math.floor((Date.now() - sentMs) / (1000 * 60 * 60 * 24))
      : 0;
    return { ...inv, total, paid, balance, daysOut };
  });

  // Aging buckets (only count invoices that have been sent)
  const buckets = {
    current: { label: "Current (0-30)", amount: 0, count: 0, color: "text-green-400" },
    bucket31: { label: "31-60 days", amount: 0, count: 0, color: "text-yellow-400" },
    bucket61: { label: "61-90 days", amount: 0, count: 0, color: "text-orange-400" },
    bucket90: { label: "90+ days", amount: 0, count: 0, color: "text-red-400" },
  };
  for (const inv of enriched) {
    if (inv.balance <= 0 || !inv.sent_at) continue;
    const target =
      inv.daysOut <= 30
        ? buckets.current
        : inv.daysOut <= 60
          ? buckets.bucket31
          : inv.daysOut <= 90
            ? buckets.bucket61
            : buckets.bucket90;
    target.amount += inv.balance;
    target.count += 1;
  }

  const totalAR = enriched
    .filter((i) => i.sent_at)
    .reduce((s, i) => s + i.balance, 0);
  const drafts = enriched.filter((i) => !i.sent_at);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Accounts Receivable</h1>
        <p className="text-zinc-400 text-sm mt-0.5">
          Open invoices, aging snapshot, total at risk.
        </p>
      </div>

      {/* AR Aging buckets */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-zinc-500 text-xs uppercase tracking-wide">Total Open AR</p>
          <p className="text-3xl font-bold text-white font-mono mt-1">{fmt(totalAR)}</p>
          <p className="text-zinc-500 text-xs mt-1">
            across {enriched.filter((i) => i.sent_at).length} sent invoices
          </p>
        </div>
        {Object.values(buckets).map((b) => (
          <div key={b.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-500 text-xs uppercase tracking-wide">{b.label}</p>
            <p className={`text-2xl font-bold font-mono mt-1 ${b.color}`}>
              {fmt(b.amount)}
            </p>
            <p className="text-zinc-500 text-xs mt-1">
              {b.count} {b.count === 1 ? "invoice" : "invoices"}
            </p>
          </div>
        ))}
      </div>

      {/* Drafts callout */}
      {drafts.length > 0 && (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 mb-6">
          <p className="text-blue-300 text-sm font-semibold mb-2">
            📝 {drafts.length} unsent draft{drafts.length === 1 ? "" : "s"}{" "}
            <span className="text-zinc-500 font-normal">
              ({fmt(drafts.reduce((s, d) => s + d.total, 0))} not yet billed)
            </span>
          </p>
          <ul className="text-xs space-y-1">
            {drafts.slice(0, 5).map((inv: any) => (
              <li key={inv.id} className="flex items-center justify-between">
                <Link
                  href={`/jobs/${inv.job_id}/invoices/${inv.id}`}
                  className="text-blue-400 hover:underline font-mono"
                >
                  {inv.invoice_number}
                </Link>
                <span className="text-zinc-400">{inv.jobs?.customers?.name ?? "—"}</span>
                <span className="text-zinc-300 font-mono">{fmt(inv.total)}</span>
              </li>
            ))}
            {drafts.length > 5 && (
              <li className="text-zinc-500 italic">+ {drafts.length - 5} more drafts</li>
            )}
          </ul>
        </div>
      )}

      {/* Open invoice table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-800">
          <h2 className="text-white font-semibold">Open Invoices</h2>
        </div>
        {enriched.filter((i) => i.sent_at).length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-zinc-400 text-sm">🎉 No open invoices.</p>
            <p className="text-zinc-500 text-xs mt-1">
              All sent invoices have been paid in full.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wide">
                <th className="px-5 py-3 text-left">Invoice #</th>
                <th className="px-5 py-3 text-left">Customer</th>
                <th className="px-5 py-3 text-left">Carrier</th>
                <th className="px-5 py-3 text-left">Sent</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-right">Days Out</th>
                <th className="px-5 py-3 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {enriched
                .filter((i) => i.sent_at)
                .map((inv: any) => (
                  <tr
                    key={inv.id}
                    className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/jobs/${inv.job_id}/invoices/${inv.id}`}
                        className="text-blue-400 hover:underline font-mono text-xs"
                      >
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-zinc-200">
                      {inv.jobs?.customers?.name ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-zinc-400 text-xs">
                      {inv.jobs?.customers?.insurance_company ?? "Self-pay"}
                    </td>
                    <td className="px-5 py-3 text-zinc-400 text-xs">
                      {new Date(inv.sent_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[inv.status] ?? ""}`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td
                      className={`px-5 py-3 text-right font-mono text-xs ${inv.daysOut > 60 ? "text-red-400" : inv.daysOut > 30 ? "text-yellow-400" : "text-zinc-400"}`}
                    >
                      {inv.daysOut}d
                    </td>
                    <td className="px-5 py-3 text-right text-white font-mono font-semibold">
                      {fmt(inv.balance)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
