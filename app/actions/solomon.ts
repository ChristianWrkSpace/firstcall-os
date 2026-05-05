"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { runSolomonAnalysis, type JobAggregate } from "@/lib/solomon";

export async function runSolomonReport(windowDays: number = 90) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };
  if (user.role !== "owner" && user.role !== "manager") {
    return { error: "Solomon is for owners and managers only." };
  }

  const supabase = await createServerSupabaseClient();
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();

  const [{ data: jobs }, { data: invoices }, { data: payments }] =
    await Promise.all([
      supabase
        .from("jobs")
        .select(
          "id, type, site_zip, customers(insurance_company)"
        )
        .gte("created_at", since),
      supabase
        .from("invoices")
        .select(
          "id, job_id, status, sent_at, line_items:invoice_line_items(line_total), payments(amount, received_at)"
        )
        .gte("created_at", since),
      supabase
        .from("payments")
        .select("amount, received_at, invoice_id")
        .gte("received_at", since.split("T")[0]),
    ]);

  const jobsArr = jobs ?? [];
  const invoicesArr = invoices ?? [];

  // Roll-up totals
  let total_billed = 0;
  let total_collected = 0;
  let outstanding_30 = 0;
  let outstanding_60 = 0;
  let outstanding_90 = 0;
  let outstanding_over = 0;

  const today = Date.now();

  // Build per-invoice metrics
  const invoiceMetrics = invoicesArr.map((inv: any) => {
    const total = (inv.line_items ?? []).reduce(
      (s: number, li: any) => s + Number(li.line_total ?? 0),
      0
    );
    const paid = (inv.payments ?? []).reduce(
      (s: number, p: any) => s + Number(p.amount ?? 0),
      0
    );
    total_billed += total;
    total_collected += paid;
    const balance = total - paid;
    let daysToPay: number | null = null;
    if (paid >= total && total > 0 && inv.sent_at) {
      const lastPay = (inv.payments ?? [])
        .map((p: any) => p.received_at)
        .filter(Boolean)
        .sort()
        .pop();
      if (lastPay) {
        daysToPay = Math.max(
          0,
          Math.floor(
            (new Date(lastPay).getTime() - new Date(inv.sent_at).getTime()) /
              86_400_000
          )
        );
      }
    }
    if (balance > 0 && inv.sent_at) {
      const ageDays = Math.floor(
        (today - new Date(inv.sent_at).getTime()) / 86_400_000
      );
      if (ageDays <= 30) outstanding_30 += balance;
      else if (ageDays <= 60) outstanding_60 += balance;
      else if (ageDays <= 90) outstanding_90 += balance;
      else outstanding_over += balance;
    }
    return { ...inv, total, paid, balance, days_to_pay: daysToPay };
  });

  // Build per-job lookup of carrier and zip
  const jobMap = new Map<string, { zip: string | null; type: string | null; carrier: string | null }>(
    jobsArr.map((j: any) => [
      j.id,
      {
        zip: j.site_zip ?? null,
        type: j.type ?? null,
        carrier: (j.customers as any)?.insurance_company ?? null,
      },
    ])
  );

  // Aggregate by zip
  const zipAgg = new Map<string, { jobs: number; billed: number }>();
  const typeAgg = new Map<string, { jobs: number; billed: number }>();
  const carrierAgg = new Map<
    string,
    { jobs: number; billed: number; collected: number; days: number[]; balance: number }
  >();

  // Per-job billed (sum of all that job's invoices)
  const jobBilled = new Map<string, number>();
  for (const inv of invoiceMetrics) {
    jobBilled.set(inv.job_id, (jobBilled.get(inv.job_id) ?? 0) + inv.total);
  }

  for (const j of jobsArr as any[]) {
    const billed = jobBilled.get(j.id) ?? 0;
    if (j.site_zip) {
      const a = zipAgg.get(j.site_zip) ?? { jobs: 0, billed: 0 };
      a.jobs += 1;
      a.billed += billed;
      zipAgg.set(j.site_zip, a);
    }
    if (j.type) {
      const a = typeAgg.get(j.type) ?? { jobs: 0, billed: 0 };
      a.jobs += 1;
      a.billed += billed;
      typeAgg.set(j.type, a);
    }
    const carrier = (j.customers as any)?.insurance_company ?? "(none)";
    const ca = carrierAgg.get(carrier) ?? {
      jobs: 0,
      billed: 0,
      collected: 0,
      days: [] as number[],
      balance: 0,
    };
    ca.jobs += 1;
    ca.billed += billed;
    carrierAgg.set(carrier, ca);
  }

  // Layer in collected + days_to_pay + balance per carrier
  for (const inv of invoiceMetrics) {
    const job = jobMap.get(inv.job_id);
    const carrier = job?.carrier ?? "(none)";
    const ca = carrierAgg.get(carrier);
    if (!ca) continue;
    ca.collected += inv.paid;
    if (typeof inv.days_to_pay === "number") ca.days.push(inv.days_to_pay);
    ca.balance += inv.balance > 0 ? inv.balance : 0;
  }

  const by_zip = Array.from(zipAgg.entries())
    .map(([zip, a]) => ({
      zip,
      jobs: a.jobs,
      billed: Math.round(a.billed * 100) / 100,
      avg_ticket:
        a.jobs > 0 ? Math.round((a.billed / a.jobs) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.billed - a.billed)
    .slice(0, 20);

  const by_type = Array.from(typeAgg.entries())
    .map(([type, a]) => ({
      type,
      jobs: a.jobs,
      billed: Math.round(a.billed * 100) / 100,
      avg_ticket:
        a.jobs > 0 ? Math.round((a.billed / a.jobs) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.billed - a.billed);

  const by_carrier = Array.from(carrierAgg.entries())
    .map(([carrier, a]) => ({
      carrier,
      jobs: a.jobs,
      billed: Math.round(a.billed * 100) / 100,
      collected: Math.round(a.collected * 100) / 100,
      avg_days_to_pay:
        a.days.length > 0
          ? Math.round(a.days.reduce((s, d) => s + d, 0) / a.days.length)
          : null,
      open_balance: Math.round(a.balance * 100) / 100,
    }))
    .sort((a, b) => b.billed - a.billed)
    .slice(0, 15);

  const job_count = jobsArr.length;
  const avg_ticket = job_count > 0 ? total_billed / job_count : 0;

  const aggregate: JobAggregate = {
    job_count,
    total_billed: Math.round(total_billed * 100) / 100,
    total_collected: Math.round(total_collected * 100) / 100,
    avg_ticket: Math.round(avg_ticket * 100) / 100,
    by_zip,
    by_type,
    by_carrier,
    outstanding_30: Math.round(outstanding_30 * 100) / 100,
    outstanding_60: Math.round(outstanding_60 * 100) / 100,
    outstanding_90: Math.round(outstanding_90 * 100) / 100,
    outstanding_over: Math.round(outstanding_over * 100) / 100,
    window_days: windowDays,
  };

  // Law 1 — Bounded Inputs. Solomon is FP&A — needs financial signal, not
  // just job activity. ≥1 job AND ≥1 invoice in the window. Without an
  // invoice, the analysis is hallucinated narrative on top of no $ data.
  if (job_count === 0) {
    return { error: "No jobs in the selected window — nothing to analyze." };
  }
  if (invoicesArr.length === 0) {
    return {
      error:
        "No invoices in the selected window — Solomon is FP&A and needs financial data. Try a longer window, or send a few estimates first.",
    };
  }

  let result;
  try {
    result = await runSolomonAnalysis(aggregate);
  } catch (err: any) {
    console.error("[solomon.run]", err);
    return { error: err?.message ?? "Solomon analysis failed." };
  }

  const { data: inserted, error: saveError } = await supabase
    .from("solomon_reports")
    .insert({
      generated_by: user.id,
      window_days: windowDays,
      job_count,
      invoice_count: invoicesArr.length,
      total_billed: aggregate.total_billed,
      total_collected: aggregate.total_collected,
      insights: result.insights,
      recommendations: result.recommendations,
      raw_summary: result.summary,
    })
    .select("id")
    .single();

  if (saveError) return { error: saveError.message };

  logAudit({
    user,
    action: "solomon.report_generated",
    entity_type: "solomon_report",
    entity_id: inserted.id,
    details: { window_days: windowDays, job_count },
  });

  revalidatePath("/solomon");
  return { ok: true, reportId: inserted.id };
}
