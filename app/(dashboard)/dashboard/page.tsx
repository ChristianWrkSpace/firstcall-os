import { createServerSupabaseClient } from "@/lib/supabase-server";
import Link from "next/link";
import { STATUS_COLORS, JOB_STATUSES } from "@/lib/constants";

const FOUR_HOURS_AGO = () => new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
const SEVEN_DAYS_AGO = () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
const THREE_DAYS_AGO = () => new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
const THIRTY_DAYS_AGO = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

const PIPELINE_COLUMNS = ["lead", "inspection", "mitigation", "drying", "reconstruction"] as const;

function timeAgo(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const ms = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function daysSince(date: string | null | undefined): number {
  if (!date) return 0;
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();

  const fourH = FOUR_HOURS_AGO();
  const sevenD = SEVEN_DAYS_AGO();
  const threeD = THREE_DAYS_AGO();
  const thirtyD = THIRTY_DAYS_AGO();

  const [
    newLeadsRes,
    missingScopeRes,
    staleJobsRes,
    pipelineJobsRes,
    completedRecentRes,
    callsThisWeekRes,
    jobsThisWeekRes,
    jobsCompletedThisWeekRes,
    last30dJobsRes,
  ] = await Promise.all([
    // Triage A: New Leads (last 4h)
    supabase
      .from("jobs")
      .select("id, job_number, status, created_at, customers(name)")
      .eq("status", "lead")
      .gte("created_at", fourH)
      .order("created_at", { ascending: false }),

    // Triage B: Jobs with photos but no scope yet
    supabase
      .from("jobs")
      .select("id, job_number, customers(name), job_photos!inner(id), updated_at")
      .is("scope_assessment", null),

    // Triage C: Stale jobs (no activity 3+ days, not completed/cancelled)
    supabase
      .from("jobs")
      .select("id, job_number, status, updated_at, customers(name)")
      .not("status", "in", "(completed,cancelled)")
      .lt("updated_at", threeD)
      .order("updated_at", { ascending: true }),

    // Pipeline: all active jobs
    supabase
      .from("jobs")
      .select("id, job_number, status, updated_at, site_city, customers(name)")
      .in("status", PIPELINE_COLUMNS as unknown as string[])
      .order("updated_at", { ascending: false }),

    // Pipeline: completed in last 7d
    supabase
      .from("jobs")
      .select("id, job_number, updated_at, site_city, customers(name)")
      .eq("status", "completed")
      .gte("updated_at", sevenD)
      .order("updated_at", { ascending: false }),

    // Stats: calls this week
    supabase
      .from("calls")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sevenD),

    // Stats: jobs created this week
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sevenD),

    // Stats: jobs completed this week
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("updated_at", sevenD),

    // Stats: jobs created in last 30d (for conversion calc)
    supabase
      .from("jobs")
      .select("id, status")
      .gte("created_at", thirtyD),
  ]);

  const newLeads = newLeadsRes.data ?? [];
  const missingScope = missingScopeRes.data ?? [];
  const staleJobs = staleJobsRes.data ?? [];
  const pipelineJobs = pipelineJobsRes.data ?? [];
  const completedRecent = completedRecentRes.data ?? [];

  const callsThisWeek = callsThisWeekRes.count ?? 0;
  const jobsThisWeek = jobsThisWeekRes.count ?? 0;
  const jobsCompletedThisWeek = jobsCompletedThisWeekRes.count ?? 0;

  const last30 = last30dJobsRes.data ?? [];
  const advancedStatuses = new Set(["mitigation", "drying", "reconstruction", "completed"]);
  const advancedCount = last30.filter((j) => advancedStatuses.has(j.status)).length;
  const conversionPct =
    last30.length > 0 ? Math.round((advancedCount / last30.length) * 100) : 0;

  // Group pipeline by status
  const pipelineByStatus: Record<string, typeof pipelineJobs> = {};
  for (const status of PIPELINE_COLUMNS) pipelineByStatus[status] = [];
  for (const job of pipelineJobs) {
    if (pipelineByStatus[job.status]) pipelineByStatus[job.status].push(job);
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-zinc-400 text-sm mt-0.5">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <p className="text-zinc-600 text-xs">Live — refresh to update</p>
      </div>

      {/* ─── Triage Queue ─────────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          🚨 Triage Queue
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <TriageCard
            title="New Leads"
            subtitle="last 4 hours"
            count={newLeads.length}
            urgent={newLeads.length > 0}
            emptyMessage="No new leads in the last 4 hours"
            viewAllHref="/jobs"
          >
            {newLeads.slice(0, 5).map((j) => (
              <TriageRow
                key={j.id}
                href={`/jobs/${j.id}`}
                primary={j.job_number}
                secondary={(j.customers as any)?.name ?? "—"}
                meta={timeAgo(j.created_at)}
              />
            ))}
          </TriageCard>

          <TriageCard
            title="Missing Scope"
            subtitle="photos uploaded, no Argus run"
            count={missingScope.length}
            urgent={missingScope.length > 0}
            emptyMessage="All jobs with photos have been scoped"
            viewAllHref="/jobs"
            color="amber"
          >
            {missingScope.slice(0, 5).map((j: any) => {
              const photoCount = Array.isArray(j.job_photos) ? j.job_photos.length : 0;
              return (
                <TriageRow
                  key={j.id}
                  href={`/jobs/${j.id}`}
                  primary={j.job_number}
                  secondary={(j.customers as any)?.name ?? "—"}
                  meta={`${photoCount} photo${photoCount === 1 ? "" : "s"}`}
                  metaCta="Run Argus →"
                />
              );
            })}
          </TriageCard>

          <TriageCard
            title="Stale Jobs"
            subtitle="no activity 3+ days"
            count={staleJobs.length}
            urgent={staleJobs.length > 0}
            emptyMessage="Every active job has recent activity"
            viewAllHref="/jobs"
            color="amber"
          >
            {staleJobs.slice(0, 5).map((j) => (
              <TriageRow
                key={j.id}
                href={`/jobs/${j.id}`}
                primary={j.job_number}
                secondary={(j.customers as any)?.name ?? "—"}
                meta={`${daysSince(j.updated_at)}d`}
                badge={j.status}
              />
            ))}
          </TriageCard>
        </div>
      </section>

      {/* ─── Active Pipeline ───────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          🔥 Active Pipeline
        </h2>
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3 min-w-max">
            {PIPELINE_COLUMNS.map((status) => {
              const jobs = pipelineByStatus[status] ?? [];
              return (
                <PipelineColumn key={status} status={status} jobs={jobs} />
              );
            })}
            <PipelineColumn
              status="completed"
              label="Completed (7d)"
              jobs={completedRecent}
              dim
            />
          </div>
        </div>
      </section>

      {/* ─── This Week ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          📊 This Week
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Calls Taken" value={callsThisWeek} href="/calls" />
          <StatCard label="Jobs Created" value={jobsThisWeek} href="/jobs" />
          <StatCard label="Jobs Completed" value={jobsCompletedThisWeek} href="/jobs" />
          <StatCard
            label="Lead → Mitigation+"
            value={`${conversionPct}%`}
            secondary={`${advancedCount} of ${last30.length} (30d)`}
          />
        </div>
      </section>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Components
// ───────────────────────────────────────────────────────────────────────

function TriageCard({
  title,
  subtitle,
  count,
  urgent,
  emptyMessage,
  viewAllHref,
  color = "red",
  children,
}: {
  title: string;
  subtitle: string;
  count: number;
  urgent: boolean;
  emptyMessage: string;
  viewAllHref?: string;
  color?: "red" | "amber";
  children: React.ReactNode;
}) {
  const accent =
    color === "red"
      ? urgent
        ? "border-red-500/40 bg-red-500/5"
        : "border-zinc-800 bg-zinc-900"
      : urgent
        ? "border-amber-500/40 bg-amber-500/5"
        : "border-zinc-800 bg-zinc-900";

  const numColor =
    count === 0
      ? "text-zinc-500"
      : color === "red"
        ? "text-red-400"
        : "text-amber-400";

  return (
    <div className={`border rounded-xl p-4 ${accent}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-white text-sm font-semibold">{title}</p>
          <p className="text-zinc-500 text-xs">{subtitle}</p>
        </div>
        <p className={`text-3xl font-bold ${numColor} leading-none`}>{count}</p>
      </div>
      {count === 0 ? (
        <p className="text-zinc-500 text-xs italic py-2">{emptyMessage}</p>
      ) : (
        <div className="flex flex-col gap-1">
          {children}
          {count > 5 && viewAllHref && (
            <Link
              href={viewAllHref}
              className="text-blue-400 hover:text-blue-300 text-xs mt-1 self-start"
            >
              View all {count} →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function TriageRow({
  href,
  primary,
  secondary,
  meta,
  metaCta,
  badge,
}: {
  href: string;
  primary: string;
  secondary: string;
  meta: string;
  metaCta?: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-2 px-2 py-1.5 -mx-2 rounded hover:bg-zinc-800/60 transition-colors group"
    >
      <div className="min-w-0 flex-1">
        <p className="text-blue-400 group-hover:text-blue-300 font-mono text-xs truncate">
          {primary}
        </p>
        <p className="text-zinc-300 text-xs truncate">{secondary}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {badge && (
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${STATUS_COLORS[badge] ?? "bg-zinc-700 text-zinc-300"}`}
          >
            {badge}
          </span>
        )}
        <span className="text-zinc-500 text-xs whitespace-nowrap">
          {metaCta ?? meta}
        </span>
      </div>
    </Link>
  );
}

function PipelineColumn({
  status,
  label,
  jobs,
  dim,
}: {
  status: string;
  label?: string;
  jobs: any[];
  dim?: boolean;
}) {
  const statusColor = STATUS_COLORS[status] ?? "bg-zinc-700 text-zinc-300";
  return (
    <div
      className={`w-64 shrink-0 bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col ${dim ? "opacity-70" : ""}`}
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800 sticky top-0 bg-zinc-900 rounded-t-xl">
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColor}`}
        >
          {label ?? status}
        </span>
        <span className="text-zinc-400 text-xs font-mono">{jobs.length}</span>
      </div>
      <div className="p-2 flex flex-col gap-1.5 max-h-[420px] overflow-y-auto">
        {jobs.length === 0 ? (
          <p className="text-zinc-600 text-xs italic text-center py-4">empty</p>
        ) : (
          jobs.map((job) => {
            const days = daysSince(job.updated_at);
            const stale = days >= 3 && status !== "completed";
            return (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className={`block px-2.5 py-2 rounded-lg border transition-colors ${
                  stale
                    ? "bg-amber-500/5 border-amber-500/30 hover:bg-amber-500/10"
                    : "bg-zinc-800/50 border-zinc-700/50 hover:bg-zinc-800"
                }`}
              >
                <p className="text-blue-400 font-mono text-xs">{job.job_number}</p>
                <p className="text-white text-xs truncate mt-0.5">
                  {(job.customers as any)?.name ?? "—"}
                </p>
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-zinc-500 text-[10px]">
                    {job.site_city ?? "—"}
                  </p>
                  <p className={`text-[10px] ${stale ? "text-amber-400" : "text-zinc-500"}`}>
                    {days === 0 ? "today" : `${days}d`}
                  </p>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  secondary,
  href,
}: {
  label: string;
  value: number | string;
  secondary?: string;
  href?: string;
}) {
  const inner = (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors h-full">
      <p className="text-zinc-400 text-xs uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold text-white mt-1.5">{value}</p>
      {secondary && <p className="text-zinc-500 text-xs mt-1">{secondary}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}
