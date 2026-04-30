import { createServerSupabaseClient } from "@/lib/supabase-server";
import Link from "next/link";

const fmt = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const NDAYS_AGO = (n: number) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const { window: w } = await searchParams;
  const windowDays = Math.min(Math.max(parseInt(w ?? "30"), 7), 365);
  const since = NDAYS_AGO(windowDays);

  const supabase = await createServerSupabaseClient();

  const [
    { data: allJobs },
    { data: jobsInWindow },
    { data: callsInWindow },
    { data: estimatesInWindow },
    { data: invoicesAll },
    { data: payments30 },
  ] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, status, type, created_at, updated_at, completed_at, site_zip"),
    supabase
      .from("jobs")
      .select("id, status, type, created_at, updated_at, completed_at, site_zip, customers(insurance_company)")
      .gte("created_at", since),
    supabase
      .from("calls")
      .select("id, caller_type, created_at")
      .gte("created_at", since),
    supabase
      .from("estimates")
      .select("id, status, line_items:estimate_line_items(line_total)")
      .gte("created_at", since),
    supabase
      .from("invoices")
      .select(
        "id, status, sent_at, paid_at, created_at, line_items:invoice_line_items(line_total), payments(amount)"
      ),
    supabase
      .from("payments")
      .select("amount, received_at")
      .gte("received_at", NDAYS_AGO(30)),
  ]);

  // ─── Top KPIs ─────────────────────────────────────────────────────
  const jobsCreated = jobsInWindow?.length ?? 0;
  const callsTaken = callsInWindow?.length ?? 0;
  const jobsCompletedInWindow = (jobsInWindow ?? []).filter(
    (j) => j.status === "completed"
  ).length;

  const advancedStatuses = new Set([
    "mitigation",
    "drying",
    "reconstruction",
    "completed",
  ]);
  const advanced = (jobsInWindow ?? []).filter((j) =>
    advancedStatuses.has(j.status)
  ).length;
  const conversionPct =
    jobsCreated > 0 ? Math.round((advanced / jobsCreated) * 100) : 0;

  // Average lead → mitigation time (hours)
  // Best-effort: use updated_at as proxy for "moved to mitigation"; honest about its weakness
  const advancedJobsWithCreated = (jobsInWindow ?? []).filter((j) =>
    advancedStatuses.has(j.status)
  );
  const avgCycleHours =
    advancedJobsWithCreated.length > 0
      ? Math.round(
          advancedJobsWithCreated.reduce((sum, j) => {
            const created = new Date(j.created_at).getTime();
            const updated = new Date(j.updated_at).getTime();
            return sum + Math.max(0, (updated - created) / (1000 * 60 * 60));
          }, 0) / advancedJobsWithCreated.length
        )
      : 0;

  // ─── Revenue ─────────────────────────────────────────────────────
  const allInvoices = (invoicesAll ?? []).map((inv: any) => {
    const total = (inv.line_items ?? []).reduce(
      (s: number, li: any) => s + Number(li.line_total ?? 0),
      0
    );
    const paid = (inv.payments ?? []).reduce(
      (s: number, p: any) => s + Number(p.amount),
      0
    );
    return { ...inv, total, paid, balance: total - paid };
  });

  const billedInWindow = allInvoices
    .filter((i) => i.sent_at && new Date(i.sent_at) >= new Date(since))
    .reduce((s, i) => s + i.total, 0);

  const collected30 = (payments30 ?? []).reduce(
    (s, p) => s + Number(p.amount),
    0
  );

  const openAR = allInvoices
    .filter((i) => i.status !== "paid" && i.status !== "void" && i.sent_at)
    .reduce((s, i) => s + i.balance, 0);

  // ─── Avg Estimate Value ─────────────────────────────────────────
  const estimateTotals = (estimatesInWindow ?? [])
    .map(
      (e: any) =>
        (e.line_items ?? []).reduce(
          (s: number, li: any) => s + Number(li.line_total ?? 0),
          0
        ) as number
    )
    .filter((t) => t > 0);
  const avgEstimate =
    estimateTotals.length > 0
      ? estimateTotals.reduce((s, v) => s + v, 0) / estimateTotals.length
      : 0;

  // ─── Jobs by Type ─────────────────────────────────────────────────
  const byType = (jobsInWindow ?? []).reduce(
    (acc: Record<string, number>, j) => {
      acc[j.type ?? "other"] = (acc[j.type ?? "other"] ?? 0) + 1;
      return acc;
    },
    {}
  );

  // ─── Caller Type breakdown (partner vs customer) ─────────────────
  const byCaller = (callsInWindow ?? []).reduce(
    (acc: Record<string, number>, c) => {
      acc[c.caller_type ?? "customer"] = (acc[c.caller_type ?? "customer"] ?? 0) + 1;
      return acc;
    },
    {}
  );

  // ─── Top Zip Codes ─────────────────────────────────────────────────
  const zipCounts = (jobsInWindow ?? []).reduce(
    (acc: Record<string, number>, j) => {
      const z = j.site_zip ?? "—";
      acc[z] = (acc[z] ?? 0) + 1;
      return acc;
    },
    {}
  );
  const topZips = Object.entries(zipCounts)
    .filter(([z]) => z !== "—")
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // ─── Top Carriers ─────────────────────────────────────────────────
  const carrierCounts = (jobsInWindow ?? []).reduce(
    (acc: Record<string, number>, j: any) => {
      const c = j.customers?.insurance_company ?? "—";
      acc[c] = (acc[c] ?? 0) + 1;
      return acc;
    },
    {}
  );
  const topCarriers = Object.entries(carrierCounts)
    .filter(([c]) => c !== "—")
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // ─── Pipeline snapshot (current) ─────────────────────────────────
  const pipelineCounts = (allJobs ?? []).reduce(
    (acc: Record<string, number>, j) => {
      acc[j.status] = (acc[j.status] ?? 0) + 1;
      return acc;
    },
    {}
  );
  const pipelineOrder = [
    "lead",
    "inspection",
    "mitigation",
    "drying",
    "reconstruction",
    "completed",
    "cancelled",
  ];

  const windowOptions = [
    { d: 7, label: "7d" },
    { d: 30, label: "30d" },
    { d: 90, label: "90d" },
    { d: 365, label: "1y" },
  ];

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports</h1>
          <p className="text-zinc-400 text-sm mt-0.5">
            Operational + financial KPIs over the last {windowDays} days.
          </p>
        </div>
        <div className="flex items-center gap-1">
          {windowOptions.map((opt) => (
            <Link
              key={opt.d}
              href={`/reports?window=${opt.d}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                windowDays === opt.d
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
              }`}
            >
              {opt.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Top KPI strip */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KPI label="Calls Taken" value={callsTaken} />
        <KPI label="Jobs Created" value={jobsCreated} />
        <KPI
          label="Lead → Mitigation+"
          value={`${conversionPct}%`}
          secondary={`${advanced} of ${jobsCreated}`}
        />
        <KPI
          label="Avg Cycle"
          value={avgCycleHours > 0 ? `${avgCycleHours}h` : "—"}
          secondary="lead → mitigation+"
        />
      </section>

      {/* Money strip */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KPI label="Billed" value={fmt(billedInWindow)} secondary={`last ${windowDays}d`} accent="blue" />
        <KPI label="Collected" value={fmt(collected30)} secondary="last 30d" accent="green" />
        <KPI
          label="Avg Estimate"
          value={fmt(avgEstimate)}
          secondary={`${estimateTotals.length} estimates`}
        />
        <KPI label="Open AR" value={fmt(openAR)} secondary="all-time, sent only" accent="amber" />
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Pipeline */}
        <Section title="Current Pipeline">
          {pipelineOrder
            .filter((s) => (pipelineCounts[s] ?? 0) > 0)
            .map((s) => {
              const count = pipelineCounts[s] ?? 0;
              const total = (allJobs ?? []).length;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <BarRow
                  key={s}
                  label={s.replace(/_/g, " ")}
                  count={count}
                  pct={pct}
                />
              );
            })}
        </Section>

        {/* Jobs by Type */}
        <Section title="Jobs by Type" subtitle={`Last ${windowDays}d`}>
          {Object.entries(byType)
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => {
              const pct =
                jobsCreated > 0 ? Math.round((count / jobsCreated) * 100) : 0;
              return (
                <BarRow key={type} label={type} count={count} pct={pct} />
              );
            })}
          {Object.keys(byType).length === 0 && <Empty />}
        </Section>

        {/* Caller breakdown */}
        <Section title="Calls by Caller Type" subtitle={`Last ${windowDays}d`}>
          {Object.entries(byCaller)
            .sort((a, b) => b[1] - a[1])
            .map(([caller, count]) => {
              const pct =
                callsTaken > 0 ? Math.round((count / callsTaken) * 100) : 0;
              return (
                <BarRow key={caller} label={caller} count={count} pct={pct} />
              );
            })}
          {Object.keys(byCaller).length === 0 && <Empty />}
        </Section>

        {/* Top zips */}
        <Section title="Top Zip Codes" subtitle={`Last ${windowDays}d`}>
          {topZips.length === 0 ? (
            <Empty />
          ) : (
            topZips.map(([zip, count]) => (
              <div
                key={zip}
                className="flex items-center justify-between py-1.5 text-sm"
              >
                <span className="text-zinc-200 font-mono">{zip}</span>
                <span className="text-zinc-400 text-xs">
                  {count} {count === 1 ? "job" : "jobs"}
                </span>
              </div>
            ))
          )}
        </Section>

        {/* Top carriers */}
        <Section title="Top Insurance Carriers" subtitle={`Last ${windowDays}d`}>
          {topCarriers.length === 0 ? (
            <Empty />
          ) : (
            topCarriers.map(([carrier, count]) => (
              <div
                key={carrier}
                className="flex items-center justify-between py-1.5 text-sm"
              >
                <span className="text-zinc-200 truncate pr-2">{carrier}</span>
                <span className="text-zinc-400 text-xs whitespace-nowrap">
                  {count} {count === 1 ? "job" : "jobs"}
                </span>
              </div>
            ))
          )}
        </Section>

        {/* Completion */}
        <Section title="Completed Jobs" subtitle={`Last ${windowDays}d`}>
          <p className="text-3xl font-bold text-white font-mono">
            {jobsCompletedInWindow}
          </p>
          <p className="text-zinc-500 text-xs mt-1">
            of {jobsCreated} created in window ·{" "}
            {jobsCreated > 0
              ? Math.round((jobsCompletedInWindow / jobsCreated) * 100)
              : 0}
            % completion rate
          </p>
        </Section>
      </div>

      {/* Honesty footer */}
      <div className="mt-8 bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 text-zinc-500 text-xs leading-relaxed">
        <p className="text-zinc-300 text-sm font-semibold mb-1">
          Notes on the numbers
        </p>
        <p>
          "Avg Cycle" uses <code className="text-zinc-300">created_at</code> →{" "}
          <code className="text-zinc-300">updated_at</code> on jobs that reached
          mitigation+, which is a rough proxy. Once we track explicit status-change
          timestamps it'll get more precise. "Billed" / "Collected" only count
          invoices/payments after the Abacus migration ran. AR aging detail lives at{" "}
          <Link href="/ar" className="text-blue-400 hover:underline">
            /ar
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

function KPI({
  label,
  value,
  secondary,
  accent,
}: {
  label: string;
  value: number | string;
  secondary?: string;
  accent?: "blue" | "green" | "amber" | "red";
}) {
  const accentColor = accent
    ? {
        blue: "text-blue-400",
        green: "text-green-400",
        amber: "text-amber-400",
        red: "text-red-400",
      }[accent]
    : "text-white";
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <p className="text-zinc-500 text-xs uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${accentColor}`}>{value}</p>
      {secondary && (
        <p className="text-zinc-500 text-xs mt-1">{secondary}</p>
      )}
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="mb-3">
        <h3 className="text-white font-semibold text-sm">{title}</h3>
        {subtitle && <p className="text-zinc-500 text-xs">{subtitle}</p>}
      </div>
      <div>{children}</div>
    </section>
  );
}

function BarRow({
  label,
  count,
  pct,
}: {
  label: string;
  count: number;
  pct: number;
}) {
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-zinc-300 text-sm capitalize">{label}</span>
        <span className="text-zinc-400 text-xs font-mono">
          {count} · {pct}%
        </span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Empty() {
  return <p className="text-zinc-600 text-xs italic">No data in this window.</p>;
}
