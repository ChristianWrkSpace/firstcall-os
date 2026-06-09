import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getDataCutoff } from "@/lib/data-cutoff";
import Link from "next/link";
import { requireRoles } from "@/components/RoleGate";
import { PageShell, Glass, Band, GlassRow, EmptyState } from "@/components/ui/Glass";

// Invoice-status pills in the glass palette (job statuses live in GLASS_STATUS).
const INVOICE_STATUS_GLASS: Record<string, string> = {
  draft:   "bg-white/5 text-white/60 ring-white/10",
  sent:    "bg-[#6B8AD9]/10 text-[#A6B8E7] ring-[#6B8AD9]/20",
  partial: "bg-amber-400/10 text-amber-300 ring-amber-400/20",
  paid:    "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
  overdue: "bg-red-400/10 text-red-300 ring-red-400/20",
  void:    "bg-white/5 text-white/35 ring-white/10",
};

const fmt = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function ARDashboard() {
  await requireRoles(["owner", "manager", "office"]);
  const supabase = await createServerSupabaseClient();
  const cutoff = getDataCutoff();

  let invoicesQuery = supabase
    .from("invoices")
    .select(
      "*, line_items:invoice_line_items(line_total), payments(amount), jobs(job_number, customers(name, insurance_company))"
    )
    .not("status", "in", "(void,paid)")
    .order("sent_at", { ascending: true, nullsFirst: false });
  if (cutoff) invoicesQuery = invoicesQuery.gte("created_at", cutoff);
  const { data: invoices } = await invoicesQuery;

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
    current: { label: "Current · 0-30", amount: 0, count: 0, color: "text-emerald-300" },
    bucket31: { label: "31-60 days", amount: 0, count: 0, color: "text-amber-300" },
    bucket61: { label: "61-90 days", amount: 0, count: 0, color: "text-orange-300" },
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

  const sent = enriched.filter((i) => i.sent_at);
  const totalAR = sent.reduce((s, i) => s + i.balance, 0);
  const drafts = enriched.filter((i) => !i.sent_at);

  return (
    <PageShell
      eyebrow="Receivables"
      title="Accounts Receivable"
      subtitle="Open invoices, aging snapshot, total at risk."
      width="wide"
    >
      {/* Aging snapshot — total at risk lit, buckets in support */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Glass level="stage" accent="teal" className="p-4 col-span-2 md:col-span-1 animate-rise-in">
          <p className="text-[10px] uppercase tracking-[0.15em] text-white/45">Total Open AR</p>
          <p className="text-3xl font-bold text-[#A8DCD3] font-mono mt-1">{fmt(totalAR)}</p>
          <p className="text-white/40 text-xs mt-1">across {sent.length} sent invoices</p>
        </Glass>
        {Object.values(buckets).map((b) => (
          <div
            key={b.label}
            className="rounded-xl bg-white/[0.025] border border-white/[0.05] ring-1 ring-white/[0.04] p-4"
          >
            <p className="text-[10px] uppercase tracking-[0.15em] text-white/40">{b.label}</p>
            <p className={`text-2xl font-bold font-mono mt-1 ${b.color}`}>{fmt(b.amount)}</p>
            <p className="text-white/40 text-xs mt-1">
              {b.count} {b.count === 1 ? "invoice" : "invoices"}
            </p>
          </div>
        ))}
      </div>

      {/* Unsent drafts — not yet billed */}
      {drafts.length > 0 && (
        <Glass accent="blue" subtle className="p-4 mb-6">
          <p className="text-[#A6B8E7] text-sm font-semibold mb-2.5">
            📝 {drafts.length} unsent draft{drafts.length === 1 ? "" : "s"}{" "}
            <span className="text-white/40 font-normal">
              ({fmt(drafts.reduce((s, d) => s + d.total, 0))} not yet billed)
            </span>
          </p>
          <ul className="text-xs space-y-1.5">
            {drafts.slice(0, 5).map((inv: any) => (
              <li key={inv.id} className="flex items-center justify-between gap-3">
                <Link
                  href={`/jobs/${inv.job_id}/invoices/${inv.id}`}
                  className="text-[#A6B8E7] hover:text-white font-mono transition-colors"
                >
                  {inv.invoice_number}
                </Link>
                <span className="text-white/45 truncate flex-1 text-right">
                  {inv.jobs?.customers?.name ?? "—"}
                </span>
                <span className="text-white/80 font-mono shrink-0">{fmt(inv.total)}</span>
              </li>
            ))}
            {drafts.length > 5 && (
              <li className="text-white/35 italic">+ {drafts.length - 5} more drafts</li>
            )}
          </ul>
        </Glass>
      )}

      {/* Open invoices — flowing rows, not a spreadsheet */}
      <Band label="Open Invoices" hint={`${sent.length} sent · awaiting payment`}>
        {sent.length === 0 ? (
          <EmptyState icon="🎉" title="No open invoices.">
            All sent invoices have been paid in full.
          </EmptyState>
        ) : (
          sent.map((inv: any, i: number) => {
            const ageColor =
              inv.daysOut > 90
                ? "text-red-400"
                : inv.daysOut > 60
                  ? "text-orange-300"
                  : inv.daysOut > 30
                    ? "text-amber-300"
                    : "text-white/40";
            return (
              <GlassRow
                key={inv.id}
                href={`/jobs/${inv.job_id}/invoices/${inv.id}`}
                index={i}
                accent={inv.daysOut > 60 ? "amber" : "neutral"}
                meta={
                  <>
                    <span className="font-mono text-xs text-white/45">{inv.invoice_number}</span>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ring-1 ${INVOICE_STATUS_GLASS[inv.status] ?? INVOICE_STATUS_GLASS.draft}`}
                    >
                      {inv.status}
                    </span>
                  </>
                }
                title={inv.jobs?.customers?.name ?? "—"}
                sub={`${inv.jobs?.customers?.insurance_company ?? "Self-pay"} · sent ${new Date(inv.sent_at).toLocaleDateString()}`}
                trailing={
                  <>
                    <span className="text-white/95 font-mono font-semibold">{fmt(inv.balance)}</span>
                    <span className={`text-[11px] font-mono ${ageColor}`}>{inv.daysOut}d out</span>
                  </>
                }
              />
            );
          })
        )}
      </Band>
    </PageShell>
  );
}
