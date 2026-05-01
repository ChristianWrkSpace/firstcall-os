import { computeJobPnl } from "@/lib/job-pnl";

const fmt = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const pct = (n: number | null) =>
  n == null ? "—" : `${(n * 100).toFixed(1)}%`;

export default async function JobPnlCard({ jobId }: { jobId: string }) {
  const pnl = await computeJobPnl(jobId);
  if (!pnl) return null;

  // Per-job overhead is intentionally NOT computed here — overhead is a
  // portfolio concept (proportional to revenue across a window). This card
  // shows GROSS profit (revenue − COGS), which is the right per-job number.
  const grossColor =
    pnl.grossProfit >= 0
      ? pnl.grossMarginPct != null && pnl.grossMarginPct >= 0.4
        ? "text-green-400"
        : pnl.grossMarginPct != null && pnl.grossMarginPct >= 0.2
          ? "text-blue-400"
          : "text-yellow-400"
      : "text-red-400";

  return (
    <div className="flex flex-col gap-3">
      {/* Top headline */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Tile label="Revenue (billed)" value={fmt(pnl.revenueBilled)} />
        <Tile
          label="Total COGS"
          value={fmt(pnl.totalCogs)}
          color="text-orange-400"
        />
        <Tile
          label="Gross Profit"
          value={fmt(pnl.grossProfit)}
          color={grossColor}
        />
        <Tile
          label="Gross Margin"
          value={pct(pnl.grossMarginPct)}
          color={grossColor}
        />
      </div>

      {/* Cost waterfall — full breakdown */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4">
        <p className="text-zinc-400 text-xs uppercase tracking-wide mb-3 font-semibold">
          Where the money goes
        </p>
        <div className="flex flex-col gap-1.5 text-sm">
          <Line
            label="Revenue billed"
            value={pnl.revenueBilled}
            color="text-green-400"
            bold
          />
          <Line
            label="− Tech labor"
            sub={`${pnl.laborHours.toFixed(1)} hrs logged`}
            value={-pnl.laborCost}
          />
          <Line
            label="− Consumables"
            value={-pnl.consumablesCost}
          />
          <Line
            label="− Equipment"
            sub={`${pnl.equipmentDays.toFixed(1)} equip-days`}
            value={-pnl.equipmentCost}
          />
          <Line
            label="− Van allocation"
            value={-pnl.vanCost}
          />
          <div className="border-t border-zinc-700 pt-1.5 mt-1">
            <Line
              label="= Gross profit"
              value={pnl.grossProfit}
              color={grossColor}
              bold
            />
          </div>
        </div>
      </div>

      {/* Cash position */}
      <div className="grid grid-cols-3 gap-2">
        <SmallTile
          label="Collected"
          value={fmt(pnl.revenueCollected)}
          color="text-green-400"
        />
        <SmallTile
          label="Open Balance"
          value={fmt(pnl.revenueOpenBalance)}
          color={pnl.revenueOpenBalance > 0 ? "text-yellow-400" : "text-zinc-500"}
        />
        <SmallTile
          label="Deferred Cash"
          value={pnl.grossProfit > 0 && pnl.revenueOpenBalance > 0 ? fmt(Math.min(pnl.grossProfit, pnl.revenueOpenBalance)) : "—"}
          color="text-zinc-400"
          hint="Profit you've earned but not yet collected"
        />
      </div>

      {pnl.totalCogs === pnl.vanCost && pnl.revenueBilled > 0 && (
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3 text-xs text-yellow-200">
          ⚠ COGS = van allocation only. Log labor + consumables on this job
          for an honest gross profit number.
        </div>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  color = "text-white",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
      <p className="text-zinc-500 text-[10px] uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-bold font-mono mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}

function SmallTile({
  label,
  value,
  color = "text-white",
  hint,
}: {
  label: string;
  value: string;
  color?: string;
  hint?: string;
}) {
  return (
    <div className="bg-zinc-800/30 border border-zinc-700/40 rounded-lg p-2.5" title={hint}>
      <p className="text-zinc-500 text-[9px] uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-bold font-mono mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}

function Line({
  label,
  sub,
  value,
  color = "text-zinc-200",
  bold,
}: {
  label: string;
  sub?: string;
  value: number;
  color?: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <div>
        <span className={bold ? "text-white font-semibold" : "text-zinc-300"}>{label}</span>
        {sub && <span className="text-zinc-600 text-[11px] ml-2">{sub}</span>}
      </div>
      <span className={`font-mono ${color} ${bold ? "font-semibold" : ""}`}>
        {fmt(value)}
      </span>
    </div>
  );
}
