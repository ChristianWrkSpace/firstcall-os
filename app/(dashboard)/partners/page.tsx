import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getDataCutoff } from "@/lib/data-cutoff";
import Link from "next/link";
import { PARTNER_TYPE_LABEL, type PartnerType } from "@/lib/partner-types";
import { requireRoles } from "@/components/RoleGate";

const fmt = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default async function PartnersPage() {
  await requireRoles(["owner", "manager", "office"]);
  const supabase = await createServerSupabaseClient();
  const cutoff = getDataCutoff();

  let partnersQuery = supabase.from("partners").select("*").order("created_at", { ascending: false });
  if (cutoff) partnersQuery = partnersQuery.gte("created_at", cutoff);

  let jobsQuery = supabase
    .from("jobs")
    .select("id, referred_by_id, invoices(line_items:invoice_line_items(line_total))")
    .not("referred_by_id", "is", null);
  if (cutoff) jobsQuery = jobsQuery.gte("created_at", cutoff);

  const [{ data: partners }, { data: jobs }, { data: payouts }, { data: investments }] = await Promise.all([
    partnersQuery,
    jobsQuery,
    supabase.from("partner_payouts").select("partner_id, amount"),
    supabase.from("partner_investments").select("partner_id, amount"),
  ]);

  // Aggregate per partner
  const stats = new Map<string, { referrals: number; revenue: number; cash: number; soft: number }>();
  function ensure(id: string) {
    if (!stats.has(id)) stats.set(id, { referrals: 0, revenue: 0, cash: 0, soft: 0 });
    return stats.get(id)!;
  }
  for (const j of (jobs ?? []) as any[]) {
    const s = ensure(j.referred_by_id);
    s.referrals += 1;
    for (const inv of j.invoices ?? []) {
      const sum = (inv.line_items ?? []).reduce(
        (acc: number, li: any) => acc + Number(li.line_total ?? 0),
        0
      );
      s.revenue += sum;
    }
  }
  for (const p of (payouts ?? []) as any[]) {
    ensure(p.partner_id).cash += Number(p.amount);
  }
  for (const i of (investments ?? []) as any[]) {
    ensure(i.partner_id).soft += Number(i.amount);
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-ink">Partners</h1>
          <p className="text-ink-2 text-sm mt-0.5">
            Plumbers, property managers, restaurants, GCs, and other referral
            sources. Click any partner to see ROI.
          </p>
        </div>
        <Link
          href="/partners/outreach"
          className="px-4 py-2 bg-cta hover:bg-cta-deep text-white text-sm font-medium rounded-lg transition-colors"
        >
          🎯 B2B Outreach
        </Link>
      </div>

      <div className="glass-card overflow-x-auto">
        {!partners?.length ? (
          <div className="px-5 py-10 text-center text-ink-3 text-sm">
            No partners yet. Convert leads from{" "}
            <Link href="/partners/outreach" className="text-info hover:underline">
              Outreach Pipeline
            </Link>
            .
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge2 text-ink-3 text-xs uppercase tracking-wide">
                <th className="px-5 py-3 text-left">Name</th>
                <th className="px-5 py-3 text-left">Type</th>
                <th className="px-5 py-3 text-right">Referrals</th>
                <th className="px-5 py-3 text-right">Revenue</th>
                <th className="px-5 py-3 text-right">Invested</th>
                <th className="px-5 py-3 text-right">ROI</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p: any) => {
                const s = stats.get(p.id) ?? { referrals: 0, revenue: 0, cash: 0, soft: 0 };
                const invested = s.cash + s.soft;
                const roi = invested > 0 ? s.revenue / invested : null;
                const ptype = (p.partner_type ?? "other") as PartnerType;
                return (
                  <tr
                    key={p.id}
                    className="border-b border-edge2 last:border-0 hover:bg-shade transition-colors"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/partners/${p.id}`}
                        className="text-ink hover:text-info-deep transition-colors font-medium"
                      >
                        {p.name}
                      </Link>
                      {p.company && (
                        <p className="text-ink-3 text-xs">{p.company}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-ink-2 text-xs">
                      {PARTNER_TYPE_LABEL[ptype]}
                    </td>
                    <td className="px-5 py-3 text-right text-ink-2 font-mono text-xs">
                      {s.referrals}
                    </td>
                    <td className="px-5 py-3 text-right text-pine font-mono text-xs">
                      {fmt(s.revenue)}
                    </td>
                    <td className="px-5 py-3 text-right text-ink-2 font-mono text-xs">
                      {fmt(invested)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs">
                      {roi != null ? (
                        <span
                          className={
                            roi >= 5
                              ? "text-pine"
                              : roi < 1
                                ? "text-red-700"
                                : "text-ink-2"
                          }
                        >
                          {roi.toFixed(1)}×
                        </span>
                      ) : (
                        <span className="text-ink-3">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
