import { createServerSupabaseClient } from "@/lib/supabase-server";
import Link from "next/link";
import { requireRoles } from "@/components/RoleGate";

const fmt = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const fmtDays = (d: number | null) => (d == null ? "—" : `${d}d`);

interface JobRow {
  jobId: string;
  jobNumber: string | null;
  customerName: string;
  carrier: string | null;
  paymentRoute: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  daysOnJob: number | null;            // intake → completion (or now)
  daysToCollect: number | null;        // sent_at → fully-paid (only when paid)
  revenueBilled: number;               // sum of sent invoice line items
  revenueCollected: number;            // sum of payments
  openBalance: number;                 // billed - collected
  equipmentDays: number;               // sum of (retrieved-deployed) per assignment, in days
  equipmentRevenuePerDay: number | null; // revenue / equipment days, signal of efficiency
}

export default async function JobEconomicsPage() {
  await requireRoles(["owner", "manager"]);
  const supabase = await createServerSupabaseClient();

  // Pull all jobs of any status (we want signal across active + completed)
  const { data: jobs } = await supabase
    .from("jobs")
    .select(
      `id,
       job_number,
       status,
       payment_route,
       created_at,
       completed_at,
       customers(name, insurance_company),
       invoices(id, status, sent_at, line_items:invoice_line_items(line_total), payments(amount, created_at)),
       equipment_assignments(deployed_at, retrieved_at)`
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const rows: JobRow[] = [];

  for (const j of (jobs ?? []) as any[]) {
    let revenueBilled = 0;
    let revenueCollected = 0;
    let openBalance = 0;
    let daysToCollect: number | null = null;

    for (const inv of j.invoices ?? []) {
      if (inv.status === "void") continue;
      const total = (inv.line_items ?? []).reduce(
        (s: number, li: any) => s + Number(li.line_total ?? 0),
        0
      );
      const paid = (inv.payments ?? []).reduce(
        (s: number, p: any) => s + Number(p.amount ?? 0),
        0
      );
      if (inv.sent_at) {
        revenueBilled += total;
        revenueCollected += paid;
        openBalance += Math.max(0, total - paid);

        const isFullyPaid = paid >= total - 0.005 && total > 0;
        if (isFullyPaid) {
          const lastPaymentAt = (inv.payments ?? [])
            .map((p: any) => p.created_at)
            .filter(Boolean)
            .sort()
            .pop();
          if (lastPaymentAt) {
            const days = Math.max(
              0,
              Math.floor(
                (new Date(lastPaymentAt).getTime() -
                  new Date(inv.sent_at).getTime()) /
                  86_400_000
              )
            );
            // Use the longest fully-paid invoice's days-to-collect for this job
            daysToCollect = Math.max(daysToCollect ?? 0, days);
          }
        }
      }
    }

    let equipmentDays = 0;
    for (const a of j.equipment_assignments ?? []) {
      if (!a.deployed_at) continue;
      const start = new Date(a.deployed_at).getTime();
      const end = a.retrieved_at ? new Date(a.retrieved_at).getTime() : Date.now();
      equipmentDays += Math.max(0, (end - start) / 86_400_000);
    }

    const endTime = j.completed_at
      ? new Date(j.completed_at).getTime()
      : Date.now();
    const daysOnJob = Math.max(
      0,
      Math.floor((endTime - new Date(j.created_at).getTime()) / 86_400_000)
    );

    const equipmentRevenuePerDay =
      equipmentDays > 0 ? revenueBilled / equipmentDays : null;

    rows.push({
      jobId: j.id,
      jobNumber: j.job_number,
      customerName: j.customers?.name ?? "—",
      carrier: j.customers?.insurance_company ?? null,
      paymentRoute: j.payment_route ?? "customer_pay",
      status: j.status,
      createdAt: j.created_at,
      completedAt: j.completed_at,
      daysOnJob,
      daysToCollect,
      revenueBilled,
      revenueCollected,
      openBalance,
      equipmentDays: Math.round(equipmentDays * 10) / 10,
      equipmentRevenuePerDay,
    });
  }

  // Default sort: revenue desc
  rows.sort((a, b) => b.revenueBilled - a.revenueBilled);

  // ─── Headline KPIs ─────────────────────────────────────────────────
  const completed = rows.filter((r) => r.status === "completed");
  const billedJobs = rows.filter((r) => r.revenueBilled > 0);
  const avgRevenue =
    billedJobs.length > 0
      ? billedJobs.reduce((s, r) => s + r.revenueBilled, 0) / billedJobs.length
      : 0;
  const avgDaysOnJob =
    completed.length > 0
      ? completed.reduce((s, r) => s + (r.daysOnJob ?? 0), 0) / completed.length
      : 0;
  const collectedJobs = rows.filter((r) => r.daysToCollect != null);
  const avgDaysToCollect =
    collectedJobs.length > 0
      ? collectedJobs.reduce((s, r) => s + (r.daysToCollect ?? 0), 0) /
        collectedJobs.length
      : 0;
  const avgEquipmentDays =
    completed.length > 0
      ? completed.reduce((s, r) => s + r.equipmentDays, 0) / completed.length
      : 0;

  // ─── Slowest 3 jobs to dry (signal: equipment over-stayed) ─────────
  const slowest = [...rows]
    .filter((r) => r.equipmentDays > 0)
    .sort((a, b) => b.equipmentDays - a.equipmentDays)
    .slice(0, 3);

  // ─── Top 3 efficient jobs (highest revenue per equipment-day) ──────
  const mostEfficient = [...rows]
    .filter((r) => r.equipmentRevenuePerDay != null && r.equipmentDays >= 1)
    .sort(
      (a, b) =>
        (b.equipmentRevenuePerDay ?? 0) - (a.equipmentRevenuePerDay ?? 0)
    )
    .slice(0, 3);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <Link
          href="/reports"
          className="text-zinc-500 hover:text-white text-sm transition-colors"
        >
          ← Reports
        </Link>
        <h1 className="text-2xl font-bold text-white mt-2">Job Economics</h1>
        <p className="text-zinc-400 text-sm mt-0.5">
          Revenue, cycle time, and equipment utilization per job. Last 200 jobs.
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Tile label="Avg Revenue / Job" value={fmt(avgRevenue)} sub={`${billedJobs.length} billed`} />
        <Tile
          label="Avg Days on Job"
          value={`${Math.round(avgDaysOnJob)}d`}
          sub={`${completed.length} completed`}
          color={avgDaysOnJob > 14 ? "text-yellow-400" : "text-white"}
        />
        <Tile
          label="Avg Days to Collect"
          value={`${Math.round(avgDaysToCollect)}d`}
          sub={`${collectedJobs.length} fully paid`}
          color={
            avgDaysToCollect > 60
              ? "text-red-400"
              : avgDaysToCollect > 30
                ? "text-yellow-400"
                : "text-green-400"
          }
        />
        <Tile
          label="Avg Equipment Days"
          value={`${avgEquipmentDays.toFixed(1)}d`}
          sub="per completed job"
        />
      </div>

      {/* Insights row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {slowest.length > 0 && (
          <InsightCard
            title="🐢 Longest Equipment Stays"
            note="Equipment on site longest. Investigate why drying took so long — bigger losses, undersized equipment, or simply forgotten?"
          >
            {slowest.map((r) => (
              <li key={r.jobId} className="flex items-center justify-between gap-2 text-sm">
                <Link href={`/jobs/${r.jobId}`} className="text-blue-400 hover:underline font-mono text-xs truncate">
                  {r.jobNumber}
                </Link>
                <span className="text-zinc-300 truncate flex-1 mx-2">{r.customerName}</span>
                <span className="text-yellow-400 font-mono text-xs whitespace-nowrap">{r.equipmentDays.toFixed(1)}d</span>
              </li>
            ))}
          </InsightCard>
        )}
        {mostEfficient.length > 0 && (
          <InsightCard
            title="⚡ Most Efficient Jobs"
            note="Highest revenue per equipment-day. Pattern-match these — what made them quick + profitable?"
          >
            {mostEfficient.map((r) => (
              <li key={r.jobId} className="flex items-center justify-between gap-2 text-sm">
                <Link href={`/jobs/${r.jobId}`} className="text-blue-400 hover:underline font-mono text-xs truncate">
                  {r.jobNumber}
                </Link>
                <span className="text-zinc-300 truncate flex-1 mx-2">{r.customerName}</span>
                <span className="text-green-400 font-mono text-xs whitespace-nowrap">
                  {fmt(r.equipmentRevenuePerDay ?? 0)}/d
                </span>
              </li>
            ))}
          </InsightCard>
        )}
      </div>

      {/* Per-job table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
        {rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-zinc-500 text-sm">
            No jobs yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Job #</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Carrier</th>
                <th className="px-4 py-3 text-right">Days on Job</th>
                <th className="px-4 py-3 text-right">Equipment Days</th>
                <th className="px-4 py-3 text-right">Days to Collect</th>
                <th className="px-4 py-3 text-right">Billed</th>
                <th className="px-4 py-3 text-right">Collected</th>
                <th className="px-4 py-3 text-right">$/Equip-Day</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 50).map((r) => (
                <tr
                  key={r.jobId}
                  className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/40 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/jobs/${r.jobId}`}
                      className="text-blue-400 hover:underline font-mono text-xs"
                    >
                      {r.jobNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-200 text-xs truncate max-w-[140px]">
                    {r.customerName}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs truncate max-w-[120px]">
                    {r.carrier ?? "Self-pay"}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-300 font-mono text-xs">
                    {fmtDays(r.daysOnJob)}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-300 font-mono text-xs">
                    {r.equipmentDays > 0 ? `${r.equipmentDays.toFixed(1)}d` : "—"}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono text-xs ${
                      r.daysToCollect == null
                        ? "text-zinc-500"
                        : r.daysToCollect > 60
                          ? "text-red-400"
                          : r.daysToCollect > 30
                            ? "text-yellow-400"
                            : "text-green-400"
                    }`}
                  >
                    {fmtDays(r.daysToCollect)}
                  </td>
                  <td className="px-4 py-3 text-right text-white font-mono text-xs">
                    {r.revenueBilled > 0 ? fmt(r.revenueBilled) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-300 font-mono text-xs">
                    {r.revenueCollected > 0 ? fmt(r.revenueCollected) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-400 font-mono text-xs">
                    {r.equipmentRevenuePerDay != null
                      ? fmt(r.equipmentRevenuePerDay)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Honest caveat */}
      <div className="mt-6 bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 text-zinc-500 text-xs leading-relaxed">
        <p className="text-zinc-300 text-sm font-semibold mb-1">What this is — and isn't</p>
        <p>
          This is <strong className="text-zinc-300">revenue + cycle-time + utilization</strong>, not true margin.
          We don't yet track labor hours or consumables (poly, antimicrobial, gloves) per job, so we can't
          compute gross margin. <span className="text-zinc-400">$/Equip-Day</span> is the closest proxy
          we have for efficiency — high values mean you billed a lot for the equipment-time you spent.
          When labor + consumables tracking ships, this page becomes a true margin dashboard.
        </p>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  color = "text-white",
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <p className="text-zinc-500 text-xs uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold font-mono mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-zinc-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

function InsightCard({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <p className="text-white text-sm font-semibold mb-1">{title}</p>
      <p className="text-zinc-500 text-xs mb-3 leading-relaxed">{note}</p>
      <ul className="flex flex-col gap-1.5">{children}</ul>
    </div>
  );
}
