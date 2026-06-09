import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getDataCutoff } from "@/lib/data-cutoff";
import Link from "next/link";
import { requireRoles } from "@/components/RoleGate";

const fmt = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

type Grade = "A" | "B" | "C" | "F" | "—";

interface CarrierRow {
  carrier: string;
  jobsCount: number;
  totalBilled: number;
  totalCollected: number;
  openBalance: number;
  avgDsoDays: number | null;        // only over fully-paid invoices
  collectionRate: number | null;    // collected / billed for sent invoices
  paidInvoiceCount: number;
  unpaidInvoiceCount: number;
  oldestUnpaidDays: number | null;
  grade: Grade;
}

function gradeCarrier(row: Omit<CarrierRow, "grade">): Grade {
  // Need at least one fully-paid invoice to grade fairly
  if (row.paidInvoiceCount === 0) return "—";
  const rate = row.collectionRate ?? 0;
  const dso = row.avgDsoDays ?? 999;
  if (dso <= 30 && rate >= 0.95) return "A";
  if (dso <= 60 && rate >= 0.85) return "B";
  if (dso <= 90 && rate >= 0.70) return "C";
  return "F";
}

const GRADE_COLORS: Record<Grade, string> = {
  A: "bg-pine/10 text-pine border-green-500/40",
  B: "bg-info/10 text-info border-info/40",
  C: "bg-honey/10 text-honey border-yellow-500/40",
  F: "bg-red-600/10 text-red-700 border-red-500/40",
  "—": "bg-shade text-ink-3 border-edge2",
};

export default async function AdjusterScoringPage() {
  await requireRoles(["owner", "manager"]);
  const supabase = await createServerSupabaseClient();
  const cutoff = getDataCutoff();

  // Pull every sent (or further) invoice with its job → customer → carrier.
  // We exclude voided invoices entirely. Drafts (no sent_at) don't count
  // toward DSO or grades — they're scope, not commitment.
  let invQuery = supabase
    .from("invoices")
    .select(
      `id,
       status,
       sent_at,
       jobs!inner(id, customers!inner(insurance_company)),
       line_items:invoice_line_items(line_total),
       payments(amount, created_at)`
    )
    .neq("status", "void");
  if (cutoff) invQuery = invQuery.gte("created_at", cutoff);
  const { data: invoices } = await invQuery;

  const carriers = new Map<string, {
    invoices: Array<{
      id: string;
      sent_at: string | null;
      total: number;
      paid: number;
      lastPaymentAt: string | null;
      jobId: string;
    }>;
  }>();

  for (const inv of (invoices ?? []) as any[]) {
    const carrier =
      inv.jobs?.customers?.insurance_company?.trim() || "Self-pay / Direct";
    const total = (inv.line_items ?? []).reduce(
      (s: number, li: any) => s + Number(li.line_total ?? 0),
      0
    );
    const paid = (inv.payments ?? []).reduce(
      (s: number, p: any) => s + Number(p.amount ?? 0),
      0
    );
    const lastPaymentAt = (inv.payments ?? [])
      .map((p: any) => p.created_at)
      .filter(Boolean)
      .sort()
      .pop() ?? null;

    if (!carriers.has(carrier)) carriers.set(carrier, { invoices: [] });
    carriers.get(carrier)!.invoices.push({
      id: inv.id,
      sent_at: inv.sent_at,
      total,
      paid,
      lastPaymentAt,
      jobId: inv.jobs?.id,
    });
  }

  // Aggregate per carrier
  const rows: CarrierRow[] = [];
  for (const [carrier, { invoices: carrierInvoices }] of carriers) {
    const jobIds = new Set(carrierInvoices.map((i) => i.jobId));
    let totalBilled = 0;
    let totalCollected = 0;
    let openBalance = 0;
    let dsoDaysSum = 0;
    let dsoCount = 0;
    let paidInvoiceCount = 0;
    let unpaidInvoiceCount = 0;
    let oldestUnpaidDays: number | null = null;

    for (const inv of carrierInvoices) {
      if (inv.sent_at == null) continue; // drafts ignored
      totalBilled += inv.total;
      totalCollected += inv.paid;
      const balance = Math.max(0, inv.total - inv.paid);
      openBalance += balance;

      const isFullyPaid = inv.paid >= inv.total - 0.005 && inv.total > 0;
      if (isFullyPaid && inv.lastPaymentAt) {
        const dsoMs =
          new Date(inv.lastPaymentAt).getTime() -
          new Date(inv.sent_at).getTime();
        const dsoDays = Math.max(0, Math.floor(dsoMs / 86_400_000));
        dsoDaysSum += dsoDays;
        dsoCount += 1;
        paidInvoiceCount += 1;
      } else if (balance > 0) {
        unpaidInvoiceCount += 1;
        const ageDays = Math.floor(
          (Date.now() - new Date(inv.sent_at).getTime()) / 86_400_000
        );
        oldestUnpaidDays =
          oldestUnpaidDays == null ? ageDays : Math.max(oldestUnpaidDays, ageDays);
      }
    }

    const collectionRate =
      totalBilled > 0 ? totalCollected / totalBilled : null;
    const avgDsoDays = dsoCount > 0 ? dsoDaysSum / dsoCount : null;

    const base = {
      carrier,
      jobsCount: jobIds.size,
      totalBilled,
      totalCollected,
      openBalance,
      avgDsoDays,
      collectionRate,
      paidInvoiceCount,
      unpaidInvoiceCount,
      oldestUnpaidDays,
    };
    rows.push({ ...base, grade: gradeCarrier(base) });
  }

  // Default sort: F worst first (highest open balance with bad grade), then by total billed desc
  rows.sort((a, b) => {
    const gradeOrder: Record<Grade, number> = { F: 0, C: 1, B: 2, A: 3, "—": 4 };
    if (gradeOrder[a.grade] !== gradeOrder[b.grade])
      return gradeOrder[a.grade] - gradeOrder[b.grade];
    return b.totalBilled - a.totalBilled;
  });

  // Headline metrics
  const portfolioBilled = rows.reduce((s, r) => s + r.totalBilled, 0);
  const portfolioCollected = rows.reduce((s, r) => s + r.totalCollected, 0);
  const portfolioOpen = rows.reduce((s, r) => s + r.openBalance, 0);
  const overallCollectionRate =
    portfolioBilled > 0 ? portfolioCollected / portfolioBilled : null;
  const gradedRows = rows.filter((r) => r.grade !== "—");
  const weightedDso =
    gradedRows.reduce((s, r) => s + (r.avgDsoDays ?? 0) * r.paidInvoiceCount, 0) /
    Math.max(1, gradedRows.reduce((s, r) => s + r.paidInvoiceCount, 0));

  // ─── Top Issues — actionable callouts ──────────────────────────────────
  // Surface the 1–3 worst things so the user knows where to focus right now.
  type Issue = { kind: string; carrier: string; detail: string; severity: "high" | "med" };
  const issues: Issue[] = [];

  const biggestStuck = rows
    .filter((r) => r.openBalance > 0)
    .sort((a, b) => b.openBalance - a.openBalance)[0];
  if (biggestStuck && biggestStuck.openBalance > 0) {
    issues.push({
      kind: "biggest_stuck",
      carrier: biggestStuck.carrier,
      detail: `${fmt(biggestStuck.openBalance)} open across ${biggestStuck.unpaidInvoiceCount} invoice${biggestStuck.unpaidInvoiceCount === 1 ? "" : "s"}`,
      severity: "high",
    });
  }

  const oldestUnpaid = rows
    .filter((r) => r.oldestUnpaidDays != null)
    .sort((a, b) => (b.oldestUnpaidDays ?? 0) - (a.oldestUnpaidDays ?? 0))[0];
  if (oldestUnpaid && (oldestUnpaid.oldestUnpaidDays ?? 0) >= 60) {
    issues.push({
      kind: "oldest_unpaid",
      carrier: oldestUnpaid.carrier,
      detail: `${oldestUnpaid.oldestUnpaidDays}d unpaid — TX § 542.058 demand-letter window`,
      severity: "high",
    });
  }

  const worstGraded = rows
    .filter((r) => r.grade === "F" && r.totalBilled > 1000)
    .sort((a, b) => b.totalBilled - a.totalBilled)[0];
  if (worstGraded && worstGraded.carrier !== biggestStuck?.carrier) {
    issues.push({
      kind: "worst_graded",
      carrier: worstGraded.carrier,
      detail: `Graded F with ${fmt(worstGraded.totalBilled)} billed — chronic slow pay`,
      severity: "med",
    });
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <Link
          href="/reports"
          className="text-ink-3 hover:text-ink text-sm transition-colors"
        >
          ← Reports
        </Link>
        <h1 className="text-2xl font-bold text-ink mt-2">Adjuster Scoring</h1>
        <p className="text-ink-2 text-sm mt-0.5">
          How fast each carrier pays. Grade them, prioritize the As, escalate the Fs.
        </p>
      </div>

      {/* Portfolio summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Tile
          label="Total Billed"
          value={fmt(portfolioBilled)}
          sub={`${rows.length} carriers`}
        />
        <Tile
          label="Total Collected"
          value={fmt(portfolioCollected)}
          sub={
            overallCollectionRate != null
              ? `${(overallCollectionRate * 100).toFixed(0)}% collection rate`
              : "—"
          }
          color={
            overallCollectionRate != null && overallCollectionRate < 0.85
              ? "text-honey"
              : "text-ink"
          }
        />
        <Tile
          label="Open Balance"
          value={fmt(portfolioOpen)}
          color={portfolioOpen > 0 ? "text-honey" : "text-ink"}
          sub={portfolioOpen > 0 ? "still owed" : "all caught up"}
        />
        <Tile
          label="Weighted Avg DSO"
          value={`${weightedDso > 0 ? Math.round(weightedDso) : "—"}d`}
          sub="paid invoices only"
          color={
            weightedDso > 60
              ? "text-red-700"
              : weightedDso > 30
                ? "text-honey"
                : "text-pine"
          }
        />
      </div>

      {/* Top Issues — what to act on right now */}
      {issues.length > 0 && (
        <div className="bg-yellow-500/5 border border-yellow-500/30 rounded-xl p-4 mb-6">
          <p className="text-honey text-xs uppercase tracking-wide font-semibold mb-2">
            🔥 Top Issues — act on these first
          </p>
          <ul className="space-y-1.5">
            {issues.map((i, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-sm"
              >
                <span
                  className={
                    i.severity === "high" ? "text-red-700" : "text-honey"
                  }
                >
                  ●
                </span>
                <span className="text-ink">
                  <span className="font-semibold">{i.carrier}</span>
                  <span className="text-ink-2"> — {i.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Per-carrier table */}
      <div className="glass-card overflow-x-auto">
        {rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-ink-3 text-sm">
            No invoiced carriers yet. Send some invoices and check back.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge2 text-ink-3 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Carrier</th>
                <th className="px-4 py-3 text-center">Grade</th>
                <th className="px-4 py-3 text-right">Jobs</th>
                <th className="px-4 py-3 text-right">Billed</th>
                <th className="px-4 py-3 text-right">Collected</th>
                <th className="px-4 py-3 text-right">Open</th>
                <th className="px-4 py-3 text-right">Avg DSO</th>
                <th className="px-4 py-3 text-right">Collection %</th>
                <th className="px-4 py-3 text-right">Oldest Unpaid</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const dsoColor =
                  r.avgDsoDays == null
                    ? "text-ink-3"
                    : r.avgDsoDays > 60
                      ? "text-red-700"
                      : r.avgDsoDays > 30
                        ? "text-honey"
                        : "text-pine";
                const rateColor =
                  r.collectionRate == null
                    ? "text-ink-3"
                    : r.collectionRate >= 0.95
                      ? "text-pine"
                      : r.collectionRate >= 0.85
                        ? "text-info"
                        : r.collectionRate >= 0.70
                          ? "text-honey"
                          : "text-red-700";
                return (
                  <tr
                    key={r.carrier}
                    className="border-b border-edge2 last:border-0 hover:bg-shade transition-colors"
                  >
                    <td className="px-4 py-3 text-ink font-medium">
                      {r.carrier}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-full border text-xs font-bold ${GRADE_COLORS[r.grade]}`}
                        title={
                          r.grade === "—"
                            ? "Need at least one fully-paid invoice to grade"
                            : `${r.grade} grade`
                        }
                      >
                        {r.grade}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-ink-2 font-mono text-xs">
                      {r.jobsCount}
                    </td>
                    <td className="px-4 py-3 text-right text-ink font-mono text-xs">
                      {fmt(r.totalBilled)}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-2 font-mono text-xs">
                      {fmt(r.totalCollected)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono text-xs ${r.openBalance > 0 ? "text-honey" : "text-ink-3"}`}
                    >
                      {r.openBalance > 0 ? fmt(r.openBalance) : "—"}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono text-xs ${dsoColor}`}
                    >
                      {r.avgDsoDays != null ? `${Math.round(r.avgDsoDays)}d` : "—"}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono text-xs ${rateColor}`}
                    >
                      {r.collectionRate != null
                        ? `${(r.collectionRate * 100).toFixed(0)}%`
                        : "—"}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono text-xs ${
                        r.oldestUnpaidDays == null
                          ? "text-ink-3"
                          : r.oldestUnpaidDays > 90
                            ? "text-red-700"
                            : r.oldestUnpaidDays > 60
                              ? "text-orange-700"
                              : r.oldestUnpaidDays > 30
                                ? "text-honey"
                                : "text-ink-2"
                      }`}
                    >
                      {r.oldestUnpaidDays != null ? `${r.oldestUnpaidDays}d` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Grading legend */}
      <div className="mt-6 bg-card border border-edge2 rounded-lg p-4 text-ink-3 text-xs leading-relaxed">
        <p className="text-ink-2 text-sm font-semibold mb-2">How carriers are graded</p>
        <ul className="space-y-1">
          <li><span className="text-pine font-mono">A</span> — Avg DSO ≤ 30 days AND ≥ 95% collected. Prioritize these claims.</li>
          <li><span className="text-info font-mono">B</span> — Avg DSO ≤ 60 days AND ≥ 85% collected. Solid carrier.</li>
          <li><span className="text-honey font-mono">C</span> — Avg DSO ≤ 90 days AND ≥ 70% collected. Watch for slippage.</li>
          <li><span className="text-red-700 font-mono">F</span> — Worse than C on either dimension. Esquire demand letter territory.</li>
          <li><span className="text-ink-3 font-mono">—</span> — Not enough fully-paid invoices yet to grade.</li>
        </ul>
        <p className="mt-3">
          DSO (Days Sales Outstanding) is computed only over fully-paid invoices —
          partial pays sit in "Open Balance" until cleared. Voided invoices excluded.
          Drafts (no <code className="text-ink-2 bg-shade px-1 rounded">sent_at</code>) excluded.
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
