import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getDataCutoff } from "@/lib/data-cutoff";
import { redirect } from "next/navigation";
import RunAnalysisButton from "./RunAnalysisButton";
import {
  SEVERITY_BADGE,
  PRIORITY_BADGE,
  CATEGORY_LABEL,
  type SolomonInsight,
  type SolomonRecommendation,
} from "@/lib/solomon-types";
import { PageShell, Glass, Band, EmptyState } from "@/components/ui/Glass";

export default async function SolomonPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (me.role !== "owner" && me.role !== "manager") {
    return (
      <PageShell eyebrow="FP&A analyst" title="🧠 Solomon" width="narrow">
        <p className="text-white/50 text-sm">Solomon is the FP&A agent — owner / manager only.</p>
      </PageShell>
    );
  }

  const supabase = await createServerSupabaseClient();
  const cutoff = getDataCutoff();
  let reportsQuery = supabase
    .from("solomon_reports")
    .select(
      "id, created_at, window_days, job_count, invoice_count, total_billed, total_collected, insights, recommendations, raw_summary, generated_by, profiles:profiles!generated_by(name)"
    )
    .order("created_at", { ascending: false })
    .limit(5);
  if (cutoff) reportsQuery = reportsQuery.gte("created_at", cutoff);
  const { data: latest } = await reportsQuery;

  const reports = latest ?? [];
  const current = reports[0];

  return (
    <PageShell
      eyebrow="FP&A analyst"
      title="🧠 Solomon"
      subtitle="Reads jobs, invoices, payments, carriers, and zip codes — flags revenue concentration, slow-pay carriers, geographic outliers, and pricing tweaks. Honest about data limits (no COGS yet)."
      action={<RunAnalysisButton />}
    >
      {!current ? (
        <EmptyState icon="🧠" title="No analyses yet.">
          Click &ldquo;Run Analysis&rdquo; to generate the first one.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Executive summary — the lit hero */}
          <Glass level="stage" accent="teal" className="p-6 animate-rise-in">
            <div className="flex justify-between items-baseline gap-4 flex-wrap mb-3">
              <p className="text-white/45 text-xs uppercase tracking-[0.15em] font-semibold">
                Executive Summary · last {current.window_days} days
              </p>
              <p className="text-white/40 text-xs">
                Generated {new Date(current.created_at).toLocaleString()} by{" "}
                {(current as any).profiles?.name ?? "—"}
              </p>
            </div>
            <p className="text-white/85 text-base leading-relaxed">
              {current.raw_summary ?? "(No summary)"}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
              <Stat label="Jobs" value={current.job_count?.toString() ?? "0"} />
              <Stat label="Invoiced" value={`$${Number(current.total_billed ?? 0).toLocaleString()}`} />
              <Stat label="Collected" value={`$${Number(current.total_collected ?? 0).toLocaleString()}`} />
              <Stat
                label="Cash %"
                value={
                  Number(current.total_billed ?? 0) > 0
                    ? `${Math.round((Number(current.total_collected ?? 0) / Number(current.total_billed ?? 0)) * 100)}%`
                    : "—"
                }
              />
            </div>
          </Glass>

          {/* Insights */}
          <Band label="Insights">
            {((current.insights ?? []) as SolomonInsight[]).map((ins, i) => (
              <Glass key={i} className="p-4">
                <div className="flex items-start gap-3 flex-wrap">
                  <span
                    className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full font-semibold ${SEVERITY_BADGE[ins.severity] ?? ""}`}
                  >
                    {ins.severity}
                  </span>
                  <span className="text-white/40 text-xs">{CATEGORY_LABEL[ins.category]}</span>
                </div>
                <p className="text-white/95 font-medium mt-2">{ins.headline}</p>
                <p className="text-white/70 text-sm mt-1.5">{ins.detail}</p>
                <p className="text-[#A6B8E7] text-xs font-mono mt-2">{ins.metric}</p>
                {ins.evidence && ins.evidence.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1">
                    {ins.evidence.map((e, j) => (
                      <li key={j} className="text-white/40 text-xs flex gap-2">
                        <span>•</span>
                        <span>{e}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Glass>
            ))}
          </Band>

          {/* Recommendations */}
          <Band label="Recommendations">
            {((current.recommendations ?? []) as SolomonRecommendation[]).map((r, i) => (
              <Glass key={i} className="p-4">
                <div className="flex items-start gap-3 flex-wrap">
                  <span
                    className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full font-semibold ${PRIORITY_BADGE[r.priority] ?? ""}`}
                  >
                    {r.priority.replace("_", " ")}
                  </span>
                  {typeof r.estimated_impact_dollars === "number" && (
                    <span className="text-emerald-300 text-xs font-mono">
                      ~${Math.round(r.estimated_impact_dollars).toLocaleString()} impact
                    </span>
                  )}
                </div>
                <p className="text-white/95 font-medium mt-2">{r.action}</p>
                <p className="text-white/55 text-sm mt-1.5">{r.rationale}</p>
              </Glass>
            ))}
          </Band>

          {/* History */}
          {reports.length > 1 && (
            <Band label="Past Reports">
              <Glass className="p-5">
                <ul className="flex flex-col gap-1.5">
                  {reports.slice(1).map((r: any) => (
                    <li key={r.id} className="text-white/45 text-xs">
                      {new Date(r.created_at).toLocaleDateString()} · {r.window_days}d window ·{" "}
                      {r.job_count} jobs · ${Number(r.total_billed ?? 0).toLocaleString()} billed
                    </li>
                  ))}
                </ul>
              </Glass>
            </Band>
          )}
        </div>
      )}
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-4 py-3">
      <p className="text-white/40 text-[10px] uppercase tracking-[0.15em] font-semibold">{label}</p>
      <p className="text-white/95 text-lg font-mono mt-1">{value}</p>
    </div>
  );
}
