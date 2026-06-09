import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getDataCutoff } from "@/lib/data-cutoff";
import { requireRoles } from "@/components/RoleGate";
import NewSubForm from "./NewSubForm";
import MarkPaidButton from "./MarkPaidButton";

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
    ytdBySub.set(
      inv.subcontractor_id,
      (ytdBySub.get(inv.subcontractor_id) ?? 0) + Number(inv.amount)
    );
  }

  // Subs needing 1099-NEC (non-corp + ≥ $600 YTD)
  const needs1099 = (subs ?? []).filter((s: any) => {
    if (s.is_corporation) return false;
    return (ytdBySub.get(s.id) ?? 0) >= THRESHOLD_1099;
  });

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Subcontractors</h1>
        <p className="text-ink-2 text-sm mt-0.5">
          Outside companies you pay to do part of a job. Tracks YTD totals so
          1099-NEC season isn't a scramble (IRS threshold: ${THRESHOLD_1099} per non-corp vendor).
        </p>
      </div>

      {/* 1099 alert */}
      {needs1099.length > 0 && (
        <div className="bg-yellow-500/5 border border-yellow-500/30 rounded-xl p-4 mb-6">
          <p className="text-honey text-xs uppercase tracking-wide font-semibold mb-2">
            📋 1099-NEC required this year ({needs1099.length})
          </p>
          <ul className="space-y-1">
            {needs1099.map((s: any) => (
              <li key={s.id} className="text-sm text-ink">
                <span className="font-medium">{s.name}</span>
                <span className="text-ink-3"> — {fmt(ytdBySub.get(s.id) ?? 0)} YTD</span>
                {!s.ein_or_ssn_last4 && (
                  <span className="text-red-700 text-xs ml-2">⚠ no W-9 / EIN on file</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Add sub */}
      <div className="glass-card p-5 mb-6">
        <h2 className="text-ink font-semibold mb-3">Add a subcontractor</h2>
        <NewSubForm />
      </div>

      {/* Subs list */}
      <div className="glass-card overflow-x-auto mb-6">
        <div className="px-5 py-3 border-b border-edge2">
          <h2 className="text-ink font-semibold">Active Subs</h2>
        </div>
        {!subs?.length ? (
          <p className="px-5 py-10 text-center text-ink-3 text-sm">
            No subcontractors yet. Add one above.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge2 text-ink-3 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Trade</th>
                <th className="px-4 py-3 text-left">Contact</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-right">YTD Paid</th>
                <th className="px-4 py-3 text-right">1099?</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s: any) => {
                const ytd = ytdBySub.get(s.id) ?? 0;
                const need1099 = !s.is_corporation && ytd >= THRESHOLD_1099;
                return (
                  <tr
                    key={s.id}
                    className="border-b border-edge2 last:border-0 hover:bg-shade"
                  >
                    <td className="px-4 py-3">
                      <p className="text-ink font-medium">{s.name}</p>
                      {s.ein_or_ssn_last4 && (
                        <p className="text-ink-3 text-[10px] font-mono">EIN ····{s.ein_or_ssn_last4}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-2 text-xs">{s.trade ?? "—"}</td>
                    <td className="px-4 py-3 text-xs">
                      <p className="text-ink-2">{s.contact_name ?? "—"}</p>
                      <p className="text-ink-3">{s.phone ?? s.email ?? ""}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] ${
                          s.is_corporation
                            ? "bg-info/10 text-info"
                            : "bg-shade text-ink-2"
                        }`}
                      >
                        {s.is_corporation ? "Corp (no 1099)" : "Individual / LLC"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-ink font-mono text-xs">
                      {ytd > 0 ? fmt(ytd) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {need1099 ? (
                        <span className="text-honey text-xs font-semibold">📋 Yes</span>
                      ) : s.is_corporation ? (
                        <span className="text-ink-3 text-xs">—</span>
                      ) : (
                        <span className="text-ink-3 text-xs">below ${THRESHOLD_1099}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent invoices */}
      <div className="glass-card overflow-x-auto">
        <div className="px-5 py-3 border-b border-edge2">
          <h2 className="text-ink font-semibold">Recent Sub Invoices</h2>
        </div>
        {!recentInvoices?.length ? (
          <p className="px-5 py-10 text-center text-ink-3 text-sm italic">
            No sub invoices logged yet. Open a job → The Money → Sub Invoices
            to log one against that job.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge2 text-ink-3 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Sub</th>
                <th className="px-4 py-3 text-left">Job</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Paid?</th>
              </tr>
            </thead>
            <tbody>
              {recentInvoices.map((i: any) => (
                <tr key={i.id} className="border-b border-edge2 last:border-0">
                  <td className="px-4 py-3 text-ink-2 text-xs font-mono">{i.invoice_date}</td>
                  <td className="px-4 py-3 text-ink text-xs">
                    {i.subcontractors?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {i.jobs ? (
                      <Link
                        href={`/jobs/${i.jobs.id}`}
                        className="text-info hover:underline font-mono"
                      >
                        {i.jobs.job_number}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-2 text-xs truncate max-w-[280px]">
                    {i.description ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-ink font-mono text-xs">
                    {fmt(Number(i.amount))}
                  </td>
                  <td className="px-4 py-3 text-right text-xs">
                    {i.paid_at ? (
                      <span className="text-pine">✓ paid</span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <span className="text-honey">unpaid</span>
                        <MarkPaidButton invoiceId={i.id} />
                      </span>
                    )}
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
