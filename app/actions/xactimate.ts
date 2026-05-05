"use server";

import { getCurrentUser } from "@/lib/auth-helpers";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { logAudit } from "@/lib/audit";
import {
  estimateToXactimateCsv,
  type XactimateExportInput,
  type XactimateLineRow,
} from "@/lib/xactimate-csv";

interface ExportResult {
  ok: true;
  filename: string;
  csv: string;
  lineCount: number;
}

export async function exportEstimateAsXactimateCsv(
  estimateId: string
): Promise<ExportResult | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };
  if (user.role !== "owner" && user.role !== "manager") {
    return { error: "Only owners and managers can export estimates." };
  }

  const supabase = await createServerSupabaseClient();

  const { data: est, error: estErr } = await supabase
    .from("estimates")
    .select(
      "id, version, status, created_at, approved_at, job_id, jobs(job_number, type, site_address, site_city, site_state, site_zip, customers(name, insurance_company, insurance_claim_number, insurance_policy_number))"
    )
    .eq("id", estimateId)
    .single();
  if (estErr || !est) return { error: estErr?.message ?? "Estimate not found." };

  const job = (est as any).jobs;
  const customer = job?.customers;

  const { data: lineRows, error: linesErr } = await supabase
    .from("estimate_line_items")
    .select("category, xactimate_code, description, quantity, unit, unit_price, line_total, notes, sort_order")
    .eq("estimate_id", estimateId)
    .order("sort_order", { ascending: true });
  if (linesErr) return { error: linesErr.message };

  const lines: XactimateLineRow[] = (lineRows ?? []).map((l: any) => ({
    category: l.category,
    selector_code: l.xactimate_code,
    description: l.description,
    quantity: Number(l.quantity ?? 0),
    unit: l.unit ?? "EA",
    unit_price: Number(l.unit_price ?? 0),
    line_total: Number(l.line_total ?? 0),
    notes: l.notes,
  }));

  const lossAddress = job
    ? [job.site_address, job.site_city, job.site_state, job.site_zip].filter(Boolean).join(", ")
    : null;

  const input: XactimateExportInput = {
    job_number: job?.job_number ?? "(unknown)",
    job_type: job?.type ?? null,
    customer_name: customer?.name ?? null,
    loss_address: lossAddress,
    carrier: customer?.insurance_company ?? null,
    claim_number: customer?.insurance_claim_number ?? null,
    policy_number: customer?.insurance_policy_number ?? null,
    estimate_version: Number((est as any).version ?? 1),
    estimate_status: String((est as any).status ?? "draft"),
    generated_at: (est as any).created_at ?? null,
    approved_at: (est as any).approved_at ?? null,
    lines,
  };

  const csv = estimateToXactimateCsv(input);
  const filename = `xactimate-${input.job_number}-v${input.estimate_version}.csv`;

  logAudit({
    user,
    action: "estimate.xactimate_exported",
    entity_type: "estimate",
    entity_id: estimateId,
    details: { line_count: lines.length, filename },
  });

  return { ok: true, filename, csv, lineCount: lines.length };
}
