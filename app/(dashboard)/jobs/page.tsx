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

type Filter = "active" | "completed" | "cancelled" | "test" | "all";

const TAB_LABELS: Record<Filter, string> = {
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
  test: "Test",
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
    ["active", "completed", "cancelled", "test", "all"].includes(params.filter ?? "")
      ? params.filter
      : "active"
  ) as Filter;

  const supabase = await createServerSupabaseClient();
  const cutoff = getDataCutoff();

  // Build the count and filtered-list reads first so they leave for Supabase
  // together instead of creating a second network waterfall.
  let statusQuery = supabase.from("jobs").select("status, is_test");
  if (cutoff) statusQuery = statusQuery.gte("created_at", cutoff);

  // Pull only fields rendered by this page plus the nested A/R inputs.
  let query = supabase
    .from("jobs")
    .select(
      "id, status, is_test, job_number, type, site_address, site_city, created_at, customers(name), invoices(id, status, sent_at, line_items:invoice_line_items(line_total), payments(amount))"
    )
    .order("created_at", { ascending: false });

  if (cutoff) query = query.gte("created_at", cutoff);

  if (filter === "test") query = query.eq("is_test", true);
  else {
    query = query.eq("is_test", false);
    if (filter === "active") query = query.in("status", ACTIVE_STATUSES);
    else if (filter === "completed") query = query.in("status", COMPLETED_STATUSES);
    else if (filter === "cancelled") query = query.in("status", CANCELLED_STATUSES);
  }

  const [{ data: statusRows }, { data: jobs }] = await Promise.all([statusQuery, query]);
  const counts = {
    active: 0,
    completed: 0,
    cancelled: 0,
    test: 0,
    all: 0,
  };
  for (const r of statusRows ?? []) {
    if (r.is_test) {
      counts.test += 1;
      continue;
    }
    counts.all += 1;
    if (ACTIVE_STATUSES.includes(r.status)) counts.active += 1;
    else if (COMPLETED_STATUSES.includes(r.status)) counts.completed += 1;
    else if (CANCELLED_STATUSES.includes(r.status)) counts.cancelled += 1;
  }

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
      <div className="max-w-3xl mx-auto">
        <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
              Jobs
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
              {jobs?.length ?? 0} {TAB_LABELS[filter].toLowerCase()}
            </p>
          </div>
          <Link
            href="/jobs/new"
            className="px-4 py-2 text-sm font-medium rounded-xl text-ink transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #E08A63, #C4663F)" }}
          >
            + New Job
          </Link>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {(Object.keys(TAB_LABELS) as Filter[]).map((f) => {
            const active = f === filter;
            return (
              <Link
                key={f}
                href={f === "active" ? "/jobs" : `/jobs?filter=${f}`}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  active ? "ring-1 ring-[#D97757]/30" : "hover:bg-shade"
                }`}
                style={{
                  backgroundColor: active ? "rgba(58,47,38,0.05)" : "rgba(58,47,38,0.05)",
                  color: active ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                }}
              >
                {TAB_LABELS[f]}
                <span className="ml-1.5" style={{ color: "var(--color-text-muted)" }}>
                  {counts[f]}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Flowing rows — the whole row is the tap target */}
        {!jobs?.length ? (
          <div
            className="rounded-2xl border px-6 py-14 text-center"
            style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-edge)" }}
          >
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              No {TAB_LABELS[filter].toLowerCase()} jobs.
            </p>
            {filter === "active" && (
              <Link
                href="/jobs/new"
                className="inline-block mt-3 text-sm hover:underline"
                style={{ color: "#D97757" }}
              >
                Create your first job →
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {jobs.map((job: any) => {
              const balance = arBalance(job);
              return (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="group flex items-center gap-4 px-4 py-3.5 rounded-2xl border transition-colors hover:bg-shade"
                  style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-edge)" }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <p className="font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                        {job.customers?.name ?? "No customer"}
                      </p>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${STATUS_COLORS[job.status] ?? ""}`}
                      >
                        {job.status}
                      </span>
                      {job.is_test && (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-honey/10 text-honey">
                          TEST — AUTOMATION OFF
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-1 truncate" style={{ color: "var(--color-text-muted)" }}>
                      <span className="font-mono">{job.job_number}</span>
                      {" · "}
                      <span className="capitalize">{job.type ?? "—"}</span>
                      {job.site_address ? ` · ${[job.site_address, job.site_city].filter(Boolean).join(", ")}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {balance > 0 && (
                      <p className="font-mono text-xs text-honey">⚠ {fmt(balance)}</p>
                    )}
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                      {new Date(job.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className="shrink-0 text-xs transition-transform group-hover:translate-x-0.5"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    ›
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
