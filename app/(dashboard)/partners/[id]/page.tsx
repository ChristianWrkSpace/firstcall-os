import { createServerSupabaseClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PARTNER_TYPE_LABEL, canLogInvestmentFor, type PartnerType } from "@/lib/partner-types";
import { PayoutForm, InvestmentForm, DeleteEntryButton } from "./LedgerForms";
import { requireRoles } from "@/components/RoleGate";

const fmt = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const fmt2 = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CATEGORY_LABEL: Record<string, string> = {
  gift: "Gift",
  meal: "Meal",
  event: "Event",
  marketing_coop: "Marketing Co-op",
  training: "Training",
  other: "Other",
};

export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRoles(["owner", "manager", "office"]);
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const [
    { data: partner },
    { data: referredJobs },
    { data: payouts },
    { data: investments },
  ] = await Promise.all([
    supabase.from("partners").select("*").eq("id", id).single(),
    supabase
      .from("jobs")
      .select(
        "id, job_number, status, type, created_at, site_address, site_city, customers(name), invoices(line_items:invoice_line_items(line_total), payments(amount))"
      )
      .eq("referred_by_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("partner_payouts")
      .select("id, occurred_on, amount, method, reference, notes, job_id")
      .eq("partner_id", id)
      .order("occurred_on", { ascending: false }),
    supabase
      .from("partner_investments")
      .select("id, occurred_on, amount, category, notes")
      .eq("partner_id", id)
      .order("occurred_on", { ascending: false }),
  ]);

  if (!partner) notFound();

  const totalReferrals = referredJobs?.length ?? 0;
  let totalRevenue = 0;
  for (const j of (referredJobs ?? []) as any[]) {
    for (const inv of j.invoices ?? []) {
      const lineTotal = (inv.line_items ?? []).reduce(
        (s: number, li: any) => s + Number(li.line_total ?? 0),
        0
      );
      totalRevenue += lineTotal;
    }
  }

  const totalCash = (payouts ?? []).reduce((s, p: any) => s + Number(p.amount), 0);
  const totalSoft = (investments ?? []).reduce((s, i: any) => s + Number(i.amount), 0);
  const totalInvested = totalCash + totalSoft;
  const roi = totalInvested > 0 ? totalRevenue / totalInvested : null;

  const ptype = (partner.partner_type ?? "other") as PartnerType;
  const canLog = canLogInvestmentFor(ptype);

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="mb-6">
        <Link
          href="/partners"
          className="text-zinc-500 hover:text-white text-sm transition-colors"
        >
          ← Partners
        </Link>
        <div className="flex items-baseline gap-3 mt-2 flex-wrap">
          <h1 className="text-2xl font-bold text-white">{partner.name}</h1>
          <span className="text-zinc-400 text-sm">
            {PARTNER_TYPE_LABEL[ptype] ?? "Other"}
          </span>
          {!partner.active && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-300 uppercase">
              Inactive
            </span>
          )}
        </div>
        {partner.company && (
          <p className="text-zinc-400 text-sm mt-1">{partner.company}</p>
        )}
        <div className="text-zinc-500 text-xs mt-1.5 flex gap-3 flex-wrap">
          {partner.phone && (
            <a href={`tel:${partner.phone}`} className="hover:text-white">
              {partner.phone}
            </a>
          )}
          {partner.email && (
            <a href={`mailto:${partner.email}`} className="hover:text-white">
              {partner.email}
            </a>
          )}
        </div>
      </div>

      {/* ROI tiles */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Tile label="Referrals" value={totalReferrals.toString()} accent="blue" />
        <Tile label="Revenue from referrals" value={fmt(totalRevenue)} accent="green" />
        <Tile
          label={canLog ? "Total Invested" : "Investment Disabled"}
          value={canLog ? fmt(totalInvested) : "—"}
          sub={canLog ? `${fmt(totalCash)} cash · ${fmt(totalSoft)} soft` : "Adjuster — TX § 4102.158"}
        />
        <Tile
          label="ROI"
          value={roi != null ? `${roi.toFixed(1)}×` : "—"}
          sub={roi != null ? "revenue ÷ invested" : "no investment yet"}
          accent={roi != null && roi >= 5 ? "green" : roi != null && roi < 1 ? "red" : "default"}
        />
      </section>

      {/* Insurance adjuster guard */}
      {!canLog && (
        <section className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-4 mb-5 text-sm">
          <p className="text-amber-200 font-medium">
            ⚠ Insurance Adjuster
          </p>
          <p className="text-zinc-300 mt-1">
            Texas Insurance Code § 4102.158 prohibits paying anything of value
            to a public adjuster for referring claims. Investment and payout
            logging is disabled for this partner type. You can still track
            referrals and revenue.
          </p>
        </section>
      )}

      {/* Referred jobs */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-5">
        <h2 className="text-white font-semibold mb-3">Referred Jobs</h2>
        {(referredJobs?.length ?? 0) === 0 ? (
          <p className="text-zinc-500 text-sm italic">
            No jobs attributed to this partner yet. When a job is created, set
            "Referred by" on the intake form to link it here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wide">
                  <th className="text-left py-2">Job #</th>
                  <th className="text-left py-2">Customer</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Created</th>
                  <th className="text-right py-2">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {(referredJobs as any[]).map((j) => {
                  const rev = (j.invoices ?? []).reduce(
                    (s: number, inv: any) =>
                      s +
                      (inv.line_items ?? []).reduce(
                        (li_s: number, li: any) => li_s + Number(li.line_total ?? 0),
                        0
                      ),
                    0
                  );
                  return (
                    <tr
                      key={j.id}
                      className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-800/40"
                    >
                      <td className="py-2.5">
                        <Link
                          href={`/jobs/${j.id}`}
                          className="text-blue-400 hover:underline font-mono text-xs"
                        >
                          {j.job_number}
                        </Link>
                      </td>
                      <td className="py-2.5 text-zinc-300 text-xs">
                        {j.customers?.name ?? "—"}
                      </td>
                      <td className="py-2.5 text-zinc-400 text-xs capitalize">
                        {j.status}
                      </td>
                      <td className="py-2.5 text-zinc-500 text-xs">
                        {new Date(j.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 text-right font-mono text-xs text-zinc-200">
                        {fmt2(rev)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Cash payouts (1099) */}
      {canLog && (
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-5">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <div>
              <h2 className="text-white font-semibold">Cash Payouts</h2>
              <p className="text-zinc-500 text-xs mt-0.5">
                1099-tracked. Owner / manager only.
              </p>
            </div>
            <PayoutForm partnerId={partner.id} />
          </div>
          {(payouts?.length ?? 0) === 0 ? (
            <p className="text-zinc-500 text-sm italic">No cash payouts logged.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wide">
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Method</th>
                  <th className="text-left py-2">Reference</th>
                  <th className="text-left py-2">Notes</th>
                  <th className="text-right py-2">Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(payouts as any[]).map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-zinc-800/60 last:border-0"
                  >
                    <td className="py-2.5 text-zinc-300 text-xs">{p.occurred_on}</td>
                    <td className="py-2.5 text-zinc-300 text-xs capitalize">{p.method}</td>
                    <td className="py-2.5 text-zinc-400 text-xs font-mono">{p.reference ?? "—"}</td>
                    <td className="py-2.5 text-zinc-500 text-xs">{p.notes ?? "—"}</td>
                    <td className="py-2.5 text-right font-mono text-xs text-zinc-200">
                      {fmt2(Number(p.amount))}
                    </td>
                    <td className="py-2.5 text-right">
                      <DeleteEntryButton kind="payout" entryId={p.id} partnerId={partner.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* Soft investments */}
      {canLog && (
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <div>
              <h2 className="text-white font-semibold">Soft Investments</h2>
              <p className="text-zinc-500 text-xs mt-0.5">
                Meals, gifts, marketing co-op, holiday gestures.
              </p>
            </div>
            <InvestmentForm partnerId={partner.id} />
          </div>
          {(investments?.length ?? 0) === 0 ? (
            <p className="text-zinc-500 text-sm italic">No investments logged.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wide">
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Category</th>
                  <th className="text-left py-2">Notes</th>
                  <th className="text-right py-2">Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(investments as any[]).map((i) => (
                  <tr
                    key={i.id}
                    className="border-b border-zinc-800/60 last:border-0"
                  >
                    <td className="py-2.5 text-zinc-300 text-xs">{i.occurred_on}</td>
                    <td className="py-2.5 text-zinc-300 text-xs">{CATEGORY_LABEL[i.category] ?? i.category}</td>
                    <td className="py-2.5 text-zinc-500 text-xs">{i.notes ?? "—"}</td>
                    <td className="py-2.5 text-right font-mono text-xs text-zinc-200">
                      {fmt2(Number(i.amount))}
                    </td>
                    <td className="py-2.5 text-right">
                      <DeleteEntryButton kind="investment" entryId={i.id} partnerId={partner.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "default" | "blue" | "green" | "red";
}) {
  const valueClass =
    accent === "green"
      ? "text-green-400"
      : accent === "red"
        ? "text-red-400"
        : accent === "blue"
          ? "text-blue-400"
          : "text-white";
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <p className="text-zinc-500 text-[10px] uppercase tracking-wide font-semibold">
        {label}
      </p>
      <p className={`text-2xl font-mono font-semibold mt-1 ${valueClass}`}>{value}</p>
      {sub && <p className="text-zinc-500 text-[10px] mt-1">{sub}</p>}
    </div>
  );
}
