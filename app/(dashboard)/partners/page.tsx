import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getDataCutoff } from "@/lib/data-cutoff";
import Link from "next/link";
import { PARTNER_TYPE_LABEL, type PartnerType } from "@/lib/partner-types";
import { requireRoles } from "@/components/RoleGate";
import { PageShell, GlassRow, EmptyState } from "@/components/ui/Glass";

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
    <PageShell
      eyebrow="Partners + ROI"
      title="Partners"
      subtitle="Plumbers, property managers, restaurants, GCs, and other referral sources. Open any partner to see ROI."
      action={
        <Link
          href="/partners/outreach"
          className="px-4 py-2 rounded-lg bg-gradient-to-br from-[#6B8AD9] to-[#5FBDB0] text-white text-sm font-semibold shadow-[0_0_18px_rgba(95,189,176,0.25)] hover:shadow-[0_0_26px_rgba(95,189,176,0.4)] transition-shadow"
        >
          🎯 B2B Outreach
        </Link>
      }
      width="wide"
    >
      {!partners?.length ? (
        <EmptyState icon="◐" title="No partners yet.">
          Convert leads from the{" "}
          <Link href="/partners/outreach" className="text-[#A8DCD3] hover:text-white transition-colors">
            Outreach Pipeline
          </Link>
          .
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-2">
          {partners.map((p: any, i: number) => {
            const s = stats.get(p.id) ?? { referrals: 0, revenue: 0, cash: 0, soft: 0 };
            const invested = s.cash + s.soft;
            const roi = invested > 0 ? s.revenue / invested : null;
            const ptype = (p.partner_type ?? "other") as PartnerType;
            const roiColor =
              roi == null ? "text-white/30" : roi >= 5 ? "text-emerald-300" : roi < 1 ? "text-red-400" : "text-white/80";
            return (
              <GlassRow
                key={p.id}
                href={`/partners/${p.id}`}
                index={i}
                accent={roi != null && roi >= 5 ? "teal" : "neutral"}
                meta={
                  <>
                    <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wide ring-1 bg-white/5 text-white/60 ring-white/10">
                      {PARTNER_TYPE_LABEL[ptype]}
                    </span>
                    {s.referrals > 0 && (
                      <span className="text-white/35 text-[11px] font-mono">
                        {s.referrals} referral{s.referrals === 1 ? "" : "s"}
                      </span>
                    )}
                  </>
                }
                title={p.name}
                sub={
                  [
                    p.company,
                    s.revenue > 0 ? `${fmt(s.revenue)} revenue` : null,
                    invested > 0 ? `${fmt(invested)} invested` : null,
                  ]
                    .filter(Boolean)
                    .join("   ·   ") || undefined
                }
                trailing={
                  <>
                    <span className={`font-mono font-semibold ${roiColor}`}>
                      {roi != null ? `${roi.toFixed(1)}×` : "—"}
                    </span>
                    <span className="text-white/30 text-[10px] uppercase tracking-wide">ROI</span>
                  </>
                }
              />
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
