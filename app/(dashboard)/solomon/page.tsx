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

export default async function SolomonPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (me.role !== "owner" && me.role !== "manager") {
    return (
      <div className="p-8 max-w-2xl">
        <h1 className="text-2xl font-bold text-ink">🧠 Solomon</h1>
        <p className="text-ink-2 text-sm mt-2">
          Solomon is the FP&A agent — owner / manager only.
        </p>
      </div>
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
    <div className="p-4 md:p-8">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">🧠 Solomon</h1>
          <p className="text-ink-2 text-sm mt-1 max-w-2xl">
            FP&A agent. Reads jobs, invoices, payments, carriers, and zip codes —
            flags revenue concentration, slow-pay carriers, geographic
            outliers, and pricing tweaks. Honest about data limits (no COGS yet).
          </p>
        </div>
        <RunAnalysisButton />
      </div>

      {!current ? (
        <div className="glass-card p-10 text-center">
          <p className="text-ink-2 text-sm">
            No analyses yet. Click "Run Analysis" to generate the first one.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Header */}
          <section className="glass-card p-6">
            <div className="flex justify-between items-baseline gap-4 flex-wrap mb-3">
              <p className="text-ink-3 text-xs uppercase tracking-wide font-semibold">
                Executive Summary · last {current.window_days} days
              </p>
              <p className="text-ink-3 text-xs">
                Generated {new Date(current.created_at).toLocaleString()} by{" "}
                {(current as any).profiles?.name ?? "—"}
              </p>
            </div>
            <p className="text-ink text-base leading-relaxed">
              {current.raw_summary ?? "(No summary)"}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
              <Stat label="Jobs" value={current.job_count?.toString() ?? "0"} />
              <Stat
                label="Invoiced"
                value={`$${Number(current.total_billed ?? 0).toLocaleString()}`}
              />
              <Stat
                label="Collected"
                value={`$${Number(current.total_collected ?? 0).toLocaleString()}`}
              />
              <Stat
                label="Cash %"
                value={
                  Number(current.total_billed ?? 0) > 0
                    ? `${Math.round((Number(current.total_collected ?? 0) / Number(current.total_billed ?? 0)) * 100)}%`
                    : "—"
                }
              />
            </div>
          </section>

          {/* Insights */}
          <section className="glass-card p-6">
            <h2 className="text-ink font-semibold mb-4">Insights</h2>
            <div className="flex flex-col gap-3">
              {((current.insights ?? []) as SolomonInsight[]).map((ins, i) => (
                <div
                  key={i}
                  className="bg-tint border border-edge2 rounded-lg p-4"
                >
                  <div className="flex items-start gap-3 flex-wrap">
                    <span
                      className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full font-semibold ${SEVERITY_BADGE[ins.severity] ?? ""}`}
                    >
                      {ins.severity}
                    </span>
                    <span className="text-ink-3 text-xs">
                      {CATEGORY_LABEL[ins.category]}
                    </span>
                  </div>
                  <p className="text-ink font-medium mt-2">{ins.headline}</p>
                  <p className="text-ink-2 text-sm mt-1.5">{ins.detail}</p>
                  <p className="text-info text-xs font-mono mt-2">
                    {ins.metric}
                  </p>
                  {ins.evidence && ins.evidence.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-1">
                      {ins.evidence.map((e, j) => (
                        <li
                          key={j}
                          className="text-ink-3 text-xs flex gap-2"
                        >
                          <span>•</span>
                          <span>{e}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Recommendations */}
          <section className="glass-card p-6">
            <h2 className="text-ink font-semibold mb-4">Recommendations</h2>
            <div className="flex flex-col gap-3">
              {((current.recommendations ?? []) as SolomonRecommendation[]).map(
                (r, i) => (
                  <div
                    key={i}
                    className="bg-tint border border-edge2 rounded-lg p-4"
                  >
                    <div className="flex items-start gap-3 flex-wrap">
                      <span
                        className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full font-semibold ${PRIORITY_BADGE[r.priority] ?? ""}`}
                      >
                        {r.priority.replace("_", " ")}
                      </span>
                      {typeof r.estimated_impact_dollars === "number" && (
                        <span className="text-pine text-xs font-mono">
                          ~${Math.round(r.estimated_impact_dollars).toLocaleString()} impact
                        </span>
                      )}
                    </div>
                    <p className="text-ink font-medium mt-2">{r.action}</p>
                    <p className="text-ink-2 text-sm mt-1.5">
                      {r.rationale}
                    </p>
                  </div>
                )
              )}
            </div>
          </section>

          {/* History */}
          {reports.length > 1 && (
            <section className="glass-card p-6">
              <h2 className="text-ink font-semibold mb-4">Past Reports</h2>
              <ul className="flex flex-col gap-1">
                {reports.slice(1).map((r: any) => (
                  <li
                    key={r.id}
                    className="text-ink-3 text-xs flex justify-between"
                  >
                    <span>
                      {new Date(r.created_at).toLocaleDateString()} ·{" "}
                      {r.window_days}d window · {r.job_count} jobs · $
                      {Number(r.total_billed ?? 0).toLocaleString()} billed
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-tint rounded-lg px-4 py-3">
      <p className="text-ink-3 text-[10px] uppercase tracking-wide font-semibold">
        {label}
      </p>
      <p className="text-ink text-lg font-mono mt-1">{value}</p>
    </div>
  );
}
