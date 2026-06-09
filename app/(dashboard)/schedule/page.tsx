import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getDataCutoff } from "@/lib/data-cutoff";
import Link from "next/link";
import { STATUS_COLORS } from "@/lib/constants";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function dayKey(d: Date) {
  return d.toISOString().split("T")[0];
}

function dayLabel(d: Date, today: Date) {
  if (dayKey(d) === dayKey(today)) return "Today";
  if (dayKey(d) === dayKey(addDays(today, 1))) return "Tomorrow";
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; days?: string }>;
}) {
  const { start, days } = await searchParams;
  const supabase = await createServerSupabaseClient();

  const today = startOfDay(new Date());
  const startDate = start ? startOfDay(new Date(start)) : today;
  const numDays = Math.min(Math.max(parseInt(days ?? "7"), 1), 30);
  const endDate = addDays(startDate, numDays);

  const cutoff = getDataCutoff();

  // Fetch all scheduled jobs in window + unscheduled active jobs separately
  let scheduledQuery = supabase
    .from("jobs")
    .select(
      "id, job_number, status, type, scheduled_at, site_address, site_city, customers(name), assignments:job_assignments(id, profiles(id, name))"
    )
    .gte("scheduled_at", startDate.toISOString())
    .lt("scheduled_at", endDate.toISOString())
    .not("status", "in", "(completed,cancelled)")
    .order("scheduled_at", { ascending: true });
  if (cutoff) scheduledQuery = scheduledQuery.gte("created_at", cutoff);

  let unscheduledQuery = supabase
    .from("jobs")
    .select(
      "id, job_number, status, type, site_address, site_city, customers(name), assignments:job_assignments(id, profiles(id, name))"
    )
    .is("scheduled_at", null)
    .not("status", "in", "(completed,cancelled)")
    .order("created_at", { ascending: false })
    .limit(50);
  if (cutoff) unscheduledQuery = unscheduledQuery.gte("created_at", cutoff);

  const [{ data: scheduledJobs }, { data: unscheduledJobs }] = await Promise.all([
    scheduledQuery,
    unscheduledQuery,
  ]);

  // Group scheduled jobs by day
  const byDay: Record<string, any[]> = {};
  for (let i = 0; i < numDays; i++) {
    byDay[dayKey(addDays(startDate, i))] = [];
  }
  for (const j of scheduledJobs ?? []) {
    const d = dayKey(new Date(j.scheduled_at));
    if (byDay[d]) byDay[d].push(j);
  }

  const prevStart = dayKey(addDays(startDate, -numDays));
  const nextStart = dayKey(endDate);

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Schedule</h1>
          <p className="text-ink-2 text-sm mt-0.5">
            {startDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })}{" "}
            – {addDays(endDate, -1).toLocaleDateString("en-US", { month: "long", day: "numeric" })}
            <span className="text-ink-3"> · </span>
            <span className="text-ink-3">{scheduledJobs?.length ?? 0} scheduled</span>
            {(unscheduledJobs?.length ?? 0) > 0 && (
              <>
                <span className="text-ink-3"> · </span>
                <span className="text-honey">
                  {unscheduledJobs?.length} unscheduled
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/schedule?start=${prevStart}&days=${numDays}`}
            className="px-3 py-1.5 bg-shade hover:bg-shade text-ink-2 text-sm rounded-lg"
          >
            ← Prev
          </Link>
          <Link
            href="/schedule"
            className="px-3 py-1.5 bg-shade hover:bg-shade text-ink-2 text-sm rounded-lg"
          >
            Today
          </Link>
          <Link
            href={`/schedule?start=${nextStart}&days=${numDays}`}
            className="px-3 py-1.5 bg-shade hover:bg-shade text-ink-2 text-sm rounded-lg"
          >
            Next →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Schedule (week agenda) */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          {Object.entries(byDay).map(([dateKey, jobs]) => {
            const date = new Date(dateKey);
            const isToday = dayKey(date) === dayKey(today);
            const isPast = date < today;
            return (
              <section
                key={dateKey}
                className={`bg-card border rounded-xl p-4 ${
                  isToday
                    ? "border-info/40"
                    : isPast
                      ? "border-edge2 opacity-60"
                      : "border-edge2"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <p
                    className={`text-sm font-semibold ${
                      isToday ? "text-info" : "text-ink"
                    }`}
                  >
                    {dayLabel(date, today)}
                  </p>
                  <p className="text-ink-3 text-xs">
                    {jobs.length} {jobs.length === 1 ? "job" : "jobs"}
                  </p>
                </div>
                {jobs.length === 0 ? (
                  <p className="text-ink-3 text-xs italic">Nothing scheduled</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {jobs.map((j: any) => (
                      <ScheduledJobCard key={j.id} job={j} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {/* Unscheduled jobs */}
        <div className="flex flex-col gap-3">
          <section className="glass-card p-4">
            <div className="mb-3">
              <p className="text-ink text-sm font-semibold">
                ⏳ Unscheduled
              </p>
              <p className="text-ink-3 text-xs mt-0.5">
                Active jobs without a scheduled time
              </p>
            </div>
            {(unscheduledJobs?.length ?? 0) === 0 ? (
              <p className="text-ink-3 text-xs italic">All active jobs scheduled.</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto">
                {unscheduledJobs!.map((j: any) => (
                  <UnscheduledCard key={j.id} job={j} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function ScheduledJobCard({ job }: { job: any }) {
  const time = new Date(job.scheduled_at).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  const techNames =
    (job.assignments ?? [])
      .map((a: any) => a.profiles?.name)
      .filter(Boolean)
      .join(", ") || "no tech assigned";

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="flex items-center gap-3 px-3 py-2 bg-tint border border-edge2 rounded-lg hover:bg-shade transition-colors"
    >
      <div className="text-ink-2 text-xs font-mono w-16 shrink-0">{time}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-info font-mono text-xs">{job.job_number}</span>
          <span
            className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${STATUS_COLORS[job.status] ?? ""}`}
          >
            {job.status}
          </span>
        </div>
        <p className="text-ink text-sm truncate mt-0.5">
          {job.customers?.name ?? "—"}
        </p>
        <p className="text-ink-3 text-xs truncate">
          {[job.site_address, job.site_city].filter(Boolean).join(", ")}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p
          className={`text-xs ${
            (job.assignments ?? []).length === 0
              ? "text-honey"
              : "text-ink-2"
          }`}
        >
          👷 {techNames}
        </p>
      </div>
    </Link>
  );
}

function UnscheduledCard({ job }: { job: any }) {
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="flex items-center justify-between px-3 py-2 bg-tint border border-edge2 rounded-lg hover:bg-shade transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-info font-mono text-xs">{job.job_number}</span>
          <span
            className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${STATUS_COLORS[job.status] ?? ""}`}
          >
            {job.status}
          </span>
        </div>
        <p className="text-ink text-sm truncate mt-0.5">
          {job.customers?.name ?? "—"}
        </p>
        <p className="text-ink-3 text-xs truncate capitalize">{job.type}</p>
      </div>
    </Link>
  );
}
