import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getDataCutoff } from "@/lib/data-cutoff";
import { requireRoles } from "@/components/RoleGate";

const fmt = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

interface TechRow {
  profileId: string;
  name: string;
  hours: number;
  laborCost: number;
  jobsTouched: number;
  revenueOnJobs: number;     // sum of billed revenue on jobs the tech worked
  revenuePerHour: number | null;
  avgHoursPerJob: number | null;
}

export default async function TechPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  await requireRoles(["owner", "manager"]);
  const params = await searchParams;
  const windowDays = Math.min(Math.max(parseInt(params.window ?? "30"), 7), 365);
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString().slice(0, 10);

  const supabase = await createServerSupabaseClient();
  const cutoff = getDataCutoff();

  let laborQuery = supabase
    .from("tech_labor_entries")
    .select(
      `id, hours, hourly_rate, work_date, profile_id, created_at,
       profiles(name),
       jobs(id, type, invoices(status, sent_at, line_items:invoice_line_items(line_total)))`
    )
    .gte("work_date", since);
  if (cutoff) laborQuery = laborQuery.gte("created_at", cutoff);
  const { data: labor } = await laborQuery;

  // Aggregate per tech
  const map = new Map<string, {
    name: string;
    hours: number;
    laborCost: number;
    jobIds: Set<string>;
  }>();

  // Pre-compute per-job revenue once (a tech can have multiple entries per job)
  const jobRevenue = new Map<string, number>();

  for (const e of (labor ?? []) as any[]) {
    const profileId = e.profile_id;
    if (!profileId) continue;

    const job = Array.isArray(e.jobs) ? e.jobs[0] : e.jobs;
    const profile = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles;

    if (job?.id && !jobRevenue.has(job.id)) {
      let rev = 0;
      for (const inv of job.invoices ?? []) {
        if (inv.status === "void" || !inv.sent_at) continue;
        rev += (inv.line_items ?? []).reduce(
          (s: number, li: any) => s + Number(li.line_total ?? 0),
          0
        );
      }
      jobRevenue.set(job.id, rev);
    }

    const cur = map.get(profileId) ?? {
      name: profile?.name ?? "Unknown",
      hours: 0,
      laborCost: 0,
      jobIds: new Set<string>(),
    };
    cur.hours += Number(e.hours);
    cur.laborCost += Number(e.hours) * Number(e.hourly_rate);
    if (job?.id) cur.jobIds.add(job.id);
    map.set(profileId, cur);
  }

  const rows: TechRow[] = Array.from(map.entries()).map(([profileId, v]) => {
    let revenueOnJobs = 0;
    for (const jobId of v.jobIds) {
      revenueOnJobs += jobRevenue.get(jobId) ?? 0;
    }
    return {
      profileId,
      name: v.name,
      hours: round(v.hours),
      laborCost: round(v.laborCost),
      jobsTouched: v.jobIds.size,
      revenueOnJobs: round(revenueOnJobs),
      revenuePerHour: v.hours > 0 ? round(revenueOnJobs / v.hours) : null,
      avgHoursPerJob: v.jobIds.size > 0 ? round(v.hours / v.jobIds.size) : null,
    };
  });

  // Sort by revenue/hour desc (signal of efficiency)
  rows.sort((a, b) => (b.revenuePerHour ?? 0) - (a.revenuePerHour ?? 0));

  // Headline metrics
  const totalHours = rows.reduce((s, r) => s + r.hours, 0);
  const totalLaborCost = rows.reduce((s, r) => s + r.laborCost, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.revenueOnJobs, 0);
  const avgRevenuePerHour = totalHours > 0 ? totalRevenue / totalHours : 0;

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <Link href="/reports" className="text-ink-3 hover:text-ink text-sm transition-colors">
            ← Reports
          </Link>
          <h1 className="text-2xl font-bold text-ink mt-2">Tech Performance</h1>
          <p className="text-ink-2 text-sm mt-0.5">
            Hours, jobs touched, and revenue contribution per tech.
            Sorted by revenue per hour (efficiency proxy).
          </p>
        </div>
        <div className="flex items-center gap-1">
          {[7, 30, 90, 365].map((d) => (
            <Link
              key={d}
              href={`/reports/tech-performance?window=${d}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                windowDays === d
                  ? "bg-cta text-white"
                  : "bg-shade text-ink-2 hover:bg-shade hover:text-ink"
              }`}
            >
              {d === 365 ? "1y" : `${d}d`}
            </Link>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Tile label="Total Hours" value={`${totalHours.toFixed(1)}h`} sub={`${rows.length} techs`} />
        <Tile label="Total Labor Cost" value={fmt(totalLaborCost)} color="text-orange-700" />
        <Tile label="Revenue Touched" value={fmt(totalRevenue)} color="text-pine" sub="jobs the tech worked on" />
        <Tile
          label="Avg Revenue / Hour"
          value={fmt(avgRevenuePerHour)}
          color={avgRevenuePerHour >= 100 ? "text-pine" : avgRevenuePerHour >= 60 ? "text-honey" : "text-red-700"}
        />
      </div>

      {/* Per-tech table */}
      <div className="glass-card overflow-x-auto">
        {rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-ink-3 text-sm">
            No labor logged in this window. Log hours from any job's P&L section.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge2 text-ink-3 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Tech</th>
                <th className="px-4 py-3 text-right">Hours</th>
                <th className="px-4 py-3 text-right">Labor Cost</th>
                <th className="px-4 py-3 text-right">Jobs Touched</th>
                <th className="px-4 py-3 text-right">Avg Hrs/Job</th>
                <th className="px-4 py-3 text-right">Revenue Touched</th>
                <th className="px-4 py-3 text-right">$/Hour</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const rphColor =
                  r.revenuePerHour == null
                    ? "text-ink-3"
                    : r.revenuePerHour >= 100
                      ? "text-pine"
                      : r.revenuePerHour >= 60
                        ? "text-honey"
                        : "text-red-700";
                return (
                  <tr
                    key={r.profileId}
                    className="border-b border-edge2 last:border-0 hover:bg-shade"
                  >
                    <td className="px-4 py-3 text-ink font-medium">{r.name}</td>
                    <td className="px-4 py-3 text-right text-ink-2 font-mono text-xs">
                      {r.hours.toFixed(1)}h
                    </td>
                    <td className="px-4 py-3 text-right text-ink-2 font-mono text-xs">
                      {fmt(r.laborCost)}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-2 font-mono text-xs">
                      {r.jobsTouched}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-2 font-mono text-xs">
                      {r.avgHoursPerJob != null ? `${r.avgHoursPerJob.toFixed(1)}h` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-ink font-mono text-xs">
                      {fmt(r.revenueOnJobs)}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono text-xs font-semibold ${rphColor}`}>
                      {r.revenuePerHour != null ? fmt(r.revenuePerHour) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-6 bg-card border border-edge2 rounded-lg p-4 text-ink-3 text-xs leading-relaxed">
        <p className="text-ink-2 text-sm font-semibold mb-1">Reading the table</p>
        <p>
          <strong className="text-ink-2">$/Hour</strong> is the revenue on the jobs a tech touched,
          divided by their logged hours on those jobs. It's a proxy for productivity, not a perfect
          one — a tech who takes a single big-ticket job will look better than one running many
          smaller ones. Use it directionally and combined with <strong>Jobs Touched</strong> +{" "}
          <strong>Avg Hrs/Job</strong> for context.
        </p>
        <p className="mt-2">
          Numbers are only as honest as the labor entries. Log hours every shift to keep this real.
        </p>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  color = "text-ink",
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="glass-card p-4">
      <p className="text-ink-3 text-xs uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold font-mono mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-ink-3 text-xs mt-1">{sub}</p>}
    </div>
  );
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
