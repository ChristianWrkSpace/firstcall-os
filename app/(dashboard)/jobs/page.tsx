import { createServerSupabaseClient } from "@/lib/supabase-server";
import { STATUS_COLORS } from "@/lib/constants";
import { getDataCutoff } from "@/lib/data-cutoff";
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
    <div className="p-4 md:p-8">
      <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Jobs</h1>
          <p className="text-zinc-400 text-sm mt-0.5">
            {jobs?.length ?? 0} {TAB_LABELS[filter].toLowerCase()}
            {filter === "active" && counts.completed > 0 && (
              <>
                {" · "}
                <Link
                  href="/jobs?filter=completed"
                  className="text-zinc-500 hover:text-white transition-colors"
                >
                  {counts.completed} completed
                </Link>
              </>
            )}
          </p>
        </div>
        <Link
          href="/jobs/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + New Job
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
                  ? "text-white border-blue-500"
                  : "text-zinc-400 hover:text-white border-transparent"
              }`}
            >
              {TAB_LABELS[f]}
              <span className="text-zinc-600 text-xs ml-1.5">
                {counts[f]}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {["Job #", "Customer", "Type", "Status", "Site", "A/R", "Created"].map(
                (h) => (
                  <th
                    key={h}
                    className="text-left text-zinc-400 font-medium px-4 py-3 text-xs uppercase tracking-wide"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {!jobs?.length && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                  No {TAB_LABELS[filter].toLowerCase()} jobs.{" "}
                  {filter === "active" && (
                    <Link href="/jobs/new" className="text-blue-400 hover:underline">
                      Create your first job →
                    </Link>
                  )}
                </td>
              </tr>
            )}
            {jobs?.map((job: any) => {
              const balance = arBalance(job);
              return (
                <tr
                  key={job.id}
                  className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.04] transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/jobs/${job.id}`}
                      className="text-blue-400 hover:underline font-mono text-xs"
                    >
                      {job.job_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-white">{job.customers?.name ?? "—"}</p>
                    <p className="text-zinc-500 text-xs mt-0.5">
                      {job.customers?.phone ?? ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-zinc-300 capitalize">
                    {job.type ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[job.status] ?? ""}`}
                    >
                      {job.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">
                    {[job.site_address, job.site_city].filter(Boolean).join(", ") ||
                      "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {balance > 0 ? (
                      <Link
                        href="/ar"
                        className="inline-flex items-center gap-1 text-yellow-400 hover:text-yellow-300 font-mono text-xs"
                        title="Open balance — see A/R for collection"
                      >
                        ⚠ {fmt(balance)}
                      </Link>
                    ) : (
                      <span className="text-zinc-700 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">
                    {new Date(job.created_at).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
