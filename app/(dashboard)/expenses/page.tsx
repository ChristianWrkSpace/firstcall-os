import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requireRoles } from "@/components/RoleGate";
import ExpenseForm from "./ExpenseForm";
import DeleteButton from "./DeleteButton";

const fmt = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CATEGORY_META: Record<string, { label: string; emoji: string; color: string }> = {
  fuel:         { label: "Fuel",         emoji: "⛽", color: "bg-orange-500/15 text-orange-400" },
  maintenance:  { label: "Maintenance",  emoji: "🔧", color: "bg-yellow-500/15 text-yellow-400" },
  insurance:    { label: "Insurance",    emoji: "🛡",  color: "bg-blue-500/15 text-blue-400" },
  lease:        { label: "Lease",        emoji: "📄", color: "bg-purple-500/15 text-purple-400" },
  registration: { label: "Registration", emoji: "📋", color: "bg-zinc-700 text-zinc-300" },
  tolls:        { label: "Tolls",        emoji: "🛣",  color: "bg-zinc-700 text-zinc-300" },
  parking:      { label: "Parking",      emoji: "🅿",  color: "bg-zinc-700 text-zinc-300" },
  other:        { label: "Other",        emoji: "📦", color: "bg-zinc-700 text-zinc-300" },
};

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const me = await requireRoles(["owner", "manager", "office"]);
  const params = await searchParams;
  const windowDays = Math.min(Math.max(parseInt(params.window ?? "30"), 7), 365);
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString().slice(0, 10);

  const supabase = await createServerSupabaseClient();
  const { data: expenses } = await supabase
    .from("vehicle_expenses")
    .select("id, expense_date, category, amount, vehicle_id, notes")
    .gte("expense_date", since)
    .order("expense_date", { ascending: false });

  const totals = (expenses ?? []).reduce(
    (acc, e: any) => {
      const amt = Number(e.amount);
      acc.total += amt;
      acc.byCategory[e.category] = (acc.byCategory[e.category] ?? 0) + amt;
      return acc;
    },
    { total: 0, byCategory: {} as Record<string, number> }
  );

  // Quick monthly burn projection: average per day × 30
  const dailyAvg = totals.total / Math.max(1, windowDays);
  const monthlyBurn = dailyAvg * 30;

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="mb-6 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Vehicle & Shared Expenses</h1>
          <p className="text-zinc-400 text-sm mt-0.5">
            Truck/van costs that don't belong to a single job. Feed your real
            monthly overhead estimate at <a href="/settings/cost-basis" className="text-blue-400 hover:underline">Settings → Cost Basis</a>.
          </p>
        </div>
        <div className="flex items-center gap-1">
          {[7, 30, 90, 365].map((d) => (
            <a
              key={d}
              href={`/expenses?window=${d}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                windowDays === d
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
              }`}
            >
              {d === 365 ? "1y" : `${d}d`}
            </a>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="glass-card p-4">
          <p className="text-zinc-500 text-xs uppercase tracking-wide">Window Total</p>
          <p className="text-2xl font-bold font-mono mt-1 text-white">{fmt(totals.total)}</p>
          <p className="text-zinc-500 text-xs mt-1">{expenses?.length ?? 0} entries · last {windowDays}d</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-zinc-500 text-xs uppercase tracking-wide">Daily Avg</p>
          <p className="text-2xl font-bold font-mono mt-1 text-white">{fmt(dailyAvg)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-zinc-500 text-xs uppercase tracking-wide">Monthly Burn</p>
          <p className="text-2xl font-bold font-mono mt-1 text-yellow-400">{fmt(monthlyBurn)}</p>
          <p className="text-zinc-500 text-[10px] mt-1">project at current pace</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-zinc-500 text-xs uppercase tracking-wide">Top Category</p>
          {(() => {
            const top = Object.entries(totals.byCategory).sort((a, b) => b[1] - a[1])[0];
            if (!top) return <p className="text-zinc-500 mt-1 text-sm">—</p>;
            const meta = CATEGORY_META[top[0]] ?? CATEGORY_META.other;
            return (
              <>
                <p className="text-xl font-bold mt-1 text-white">{meta.emoji} {meta.label}</p>
                <p className="text-zinc-500 text-xs mt-1 font-mono">{fmt(top[1])}</p>
              </>
            );
          })()}
        </div>
      </div>

      {/* Entry form */}
      <div className="glass-card p-5 mb-6">
        <h2 className="text-white font-semibold mb-3">Log a new expense</h2>
        <ExpenseForm />
      </div>

      {/* Per-category breakdown */}
      {Object.keys(totals.byCategory).length > 1 && (
        <div className="glass-card p-5 mb-6">
          <h2 className="text-white font-semibold mb-3">By Category</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(totals.byCategory)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, amt]) => {
                const meta = CATEGORY_META[cat] ?? CATEGORY_META.other;
                const pct = totals.total > 0 ? (amt / totals.total) * 100 : 0;
                return (
                  <div key={cat} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
                    <p className="text-zinc-400 text-[10px] uppercase tracking-wide">
                      {meta.emoji} {meta.label}
                    </p>
                    <p className="text-white font-mono font-semibold mt-1">{fmt(amt)}</p>
                    <p className="text-zinc-500 text-[10px] mt-0.5">{pct.toFixed(0)}% of total</p>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Entries table */}
      <div className="glass-card overflow-x-auto">
        {!expenses?.length ? (
          <div className="px-5 py-10 text-center text-zinc-500 text-sm">
            No expenses logged in this window.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-zinc-500 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Vehicle</th>
                <th className="px-4 py-3 text-left">Notes</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e: any) => {
                const meta = CATEGORY_META[e.category] ?? CATEGORY_META.other;
                return (
                  <tr key={e.id} className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.04]">
                    <td className="px-4 py-3 text-zinc-300 text-xs font-mono">{e.expense_date}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
                        {meta.emoji} {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs font-mono">{e.vehicle_id ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs truncate max-w-[280px]">{e.notes ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-white font-mono font-semibold">{fmt(Number(e.amount))}</td>
                    <td className="px-4 py-3 text-right">
                      {(me.role === "owner" || me.role === "manager") && (
                        <DeleteButton id={e.id} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
