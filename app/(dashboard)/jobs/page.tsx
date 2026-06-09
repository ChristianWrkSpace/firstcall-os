import { createServerSupabaseClient } from "@/lib/supabase-server";
import { GLASS_STATUS, GLASS_STATUS_FALLBACK } from "@/lib/constants";
import { getDataCutoff } from "@/lib/data-cutoff";
import { PageBackdrop } from "@/components/ui/Glass";
import Link from "next/link";

const ACTIVE_STATUSES = [
  "lead",
  "inspection",
  "mitigation",
  "drying",
  "reconstruction",
];
const COMPLETED_STATUSES = ["completed", "closed"];
const CANCELLED_STATUSES = ["cancelled"];

type Filter = "active" | "completed" | "cancelled" | "all";

const TAB_LABELS: Record<Filter, string> = {
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
  all: "All",
};

const fmt = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const params = await searchParams;
  const filter: Filter = (
    ["active", "completed", "cancelled", "all"].includes(params.filter ?? "")
      ? params.filter
      : "active"
  ) as Filter;

  const supabase = await createServerSupabaseClient();
  const cutoff = getDataCutoff();

  // Counts for tabs (cheap status-only fetch)
  let statusQuery = supabase.from("jobs").select("status");
  if (cutoff) statusQuery = statusQuery.gte("created_at", cutoff);
  const { data: statusRows } = await statusQuery;
  const counts = {
    active: 0,
    completed: 0,
    cancelled: 0,
    all: statusRows?.length ?? 0,
  };
  for (const r of statusRows ?? []) {
    if (ACTIVE_STATUSES.includes(r.status)) counts.active += 1;
    else if (COMPLETED_STATUSES.includes(r.status)) counts.completed += 1;
    else if (CANCELLED_STATUSES.includes(r.status)) counts.cancelled += 1;
  }

  // Filtered list — also pull invoices/payments so we can flag A/R-pending jobs
  let query = supabase
    .from("jobs")
    .select(
      "*, customers(name, phone), invoices(id, status, sent_at, line_items:invoice_line_items(line_total), payments(amount))"
    )
    .order("created_at", { ascending: false });

  if (cutoff) query = query.gte("created_at", cutoff);

  if (filter === "active") query = query.in("status", ACTIVE_STATUSES);
  else if (filter === "completed") query = query.in("status", COMPLETED_STATUSES);
  else if (filter === "cancelled") query = query.in("status", CANCELLED_STATUSES);

  const { data: jobs } = await query;

  function arBalance(job: any): number {
    let bal = 0;
    for (const inv of job.invoices ?? []) {
      if (inv.status === "void") continue;
      if (!inv.sent_at) continue; // ignore drafts
      const total = (inv.line_items ?? []).reduce(
        (s: number, li: any) => s + Number(li.line_total ?? 0),
        0
      );
      const paid = (inv.payments ?? []).reduce(
        (s: number, p: any) => s + Number(p.amount),
        0
      );
      bal += Math.max(0, total - paid);
    }
    return bal;
  }

  return (
    <PageBackdrop>
      <div className="p-4 md:p-8 max-w-5xl mx-auto">
        <div className="flex items-end justify-between mb-5 gap-3 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">Work</p>
            <h1 className="text-2xl font-semibold tracking-tight text-white/95 mt-0.5">Jobs</h1>
            <p className="text-white/45 text-sm mt-1">
              {jobs?.length ?? 0} {TAB_LABELS[filter].toLowerCase()}
              {filter === "active" && counts.completed > 0 && (
                <>
                  {" · "}
                  <Link
                    href="/jobs?filter=completed"
                    className="text-white/40 hover:text-white transition-colors"
                  >
                    {counts.completed} completed
                  </Link>
                </>
              )}
            </p>
          </div>
          <Link
            href="/jobs/new"
            className="px-4 py-2 rounded-lg bg-gradient-to-br from-[#6B8AD9] to-[#5FBDB0] text-white text-sm font-semibold shadow-[0_0_18px_rgba(95,189,176,0.25)] hover:shadow-[0_0_26px_rgba(95,189,176,0.4)] transition-shadow"
          >
            + New job
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-white/[0.06]">
          {(Object.keys(TAB_LABELS) as Filter[]).map((f) => {
            const active = f === filter;
            return (
              <Link
                key={f}
                href={f === "active" ? "/jobs" : `/jobs?filter=${f}`}
                className={`px-3 py-2 text-sm transition-colors border-b-2 -mb-px ${
                  active
                    ? "text-white border-[#5FBDB0]"
                    : "text-white/45 hover:text-white border-transparent"
                }`}
              >
                {TAB_LABELS[f]}
                <span className="text-white/30 text-xs ml-1.5">{counts[f]}</span>
              </Link>
            );
          })}
        </div>

        {/* Flowing list of glass rows — scannable, but alive, not a spreadsheet */}
        {!jobs?.length ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-16 text-center text-white/45 text-sm">
            No {TAB_LABELS[filter].toLowerCase()} jobs.{" "}
            {filter === "active" && (
              <Link href="/jobs/new" className="text-[#A8DCD3] hover:text-white transition-colors">
                Create your first job →
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {jobs.map((job: any, i: number) => {
              const balance = arBalance(job);
              const statusPill = GLASS_STATUS[job.status] ?? GLASS_STATUS_FALLBACK;
              const site =
                [job.site_address, job.site_city].filter(Boolean).join(", ") || "Address TBD";
              return (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="group rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.045] hover:border-white/[0.08] transition-all px-4 py-3.5 animate-rise-in"
                  style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
                >
                  <div className="flex items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-mono text-xs text-white/45">{job.job_number}</span>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ring-1 ${statusPill}`}
                        >
                          {job.status}
                        </span>
                        <span className="text-white/30 text-[11px] capitalize">{job.type ?? "—"}</span>
                      </div>
                      <p className="text-white/95 text-sm font-semibold tracking-tight mt-1 truncate">
                        {job.customers?.name ?? "—"}
                      </p>
                      <p className="text-white/40 text-xs mt-0.5 truncate">{site}</p>
                    </div>

                    <div className="shrink-0 text-right flex flex-col items-end gap-1">
                      {balance > 0 ? (
                        <span
                          className="inline-flex items-center gap-1 text-amber-300 font-mono text-xs px-2 py-0.5 rounded-md bg-amber-400/10 ring-1 ring-amber-400/20"
                          title="Open balance — see A/R for collection"
                        >
                          ⚠ {fmt(balance)}
                        </span>
                      ) : null}
                      <span className="text-white/30 text-[11px] font-mono">
                        {new Date(job.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <span className="text-white/20 group-hover:text-white/50 transition-colors shrink-0">
                      →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </PageBackdrop>
  );
}
