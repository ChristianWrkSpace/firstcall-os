import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getDataCutoff } from "@/lib/data-cutoff";
import { requireRoles } from "@/components/RoleGate";
import ExpenseForm from "./ExpenseForm";
import DeleteButton from "./DeleteButton";
import { PageShell, Glass, Band, EmptyState } from "@/components/ui/Glass";

const fmt = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CATEGORY_META: Record<string, { label: string; emoji: string; color: string }> = {
  fuel:         { label: "Fuel",         emoji: "⛽", color: "bg-orange-400/10 text-orange-300 ring-orange-400/20" },
  maintenance:  { label: "Maintenance",  emoji: "🔧", color: "bg-amber-400/10 text-amber-300 ring-amber-400/20" },
  insurance:    { label: "Insurance",    emoji: "🛡",  color: "bg-[#6B8AD9]/10 text-[#A6B8E7] ring-[#6B8AD9]/20" },
  lease:        { label: "Lease",        emoji: "📄", color: "bg-violet-400/10 text-violet-200 ring-violet-400/20" },
  registration: { label: "Registration", emoji: "📋", color: "bg-white/5 text-white/60 ring-white/10" },
  tolls:        { label: "Tolls",        emoji: "🛣",  color: "bg-white/5 text-white/60 ring-white/10" },
  parking:      { label: "Parking",      emoji: "🅿",  color: "bg-white/5 text-white/60 ring-white/10" },
  other:        { label: "Other",        emoji: "📦", color: "bg-white/5 text-white/60 ring-white/10" },
};

const winBtn = (active: boolean) =>
  `px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
    active
      ? "bg-white/[0.08] text-white ring-1 ring-[#5FBDB0]/20"
      : "border border-white/[0.08] text-white/45 hover:bg-white/[0.05] hover:text-white"
  }`;

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
  const cutoff = getDataCutoff();
  let expQuery = supabase
    .from("vehicle_expenses")
    .select("id, expense_date, category, amount, vehicle_id, notes, created_at")
    .gte("expense_date", since)
    .order("expense_date", { ascending: false });
  if (cutoff) expQuery = expQuery.gte("created_at", cutoff);
  const { data: expenses } = await expQuery;

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
  const topCat = Object.entries(totals.byCategory).sort((a, b) => b[1] - a[1])[0];

  return (
    <PageShell
      eyebrow="Van + shared"
      title="Vehicle & Shared Expenses"
      subtitle={
        <>
          Truck/van costs that don&apos;t belong to a single job. Feed your real monthly overhead
          estimate at{" "}
          <a href="/settings/cost-basis" className="text-[#A8DCD3] hover:text-white transition-colors">
            Settings → Cost Basis
          </a>
          .
        </>
      }
      action={
        <div className="flex items-center gap-1.5">
          {[7, 30, 90, 365].map((d) => (
            <a key={d} href={`/expenses?window=${d}`} className={winBtn(windowDays === d)}>
              {d === 365 ? "1y" : `${d}d`}
            </a>
          ))}
        </div>
      }
      width="wide"
    >
      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Glass level="stage" accent="teal" className="p-4 animate-rise-in">
          <p className="text-[10px] uppercase tracking-[0.15em] text-white/45">Window Total</p>
          <p className="text-2xl font-bold font-mono mt-1 text-[#A8DCD3]">{fmt(totals.total)}</p>
          <p className="text-white/40 text-xs mt-1">{expenses?.length ?? 0} entries · last {windowDays}d</p>
        </Glass>
        <div className="rounded-xl bg-white/[0.025] border border-white/[0.05] ring-1 ring-white/[0.04] p-4">
          <p className="text-[10px] uppercase tracking-[0.15em] text-white/40">Daily Avg</p>
          <p className="text-2xl font-bold font-mono mt-1 text-white/90">{fmt(dailyAvg)}</p>
        </div>
        <div className="rounded-xl bg-white/[0.025] border border-white/[0.05] ring-1 ring-amber-400/15 p-4">
          <p className="text-[10px] uppercase tracking-[0.15em] text-white/40">Monthly Burn</p>
          <p className="text-2xl font-bold font-mono mt-1 text-amber-300">{fmt(monthlyBurn)}</p>
          <p className="text-white/35 text-[10px] mt-1">project at current pace</p>
        </div>
        <div className="rounded-xl bg-white/[0.025] border border-white/[0.05] ring-1 ring-white/[0.04] p-4">
          <p className="text-[10px] uppercase tracking-[0.15em] text-white/40">Top Category</p>
          {!topCat ? (
            <p className="text-white/40 mt-1 text-sm">—</p>
          ) : (
            <>
              <p className="text-xl font-bold mt-1 text-white/90">
                {(CATEGORY_META[topCat[0]] ?? CATEGORY_META.other).emoji}{" "}
                {(CATEGORY_META[topCat[0]] ?? CATEGORY_META.other).label}
              </p>
              <p className="text-white/40 text-xs mt-1 font-mono">{fmt(topCat[1])}</p>
            </>
          )}
        </div>
      </div>

      {/* Entry form */}
      <Glass className="p-5 mb-6">
        <h2 className="text-white/95 font-semibold mb-3">Log a new expense</h2>
        <ExpenseForm />
      </Glass>

      {/* Per-category breakdown */}
      {Object.keys(totals.byCategory).length > 1 && (
        <Glass className="p-5 mb-6">
          <h2 className="text-white/95 font-semibold mb-3">By Category</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(totals.byCategory)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, amt]) => {
                const meta = CATEGORY_META[cat] ?? CATEGORY_META.other;
                const pct = totals.total > 0 ? (amt / totals.total) * 100 : 0;
                return (
                  <div key={cat} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
                    <p className="text-white/45 text-[10px] uppercase tracking-wide">
                      {meta.emoji} {meta.label}
                    </p>
                    <p className="text-white/90 font-mono font-semibold mt-1">{fmt(amt)}</p>
                    <p className="text-white/35 text-[10px] mt-0.5">{pct.toFixed(0)}% of total</p>
                  </div>
                );
              })}
          </div>
        </Glass>
      )}

      {/* Entries */}
      <Band label="Entries" hint={`last ${windowDays} days`}>
        {!expenses?.length ? (
          <EmptyState icon="🚐" title="No expenses logged in this window." />
        ) : (
          expenses.map((e: any, i: number) => {
            const meta = CATEGORY_META[e.category] ?? CATEGORY_META.other;
            return (
              <div
                key={e.id}
                className="group rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] transition-colors px-4 py-3 flex items-center gap-4 animate-rise-in"
                style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
              >
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ring-1 shrink-0 ${meta.color}`}>
                  {meta.emoji} {meta.label}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-white/85 text-sm truncate">{e.notes ?? "—"}</p>
                  <p className="text-white/35 text-xs font-mono mt-0.5">
                    {e.expense_date}
                    {e.vehicle_id && ` · ${e.vehicle_id}`}
                  </p>
                </div>
                <span className="text-white/95 font-mono font-semibold shrink-0">{fmt(Number(e.amount))}</span>
                {(me.role === "owner" || me.role === "manager") && (
                  <div className="shrink-0">
                    <DeleteButton id={e.id} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </Band>
    </PageShell>
  );
}
