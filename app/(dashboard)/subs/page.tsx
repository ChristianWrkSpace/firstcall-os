import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getDataCutoff } from "@/lib/data-cutoff";
import { requireRoles } from "@/components/RoleGate";
import NewSubForm from "./NewSubForm";
import { PageShell, Glass, Band, GlassRow, EmptyState } from "@/components/ui/Glass";

const fmt = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const THRESHOLD_1099 = 600; // IRS threshold for 1099-NEC

export default async function SubsPage() {
  await requireRoles(["owner", "manager", "office"]);
  const supabase = await createServerSupabaseClient();

  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
  const cutoff = getDataCutoff();

  let subsQuery = supabase
    .from("subcontractors")
    .select("id, name, trade, contact_name, phone, email, ein_or_ssn_last4, is_corporation, active, created_at")
    .eq("active", true)
    .order("name");
  if (cutoff) subsQuery = subsQuery.gte("created_at", cutoff);

  let ytdQuery = supabase
    .from("sub_invoices")
    .select("subcontractor_id, amount, created_at")
    .gte("invoice_date", yearStart);
  if (cutoff) ytdQuery = ytdQuery.gte("created_at", cutoff);

  let recentQuery = supabase
    .from("sub_invoices")
    .select(
      "id, invoice_number, invoice_date, amount, paid_at, description, created_at, jobs(job_number, id), subcontractors(name)"
    )
    .order("invoice_date", { ascending: false })
    .limit(50);
  if (cutoff) recentQuery = recentQuery.gte("created_at", cutoff);

  const [{ data: subs }, { data: ytdInvoices }, { data: recentInvoices }] = await Promise.all([
    subsQuery,
    ytdQuery,
    recentQuery,
  ]);

  // YTD totals per sub
  const ytdBySub = new Map<string, number>();
  for (const inv of (ytdInvoices ?? []) as any[]) {
    ytdBySub.set(inv.subcontractor_id, (ytdBySub.get(inv.subcontractor_id) ?? 0) + Number(inv.amount));
  }

  // Subs needing 1099-NEC (non-corp + ≥ $600 YTD)
  const needs1099 = (subs ?? []).filter((s: any) => {
    if (s.is_corporation) return false;
    return (ytdBySub.get(s.id) ?? 0) >= THRESHOLD_1099;
  });

  return (
    <PageShell
      eyebrow="Vendors"
      title="Subcontractors"
      subtitle={`Outside companies you pay to do part of a job. Tracks YTD totals so 1099-NEC season isn't a scramble (IRS threshold: $${THRESHOLD_1099} per non-corp vendor).`}
      width="wide"
    >
      {/* 1099 alert */}
      {needs1099.length > 0 && (
        <Glass accent="amber" className="p-4 mb-6">
          <p className="text-amber-300 text-xs uppercase tracking-wide font-semibold mb-2">
            📋 1099-NEC required this year ({needs1099.length})
          </p>
          <ul className="space-y-1">
            {needs1099.map((s: any) => (
              <li key={s.id} className="text-sm text-white/85">
                <span className="font-medium">{s.name}</span>
                <span className="text-white/40"> — {fmt(ytdBySub.get(s.id) ?? 0)} YTD</span>
                {!s.ein_or_ssn_last4 && (
                  <span className="text-red-400 text-xs ml-2">⚠ no W-9 / EIN on file</span>
                )}
              </li>
            ))}
          </ul>
        </Glass>
      )}

      {/* Add sub */}
      <Glass className="p-5 mb-6">
        <h2 className="text-white/95 font-semibold mb-3">Add a subcontractor</h2>
        <NewSubForm />
      </Glass>

      {/* Active subs */}
      <Band label="Active Subs" className="mb-6">
        {!subs?.length ? (
          <EmptyState icon="🤝" title="No subcontractors yet.">
            Add one above.
          </EmptyState>
        ) : (
          subs.map((s: any, i: number) => {
            const ytd = ytdBySub.get(s.id) ?? 0;
            const need1099 = !s.is_corporation && ytd >= THRESHOLD_1099;
            return (
              <GlassRow
                key={s.id}
                index={i}
                accent={need1099 ? "amber" : "neutral"}
                meta={
                  <>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] ring-1 ${
                        s.is_corporation
                          ? "bg-[#6B8AD9]/10 text-[#A6B8E7] ring-[#6B8AD9]/20"
                          : "bg-white/5 text-white/60 ring-white/10"
                      }`}
                    >
                      {s.is_corporation ? "Corp (no 1099)" : "Individual / LLC"}
                    </span>
                    {s.trade && <span className="text-white/35 text-[11px]">{s.trade}</span>}
                  </>
                }
                title={s.name}
                sub={
                  [
                    s.contact_name,
                    s.phone ?? s.email,
                    s.ein_or_ssn_last4 ? `EIN ····${s.ein_or_ssn_last4}` : null,
                  ]
                    .filter(Boolean)
                    .join("   ·   ") || undefined
                }
                trailing={
                  <>
                    <span className="text-white/90 font-mono text-sm">{ytd > 0 ? fmt(ytd) : "—"}</span>
                    <span className="text-[10px] uppercase tracking-wide">
                      {need1099 ? (
                        <span className="text-amber-300 font-semibold">📋 1099</span>
                      ) : s.is_corporation ? (
                        <span className="text-white/30">YTD paid</span>
                      ) : (
                        <span className="text-white/35">below ${THRESHOLD_1099}</span>
                      )}
                    </span>
                  </>
                }
              />
            );
          })
        )}
      </Band>

      {/* Recent invoices */}
      <Band label="Recent Sub Invoices">
        {!recentInvoices?.length ? (
          <EmptyState icon="🧾" title="No sub invoices logged yet.">
            Log them from a job's P&L section or via API.
          </EmptyState>
        ) : (
          recentInvoices.map((i: any, idx: number) => (
            <GlassRow
              key={i.id}
              href={i.jobs ? `/jobs/${i.jobs.id}` : undefined}
              index={idx}
              meta={
                <>
                  <span className="font-mono text-xs text-white/45">{i.invoice_date}</span>
                  {i.jobs?.job_number && (
                    <span className="text-[#A6B8E7] font-mono text-[11px]">{i.jobs.job_number}</span>
                  )}
                </>
              }
              title={i.subcontractors?.name ?? "—"}
              sub={i.description ?? undefined}
              trailing={
                <>
                  <span className="text-white/90 font-mono text-sm">{fmt(Number(i.amount))}</span>
                  <span className="text-[11px]">
                    {i.paid_at ? (
                      <span className="text-emerald-300">✓ paid</span>
                    ) : (
                      <span className="text-amber-300">unpaid</span>
                    )}
                  </span>
                </>
              }
            />
          ))
        )}
      </Band>
    </PageShell>
  );
}
