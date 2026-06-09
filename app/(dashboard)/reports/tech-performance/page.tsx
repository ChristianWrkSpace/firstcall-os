import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getDataCutoff } from "@/lib/data-cutoff";
import { requireRoles } from "@/components/RoleGate";
import { PageShell, Glass } from "@/components/ui/Glass";

const fmt = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const filterActive = "bg-white/[0.08] text-white ring-1 ring-[#5FBDB0]/25";
const filterIdle = "bg-white/[0.03] text-white/50 hover:bg-white/[0.06] hover:text-white";

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
    <PageShell
      eyebrow="Reports"
      title="Tech Performance"
      subtitle="Hours, jobs touched, and revenue contribution per tech. Sorted by revenue per hour (efficiency proxy)."
      action={
        <div className="flex items-center gap-2">
          <Link
            href="/reports"
            className="px-3 py-1.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.05] text-white/70 text-sm transition-colors"
          >
            ← Reports
          </Link>
          <div className="flex items-center gap-1">
            {[7, 30, 90, 365].map((d) => (
              <Link
                key={d}
                href={`/reports/tech-performance?window=${d}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  windowDays === d ? filterActive : filterIdle
                }`}
              >
                {d === 365 ? "1y" : `${d}d`}
              </Link>
            ))}
          </div>
        </div>
      }
      width="full"
    >
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Tile label="Total Hours" value={`${totalHours.toFixed(1)}h`} sub={`${rows.length} techs`} />
        <Tile label="Total Labor Cost" value={fmt(totalLaborCost)} color="text-orange-300" />
        <Tile label="Revenue Touched" value={fmt(totalRevenue)} color="text-emerald-300" sub="jobs the tech worked on" />
        <Tile
          label="Avg Revenue / Hour"
          value={fmt(avgRevenuePerHour)}
          color={avgRevenuePerHour >= 100 ? "text-emerald-300" : avgRevenuePerHour >= 60 ? "text-amber-300" : "text-red-300"}
        />
      </div>

      {/* Per-tech table */}
      <Glass className="overflow-x-auto">
        {rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-white/40 text-sm">
            No labor logged in this window. Log hours from any job's P&L section.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-white/40 text-xs uppercase tracking-wide">
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
                    ? "text-white/35"
                    : r.revenuePerHour >= 100
                      ? "text-emerald-300"
                      : r.revenuePerHour >= 60
                        ? "text-amber-300"
                        : "text-red-300";
                return (
                  <tr
                    key={r.profileId}
                    className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.04]"
                  >
                    <td className="px-4 py-3 text-white/90 font-medium">{r.name}</td>
                    <td className="px-4 py-3 text-right text-white/70 font-mono text-xs">
                      {r.hours.toFixed(1)}h
                    </td>
                    <td className="px-4 py-3 text-right text-white/70 font-mono text-xs">
                      {fmt(r.laborCost)}
                    </td>
                    <td className="px-4 py-3 text-right text-white/70 font-mono text-xs">
                      {r.jobsTouched}
                    </td>
                    <td className="px-4 py-3 text-right text-white/45 font-mono text-xs">
                      {r.avgHoursPerJob != null ? `${r.avgHoursPerJob.toFixed(1)}h` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-white/90 font-mono text-xs">
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
      </Glass>

      <Glass subtle className="mt-6 p-4 text-white/40 text-xs leading-relaxed">
        <p className="text-white/70 text-sm font-semibold mb-1">Reading the table</p>
        <p>
          <strong className="text-white/70">$/Hour</strong> is the revenue on the jobs a tech touched,
          divided by their logged hours on those jobs. It's a proxy for productivity, not a perfect
          one — a tech who takes a single big-ticket job will look better than one running many
          smaller ones. Use it directionally and combined with <strong>Jobs Touched</strong> +{" "}
          <strong>Avg Hrs/Job</strong> for context.
        </p>
        <p className="mt-2">
          Numbers are only as honest as the labor entries. Log hours every shift to keep this real.
        </p>
      </Glass>
    </PageShell>
  );
}

function Tile({
  label,
  value,
  sub,
  color = "text-white/95",
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <Glass className="p-4">
      <p className="text-white/40 text-xs uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold font-mono mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-white/40 text-xs mt-1">{sub}</p>}
    </Glass>
  );
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
