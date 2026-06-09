import { createServerSupabaseClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PARTNER_TYPE_LABEL, canLogInvestmentFor, type PartnerType } from "@/lib/partner-types";
import { GLASS_STATUS, GLASS_STATUS_FALLBACK } from "@/lib/constants";
import { PayoutForm, InvestmentForm, DeleteEntryButton } from "./LedgerForms";
import { requireRoles } from "@/components/RoleGate";
import { PageShell, Glass, Band, GlassRow, EmptyState } from "@/components/ui/Glass";

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
    <PageShell
      eyebrow="Partner"
      title={partner.name}
      subtitle={
        <span className="flex items-center gap-2 flex-wrap">
          <span>{PARTNER_TYPE_LABEL[ptype] ?? "Other"}</span>
          {partner.company && <span className="text-white/30">· {partner.company}</span>}
          {!partner.active && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/45 ring-1 ring-white/10 uppercase">
              Inactive
            </span>
          )}
          {partner.phone && (
            <a href={`tel:${partner.phone}`} className="text-[#A6B8E7] hover:text-white transition-colors">
              {partner.phone}
            </a>
          )}
          {partner.email && (
            <a href={`mailto:${partner.email}`} className="text-[#A6B8E7] hover:text-white transition-colors">
              {partner.email}
            </a>
          )}
        </span>
      }
      action={
        <Link
          href="/partners"
          className="px-3 py-1.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.05] text-white/70 text-sm transition-colors"
        >
          ← Partners
        </Link>
      }
      width="wide"
    >
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
        <Glass accent="amber" subtle className="p-4 mb-5 text-sm">
          <p className="text-amber-200 font-medium">⚠ Insurance Adjuster</p>
          <p className="text-white/70 mt-1">
            Texas Insurance Code § 4102.158 prohibits paying anything of value to a
            public adjuster for referring claims. Investment and payout logging is
            disabled for this partner type. You can still track referrals and revenue.
          </p>
        </Glass>
      )}

      {/* Referred jobs */}
      <Band label="Referred Jobs" hint={`${totalReferrals} attributed`} className="mb-6">
        {(referredJobs?.length ?? 0) === 0 ? (
          <EmptyState icon="🔗" title="No jobs attributed to this partner yet.">
            When a job is created, set &ldquo;Referred by&rdquo; on the intake form to link it here.
          </EmptyState>
        ) : (
          (referredJobs as any[]).map((j, i) => {
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
              <GlassRow
                key={j.id}
                href={`/jobs/${j.id}`}
                index={i}
                meta={
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ring-1 ${GLASS_STATUS[j.status] ?? GLASS_STATUS_FALLBACK}`}
                  >
                    {j.status}
                  </span>
                }
                title={<span className="font-mono text-[#A6B8E7]">{j.job_number}</span>}
                sub={j.customers?.name ?? "—"}
                trailing={
                  <>
                    <span className="text-white/95 font-mono font-semibold">{fmt2(rev)}</span>
                    <span className="text-white/30 text-[11px] font-mono">
                      {new Date(j.created_at).toLocaleDateString()}
                    </span>
                  </>
                }
              />
            );
          })
        )}
      </Band>

      {/* Cash payouts (1099) */}
      {canLog && (
        <Glass className="p-6 mb-5">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <div>
              <h2 className="text-white/90 font-semibold">Cash Payouts</h2>
              <p className="text-white/40 text-xs mt-0.5">1099-tracked. Owner / manager only.</p>
            </div>
            <PayoutForm partnerId={partner.id} />
          </div>
          {(payouts?.length ?? 0) === 0 ? (
            <p className="text-white/40 text-sm italic">No cash payouts logged.</p>
          ) : (
            <div className="flex flex-col">
              {(payouts as any[]).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 py-2.5 border-b border-white/[0.06] last:border-0 text-xs"
                >
                  <span className="text-white/55 w-24 shrink-0">{p.occurred_on}</span>
                  <span className="text-white/70 capitalize w-20 shrink-0">{p.method}</span>
                  <span className="text-white/45 font-mono flex-1 truncate">{p.reference ?? "—"}</span>
                  <span className="text-white/40 flex-1 truncate">{p.notes ?? "—"}</span>
                  <span className="text-white/80 font-mono shrink-0">{fmt2(Number(p.amount))}</span>
                  <DeleteEntryButton kind="payout" entryId={p.id} partnerId={partner.id} />
                </div>
              ))}
            </div>
          )}
        </Glass>
      )}

      {/* Soft investments */}
      {canLog && (
        <Glass className="p-6">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <div>
              <h2 className="text-white/90 font-semibold">Soft Investments</h2>
              <p className="text-white/40 text-xs mt-0.5">
                Meals, gifts, marketing co-op, holiday gestures.
              </p>
            </div>
            <InvestmentForm partnerId={partner.id} />
          </div>
          {(investments?.length ?? 0) === 0 ? (
            <p className="text-white/40 text-sm italic">No investments logged.</p>
          ) : (
            <div className="flex flex-col">
              {(investments as any[]).map((i) => (
                <div
                  key={i.id}
                  className="flex items-center gap-3 py-2.5 border-b border-white/[0.06] last:border-0 text-xs"
                >
                  <span className="text-white/55 w-24 shrink-0">{i.occurred_on}</span>
                  <span className="text-white/70 w-28 shrink-0">{CATEGORY_LABEL[i.category] ?? i.category}</span>
                  <span className="text-white/40 flex-1 truncate">{i.notes ?? "—"}</span>
                  <span className="text-white/80 font-mono shrink-0">{fmt2(Number(i.amount))}</span>
                  <DeleteEntryButton kind="investment" entryId={i.id} partnerId={partner.id} />
                </div>
              ))}
            </div>
          )}
        </Glass>
      )}
    </PageShell>
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
      ? "text-emerald-300"
      : accent === "red"
        ? "text-red-300"
        : accent === "blue"
          ? "text-[#A6B8E7]"
          : "text-white/95";
  return (
    <Glass className="p-4">
      <p className="text-white/40 text-[10px] uppercase tracking-wide font-semibold">{label}</p>
      <p className={`text-2xl font-mono font-semibold mt-1 ${valueClass}`}>{value}</p>
      {sub && <p className="text-white/40 text-[10px] mt-1">{sub}</p>}
    </Glass>
  );
}
