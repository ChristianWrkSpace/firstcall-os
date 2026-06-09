import { createAdminClient } from "./supabase-server";

export interface CostBasis {
  default_hourly_rate: number;
  van_cost_per_job: number;
  monthly_overhead: number;
  default_equipment_daily: number;
}

export interface JobPnl {
  jobId: string;
  jobNumber: string | null;
  customerName: string;
  jobType: string | null;
  status: string;
  createdAt: string;
  completedAt: string | null;

  // Revenue (use billed for "what we earned" — collected for cash)
  revenueBilled: number;
  revenueCollected: number;
  revenueOpenBalance: number;

  // COGS — every dollar required to deliver this job
  laborCost: number;
  laborHours: number;
  consumablesCost: number;
  equipmentCost: number;
  equipmentDays: number;
  subsCost: number;
  vanCost: number;

  // Subtotals
  totalCogs: number;
  grossProfit: number;
  grossMarginPct: number | null;

  // Overhead (allocated proportionally to revenue across the window)
  overheadAllocated: number;

  // Net
  netProfit: number;
  netMarginPct: number | null;
}

export interface PortfolioPnl {
  windowDays: number;
  jobType: string | "all";
  jobs: JobPnl[];
  totals: {
    jobCount: number;
    revenueBilled: number;
    revenueCollected: number;
    laborCost: number;
    consumablesCost: number;
    equipmentCost: number;
    subsCost: number;
    vanCost: number;
    totalCogs: number;
    grossProfit: number;
    grossMarginPct: number | null;
    overheadAllocated: number;
    netProfit: number;
    netMarginPct: number | null;
  };
  byType: Array<{
    type: string;
    jobCount: number;
    revenueBilled: number;
    totalCogs: number;
    grossProfit: number;
    netProfit: number;
    netMarginPct: number | null;
  }>;
  costBasis: CostBasis;
}

const DEFAULT_COST_BASIS: CostBasis = {
  default_hourly_rate: 35,
  van_cost_per_job: 75,
  monthly_overhead: 8000,
  default_equipment_daily: 25,
};

export async function getCostBasis(): Promise<CostBasis> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("cost_basis_settings")
    .select(
      "default_hourly_rate, van_cost_per_job, monthly_overhead, default_equipment_daily"
    )
    .eq("id", 1)
    .maybeSingle();
  if (!data) return DEFAULT_COST_BASIS;
  return {
    default_hourly_rate: Number(data.default_hourly_rate),
    van_cost_per_job: Number(data.van_cost_per_job),
    monthly_overhead: Number(data.monthly_overhead),
    default_equipment_daily: Number(data.default_equipment_daily),
  };
}

/**
 * Compute the P&L for a single job. Pass `costBasis` to skip the lookup
 * when computing many jobs in a row.
 */
export async function computeJobPnl(
  jobId: string,
  costBasis?: CostBasis
): Promise<JobPnl | null> {
  const admin = createAdminClient();
  const cb = costBasis ?? (await getCostBasis());

  const [
    { data: job },
    { data: labor },
    { data: consumables },
    { data: assignments },
    { data: subInvoices },
  ] = await Promise.all([
    admin
      .from("jobs")
      .select(
        `id, job_number, type, status, created_at, completed_at,
         customers(name),
         invoices(status, sent_at, line_items:invoice_line_items(line_total), payments(amount))`
      )
      .eq("id", jobId)
      .maybeSingle(),
    admin
      .from("tech_labor_entries")
      .select("hours, hourly_rate")
      .eq("job_id", jobId),
    admin
      .from("consumables_used")
      .select("quantity, unit_cost")
      .eq("job_id", jobId),
    admin
      .from("equipment_assignments")
      .select("deployed_at, retrieved_at, equipment:equipment_id(daily_cost)")
      .eq("job_id", jobId),
    admin
      .from("sub_invoices")
      .select("amount")
      .eq("job_id", jobId),
  ]);

  if (!job) return null;
  return assembleJobPnl(job, labor ?? [], consumables ?? [], assignments ?? [], subInvoices ?? [], cb, 0);
}

/**
 * Build a single JobPnl from already-fetched rows. Pulled out so the
 * portfolio query can do one big SELECT instead of N+1 lookups.
 *
 * `overheadAllocated` is computed at the portfolio level (proportional to
 * revenue) and passed in — pass 0 for single-job computation.
 */
function assembleJobPnl(
  job: any,
  labor: Array<{ hours: any; hourly_rate: any }>,
  consumables: Array<{ quantity: any; unit_cost: any }>,
  assignments: Array<{
    deployed_at: string | null;
    retrieved_at: string | null;
    equipment: any;
  }>,
  subInvoices: Array<{ amount: any }>,
  cb: CostBasis,
  overheadAllocated: number
): JobPnl {
  // ── Revenue ─────────────────────────────────────────────────────────
  let revenueBilled = 0;
  let revenueCollected = 0;
  for (const inv of job.invoices ?? []) {
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
    }
  }
  const revenueOpenBalance = Math.max(0, revenueBilled - revenueCollected);

  // ── Labor ───────────────────────────────────────────────────────────
  let laborCost = 0;
  let laborHours = 0;
  for (const e of labor) {
    const h = Number(e.hours ?? 0);
    const r = Number(e.hourly_rate ?? cb.default_hourly_rate);
    laborHours += h;
    laborCost += h * r;
  }

  // ── Consumables ─────────────────────────────────────────────────────
  let consumablesCost = 0;
  for (const c of consumables) {
    consumablesCost +=
      Number(c.quantity ?? 0) * Number(c.unit_cost ?? 0);
  }

  // ── Equipment days × per-piece daily cost (fall back to default) ────
  let equipmentCost = 0;
  let equipmentDays = 0;
  for (const a of assignments) {
    if (!a.deployed_at) continue;
    const start = new Date(a.deployed_at).getTime();
    const end = a.retrieved_at ? new Date(a.retrieved_at).getTime() : Date.now();
    const days = Math.max(0, (end - start) / 86_400_000);
    equipmentDays += days;
    const eq = Array.isArray(a.equipment) ? a.equipment[0] : a.equipment;
    const daily = eq?.daily_cost != null
      ? Number(eq.daily_cost)
      : cb.default_equipment_daily;
    equipmentCost += days * daily;
  }

  // ── Subcontractor invoices billed to this job ───────────────────────
  let subsCost = 0;
  for (const s of subInvoices) {
    subsCost += Number(s.amount ?? 0);
  }

  const vanCost = cb.van_cost_per_job;
  const totalCogs = laborCost + consumablesCost + equipmentCost + subsCost + vanCost;
  const grossProfit = revenueBilled - totalCogs;
  const grossMarginPct =
    revenueBilled > 0 ? grossProfit / revenueBilled : null;
  const netProfit = grossProfit - overheadAllocated;
  const netMarginPct =
    revenueBilled > 0 ? netProfit / revenueBilled : null;

  return {
    jobId: job.id,
    jobNumber: job.job_number,
    customerName: (Array.isArray(job.customers) ? job.customers[0] : job.customers)?.name ?? "—",
    jobType: job.type,
    status: job.status,
    createdAt: job.created_at,
    completedAt: job.completed_at,
    revenueBilled,
    revenueCollected,
    revenueOpenBalance,
    laborCost: round(laborCost),
    laborHours: round(laborHours),
    consumablesCost: round(consumablesCost),
    equipmentCost: round(equipmentCost),
    equipmentDays: round(equipmentDays),
    subsCost: round(subsCost),
    vanCost,
    totalCogs: round(totalCogs),
    grossProfit: round(grossProfit),
    grossMarginPct,
    overheadAllocated: round(overheadAllocated),
    netProfit: round(netProfit),
    netMarginPct,
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Compute portfolio P&L over a window with optional job-type filter.
 * Allocates monthly overhead proportionally to each job's billed revenue.
 */
export async function computePortfolioPnl(opts: {
  windowDays: number;
  jobType?: string | null;
}): Promise<PortfolioPnl> {
  const admin = createAdminClient();
  const cb = await getCostBasis();
  const windowDays = Math.max(1, opts.windowDays);
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();

  // Use the later of the user's selected window and the data cutoff so
  // pre-launch test rows don't poison the portfolio P&L.
  const { getDataCutoff } = await import("./data-cutoff");
  const cutoff = getDataCutoff();
  const effectiveSince = cutoff && cutoff > since ? cutoff : since;

  let q = admin
    .from("jobs")
    .select(
      `id, job_number, type, status, created_at, completed_at,
       customers(name),
       invoices(status, sent_at, line_items:invoice_line_items(line_total), payments(amount)),
       tech_labor_entries(hours, hourly_rate),
       consumables_used(quantity, unit_cost),
       equipment_assignments(deployed_at, retrieved_at, equipment:equipment_id(daily_cost)),
       sub_invoices(amount)`
    )
    .gte("created_at", effectiveSince)
    .order("created_at", { ascending: false });

  if (opts.jobType && opts.jobType !== "all") {
    q = q.eq("type", opts.jobType);
  }

  const { data: jobs } = await q;

  // Pre-compute revenue so we can allocate overhead proportionally
  const overheadForWindow = (cb.monthly_overhead / 30) * windowDays;
  const interimRevenues = (jobs ?? []).map((j: any) => {
    let r = 0;
    for (const inv of j.invoices ?? []) {
      if (inv.status === "void") continue;
      if (!inv.sent_at) continue;
      r += (inv.line_items ?? []).reduce(
        (s: number, li: any) => s + Number(li.line_total ?? 0),
        0
      );
    }
    return r;
  });
  const totalRev = interimRevenues.reduce((s, r) => s + r, 0);

  const pnls: JobPnl[] = (jobs ?? []).map((j: any, i: number) => {
    const share =
      totalRev > 0 ? interimRevenues[i] / totalRev : 1 / Math.max(1, (jobs ?? []).length);
    const overheadAllocated = overheadForWindow * share;
    return assembleJobPnl(
      j,
      j.tech_labor_entries ?? [],
      j.consumables_used ?? [],
      j.equipment_assignments ?? [],
      j.sub_invoices ?? [],
      cb,
      overheadAllocated
    );
  });

  // Aggregate totals
  const totals = pnls.reduce(
    (t, p) => ({
      jobCount: t.jobCount + 1,
      revenueBilled: t.revenueBilled + p.revenueBilled,
      revenueCollected: t.revenueCollected + p.revenueCollected,
      laborCost: t.laborCost + p.laborCost,
      consumablesCost: t.consumablesCost + p.consumablesCost,
      equipmentCost: t.equipmentCost + p.equipmentCost,
      subsCost: t.subsCost + p.subsCost,
      vanCost: t.vanCost + p.vanCost,
      totalCogs: t.totalCogs + p.totalCogs,
      grossProfit: t.grossProfit + p.grossProfit,
      overheadAllocated: t.overheadAllocated + p.overheadAllocated,
      netProfit: t.netProfit + p.netProfit,
    }),
    {
      jobCount: 0,
      revenueBilled: 0,
      revenueCollected: 0,
      laborCost: 0,
      consumablesCost: 0,
      equipmentCost: 0,
      subsCost: 0,
      vanCost: 0,
      totalCogs: 0,
      grossProfit: 0,
      overheadAllocated: 0,
      netProfit: 0,
    }
  );

  // By job type breakdown
  const byTypeMap = new Map<string, {
    jobCount: number;
    revenueBilled: number;
    totalCogs: number;
    grossProfit: number;
    netProfit: number;
  }>();
  for (const p of pnls) {
    const t = p.jobType ?? "other";
    const cur = byTypeMap.get(t) ?? {
      jobCount: 0,
      revenueBilled: 0,
      totalCogs: 0,
      grossProfit: 0,
      netProfit: 0,
    };
    cur.jobCount += 1;
    cur.revenueBilled += p.revenueBilled;
    cur.totalCogs += p.totalCogs;
    cur.grossProfit += p.grossProfit;
    cur.netProfit += p.netProfit;
    byTypeMap.set(t, cur);
  }
  const byType = Array.from(byTypeMap.entries())
    .map(([type, v]) => ({
      type,
      ...v,
      netMarginPct: v.revenueBilled > 0 ? v.netProfit / v.revenueBilled : null,
    }))
    .sort((a, b) => b.netProfit - a.netProfit);

  return {
    windowDays,
    jobType: opts.jobType ?? "all",
    jobs: pnls,
    totals: {
      ...totals,
      grossMarginPct:
        totals.revenueBilled > 0 ? totals.grossProfit / totals.revenueBilled : null,
      netMarginPct:
        totals.revenueBilled > 0 ? totals.netProfit / totals.revenueBilled : null,
    },
    byType,
    costBasis: cb,
  };
}
