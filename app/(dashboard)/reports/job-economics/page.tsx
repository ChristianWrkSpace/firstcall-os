import Link from "next/link";
import { requireRoles } from "@/components/RoleGate";
import { computePortfolioPnl } from "@/lib/job-pnl";

const fmt = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const pct = (n: number | null) =>
  n == null ? "—" : `${(n * 100).toFixed(1)}%`;

const WINDOWS = [
  { d: 7, label: "7d" },
  { d: 30, label: "30d" },
  { d: 90, label: "90d" },
  { d: 365, label: "YTD" },
];

const TYPES = [
  { v: "all", label: "All", icon: "📊" },
  { v: "water", label: "Water", icon: "💧" },
  { v: "fire", label: "Fire", icon: "🔥" },
  { v: "mold", label: "Mold", icon: "🦠" },
  { v: "storm", label: "Storm", icon: "⛈" },
  { v: "other", label: "Other", icon: "📦" },
];

export default async function JobEconomicsPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string; type?: string }>;
}) {
  await requireRoles(["owner", "manager"]);
  const params = await searchParams;
  const windowDays = Math.min(
    Math.max(parseInt(params.window ?? "30"), 7),
    365
  );
  const jobType = params.type && params.type !== "all" ? params.type : null;

  const pnl = await computePortfolioPnl({ windowDays, jobType });

  // Top + bottom net-profit performers
  const topPerformers = [...pnl.jobs]
    .filter((j) => j.revenueBilled > 0)
    .sort((a, b) => b.netProfit - a.netProfit)
    .slice(0, 3);
  const bottomPerformers = [...pnl.jobs]
    .filter((j) => j.revenueBilled > 0)
    .sort((a, b) => a.netProfit - b.netProfit)
    .slice(0, 3);

  // Sort table by net profit desc
  const sortedJobs = [...pnl.jobs].sort((a, b) => b.netProfit - a.netProfit);

  // Wisdom — applied principles based on actual data
  const wisdom = generateWisdom(pnl);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <Link href="/reports" className="text-zinc-500 hover:text-white text-sm transition-colors">
            ← Reports
          </Link>
          <h1 className="text-2xl font-bold text-white mt-2">Job Economics — Live P&L</h1>
          <p className="text-zinc-400 text-sm mt-0.5">
            True P&L: revenue minus all COGS minus allocated overhead. Tune cost basis at{" "}
            <Link href="/settings/cost-basis" className="text-blue-400 hover:underline">
              Settings → Cost Basis
            </Link>
            .
          </p>
        </div>
      </div>

      {/* Window + Type filters */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <div className="flex items-center gap-1">
          {WINDOWS.map((w) => (
            <Link
              key={w.d}
              href={`/reports/job-economics?window=${w.d}${jobType ? `&type=${jobType}` : ""}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                windowDays === w.d
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
              }`}
            >
              {w.label}
            </Link>
          ))}
        </div>
        <span className="text-zinc-700">·</span>
        <div className="flex items-center gap-1">
          {TYPES.map((t) => (
            <Link
              key={t.v}
              href={`/reports/job-economics?window=${windowDays}${t.v !== "all" ? `&type=${t.v}` : ""}`}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                (pnl.jobType === t.v || (pnl.jobType === "all" && t.v === "all"))
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
              }`}
            >
              {t.icon} {t.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Top KPI strip — the headline P&L */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Tile label="Revenue (billed)" value={fmt(pnl.totals.revenueBilled)} sub={`${pnl.totals.jobCount} jobs`} />
        <Tile
          label="Total COGS"
          value={fmt(pnl.totals.totalCogs)}
          sub={`Labor + Consumables + Equip + Van`}
          color="text-orange-400"
        />
        <Tile
          label="Gross Profit"
          value={fmt(pnl.totals.grossProfit)}
          sub={`Margin ${pct(pnl.totals.grossMarginPct)}`}
          color={
            pnl.totals.grossProfit < 0
              ? "text-red-400"
              : (pnl.totals.grossMarginPct ?? 0) >= 0.4
                ? "text-green-400"
                : "text-yellow-400"
          }
        />
        <Tile
          label="Net Profit"
          value={fmt(pnl.totals.netProfit)}
          sub={`After ${fmt(pnl.totals.overheadAllocated)} overhead · ${pct(pnl.totals.netMarginPct)}`}
          color={
            pnl.totals.netProfit < 0
              ? "text-red-400"
              : (pnl.totals.netMarginPct ?? 0) >= 0.2
                ? "text-green-400"
                : "text-yellow-400"
          }
        />
      </div>

      {/* What you have to work with */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 mb-5">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <p className="text-blue-300 text-xs uppercase tracking-wide font-semibold">
              What you have to work with
            </p>
            <p className="text-zinc-400 text-xs mt-0.5">
              Cash collected, minus COGS, minus overhead. The honest number.
            </p>
          </div>
          <p
            className={`text-3xl font-bold font-mono ${
              pnl.totals.revenueCollected - pnl.totals.totalCogs - pnl.totals.overheadAllocated >= 0
                ? "text-green-400"
                : "text-red-400"
            }`}
          >
            {fmt(pnl.totals.revenueCollected - pnl.totals.totalCogs - pnl.totals.overheadAllocated)}
          </p>
        </div>
      </div>

      {/* Per job-type breakdown */}
      {pnl.byType.length > 1 && (
        <div className="glass-card p-5 mb-5">
          <h2 className="text-white font-semibold mb-3">By Job Type</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-zinc-500 text-xs uppercase tracking-wide">
                  <th className="text-left px-3 py-2">Type</th>
                  <th className="text-right px-3 py-2">Jobs</th>
                  <th className="text-right px-3 py-2">Revenue</th>
                  <th className="text-right px-3 py-2">COGS</th>
                  <th className="text-right px-3 py-2">Gross</th>
                  <th className="text-right px-3 py-2">Net</th>
                  <th className="text-right px-3 py-2">Net Margin</th>
                </tr>
              </thead>
              <tbody>
                {pnl.byType.map((t) => (
                  <tr key={t.type} className="border-b border-white/[0.06] last:border-0">
                    <td className="px-3 py-2 text-white capitalize">{t.type}</td>
                    <td className="px-3 py-2 text-right text-zinc-400 font-mono text-xs">{t.jobCount}</td>
                    <td className="px-3 py-2 text-right text-white font-mono text-xs">{fmt(t.revenueBilled)}</td>
                    <td className="px-3 py-2 text-right text-orange-400 font-mono text-xs">{fmt(t.totalCogs)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{fmt(t.grossProfit)}</td>
                    <td
                      className={`px-3 py-2 text-right font-mono text-xs font-semibold ${
                        t.netProfit < 0
                          ? "text-red-400"
                          : (t.netMarginPct ?? 0) >= 0.2
                            ? "text-green-400"
                            : "text-yellow-400"
                      }`}
                    >
                      {fmt(t.netProfit)}
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-400 font-mono text-xs">{pct(t.netMarginPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top + Bottom */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        <PerformerCard title="🏆 Top Net Profit" rows={topPerformers} positive />
        <PerformerCard title="🔻 Lowest Net Profit" rows={bottomPerformers} positive={false} />
      </div>

      {/* Per-job table */}
      <div className="glass-card overflow-x-auto">
        {sortedJobs.length === 0 ? (
          <div className="px-5 py-10 text-center text-zinc-500 text-sm">
            No jobs in this window.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-zinc-500 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Job #</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-right">Revenue</th>
                <th className="px-4 py-3 text-right">Labor</th>
                <th className="px-4 py-3 text-right">Consum.</th>
                <th className="px-4 py-3 text-right">Equip.</th>
                <th className="px-4 py-3 text-right">Van</th>
                <th className="px-4 py-3 text-right">Gross</th>
                <th className="px-4 py-3 text-right">Net</th>
                <th className="px-4 py-3 text-right">Net %</th>
              </tr>
            </thead>
            <tbody>
              {sortedJobs.slice(0, 50).map((j) => (
                <tr
                  key={j.jobId}
                  className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.04] transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link href={`/jobs/${j.jobId}`} className="text-blue-400 hover:underline font-mono text-xs">
                      {j.jobNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-200 text-xs truncate max-w-[140px]">{j.customerName}</td>
                  <td className="px-4 py-3 text-zinc-400 text-xs capitalize">{j.jobType ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-white font-mono text-xs">{fmt(j.revenueBilled)}</td>
                  <td className="px-4 py-3 text-right text-zinc-400 font-mono text-xs">{fmt(j.laborCost)}</td>
                  <td className="px-4 py-3 text-right text-zinc-400 font-mono text-xs">{fmt(j.consumablesCost)}</td>
                  <td className="px-4 py-3 text-right text-zinc-400 font-mono text-xs">{fmt(j.equipmentCost)}</td>
                  <td className="px-4 py-3 text-right text-zinc-400 font-mono text-xs">{fmt(j.vanCost)}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">{fmt(j.grossProfit)}</td>
                  <td
                    className={`px-4 py-3 text-right font-mono text-xs font-semibold ${
                      j.netProfit < 0 ? "text-red-400" : "text-green-400"
                    }`}
                  >
                    {fmt(j.netProfit)}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-400 font-mono text-xs">{pct(j.netMarginPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Wisdom footer — generational principles applied to actual numbers */}
      <div className="mt-6 bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
        <p className="text-white text-sm font-semibold mb-3">📜 Principles Applied</p>
        <ul className="space-y-2.5">
          {wisdom.map((w, i) => (
            <li key={i} className="text-zinc-400 text-xs leading-relaxed">
              <span className="text-zinc-200 font-medium">{w.principle}</span>{" "}
              <span className="text-zinc-600">— {w.source}.</span>{" "}
              <span className="block mt-0.5 text-zinc-300">{w.action}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Honest caveat */}
      <div className="mt-5 bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 text-zinc-500 text-xs leading-relaxed">
        <p className="text-zinc-300 text-sm font-semibold mb-1">What this is</p>
        <p>
          A real P&L per job + portfolio. Revenue from sent invoices minus the COGS you log
          (labor entries, consumables) plus equipment-days × daily cost plus van allocation.
          Overhead is your monthly fixed cost prorated to the window, then allocated to each
          job proportionally to its billed revenue. Numbers are only as honest as your data
          entry — log labor and consumables every job to keep margins real.
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
    <div className="glass-card p-4">
      <p className="text-zinc-500 text-xs uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold font-mono mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-zinc-500 text-[10px] mt-1">{sub}</p>}
    </div>
  );
}

function PerformerCard({
  title,
  rows,
  positive,
}: {
  title: string;
  rows: Array<{
    jobId: string;
    jobNumber: string | null;
    customerName: string;
    netProfit: number;
    netMarginPct: number | null;
  }>;
  positive: boolean;
}) {
  return (
    <div className="glass-card p-4">
      <p className="text-white text-sm font-semibold mb-2">{title}</p>
      {rows.length === 0 ? (
        <p className="text-zinc-500 text-xs italic">Not enough data yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((r) => (
            <li key={r.jobId} className="flex items-center justify-between gap-2 text-sm">
              <Link href={`/jobs/${r.jobId}`} className="text-blue-400 hover:underline font-mono text-xs truncate">
                {r.jobNumber}
              </Link>
              <span className="text-zinc-300 truncate flex-1 mx-2 text-xs">{r.customerName}</span>
              <span
                className={`font-mono text-xs font-semibold whitespace-nowrap ${
                  positive
                    ? r.netProfit >= 0
                      ? "text-green-400"
                      : "text-yellow-400"
                    : r.netProfit < 0
                      ? "text-red-400"
                      : "text-yellow-400"
                }`}
              >
                {fmt(r.netProfit)} · {pct(r.netMarginPct)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface WisdomItem {
  principle: string;
  source: string;
  action: string;
}

function generateWisdom(pnl: Awaited<ReturnType<typeof computePortfolioPnl>>): WisdomItem[] {
  const out: WisdomItem[] = [];
  const collected = pnl.totals.revenueCollected;
  const open = pnl.totals.revenueBilled - collected;
  const net = pnl.totals.netProfit;

  // Pay yourself first (Babylonian / "Richest Man in Babylon" — Jewish-tradition rooted)
  if (net > 0) {
    const reserve = net * 0.10;
    out.push({
      principle: "Pay yourself first",
      source: "Babylonian wisdom (Richest Man in Babylon)",
      action: `Move ${fmt(reserve)} (10% of net) into a reserve account before allocating anything else this period. Future-you will thank present-you.`,
    });
  }

  // Honor the contract — pay obligations before they're due (Hadith on commerce)
  if (pnl.totals.totalCogs > 0) {
    out.push({
      principle: "Honor obligations early",
      source: "Hadith on commerce — 'pay the laborer his wage before his sweat dries'",
      action: `${fmt(pnl.totals.laborCost)} in tech labor logged this window. Pay payroll on time, every time — trust compounds.`,
    });
  }

  // Honest weights and measures (Torah, Leviticus 19:36)
  const lowMarginJobs = pnl.jobs.filter(
    (j) => j.revenueBilled > 0 && j.netMarginPct != null && j.netMarginPct < 0.10
  );
  if (lowMarginJobs.length >= 3) {
    out.push({
      principle: "Honest weights and measures",
      source: "Torah, Leviticus 19:36",
      action: `${lowMarginJobs.length} jobs ran below 10% net margin. Don't underbid to win — re-price the type, not the customer. The number doesn't lie.`,
    });
  }

  // Plant trees you won't sit under (Talmudic / generational thinking)
  if (net > 0) {
    const reinvest = net * 0.20;
    out.push({
      principle: "Plant trees you won't sit under",
      source: "Talmudic principle on long-horizon investing",
      action: `Reinvest ${fmt(reinvest)} (20% of net) into equipment, training, or marketing this period. The compounding only starts when you start.`,
    });
  }

  // Cash is real, profit is opinion — collect what you've earned
  if (open > collected * 0.30 && open > 1000) {
    out.push({
      principle: "Cash is real, profit is opinion",
      source: "Old accounting wisdom — cross-cultural",
      action: `${fmt(open)} sitting in A/R (${((open / Math.max(1, pnl.totals.revenueBilled)) * 100).toFixed(0)}% of billed). Send the demand letters. Money owed isn't money earned.`,
    });
  }

  // Diversify your income (Ecclesiastes 11:2 — "give a portion to seven, and also to eight")
  if (pnl.byType.length === 1 && pnl.totals.jobCount >= 5) {
    out.push({
      principle: "Diversify your work",
      source: "Ecclesiastes 11:2 — 'give a portion to seven, and also to eight'",
      action: `Every job in this window is one type. Concentration risk: one bad season hurts everyone. Hunter (the outreach agent) can drum up a different lane.`,
    });
  }

  // Default if nothing else surfaced
  if (out.length === 0) {
    out.push({
      principle: "Show up, log the data",
      source: "Generational craftsmen wisdom",
      action: "Not enough activity in this window to surface principles. Run jobs, log the costs, the patterns appear.",
    });
  }

  return out;
}
