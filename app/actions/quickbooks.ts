"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import {
  customersToCsv,
  invoicesToCsv,
  paymentsToCsv,
  type CustomerRow,
  type InvoiceRow,
  type PaymentRow,
} from "@/lib/quickbooks-csv";

export type QbExportKind = "customers" | "invoices" | "payments";

interface ExportResult {
  ok: true;
  filename: string;
  csv: string;
  rowCount: number;
}

export async function exportQuickbooksCsv(
  kind: QbExportKind,
  fromIso: string, // YYYY-MM-DD
  toIso: string // YYYY-MM-DD
): Promise<ExportResult | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };
  if (user.role !== "owner" && user.role !== "manager") {
    return { error: "Only owners and managers can export accounting data." };
  }

  const supabase = await createServerSupabaseClient();
  const fromDate = fromIso;
  const toDate = toIso;

  if (kind === "customers") {
    const { data, error } = await supabase
      .from("customers")
      .select("name, email, phone, address, city, state, zip, created_at")
      .gte("created_at", fromDate)
      .lte("created_at", `${toDate}T23:59:59.999Z`);
    if (error) return { error: error.message };
    const rows: CustomerRow[] = (data ?? []).map((c: any) => ({
      name: c.name,
      email: c.email,
      phone: c.phone,
      address: c.address,
      city: c.city,
      state: c.state,
      zip: c.zip,
    }));
    logAudit({
      user,
      action: "quickbooks.export",
      details: { kind, from: fromDate, to: toDate, rows: rows.length },
    });
    return {
      ok: true,
      filename: `qbo-customers-${fromDate}-to-${toDate}.csv`,
      csv: customersToCsv(rows),
      rowCount: rows.length,
    };
  }

  if (kind === "invoices") {
    const { data, error } = await supabase
      .from("invoices")
      .select(
        "invoice_number, status, created_at, due_date, sent_at, customers:jobs!inner(customer_id, customers(name)), line_items:invoice_line_items(description, qty, line_total)"
      )
      .gte("created_at", fromDate)
      .lte("created_at", `${toDate}T23:59:59.999Z`);

    if (error) return { error: error.message };

    // Flatten: one CSV row per line item
    const rows: InvoiceRow[] = [];
    for (const inv of (data ?? []) as any[]) {
      const customerName =
        inv.customers?.customers?.name ?? "(unknown)";
      const invoiceDate =
        (inv.sent_at ?? inv.created_at)?.split("T")[0] ?? fromDate;
      const lineItems = inv.line_items ?? [];
      if (lineItems.length === 0) {
        rows.push({
          invoice_number: inv.invoice_number,
          customer_name: customerName,
          invoice_date: invoiceDate,
          due_date: inv.due_date ?? null,
          line_description: "Mitigation services",
          line_amount: 0,
          line_qty: 1,
          status: inv.status,
        });
        continue;
      }
      for (const li of lineItems) {
        rows.push({
          invoice_number: inv.invoice_number,
          customer_name: customerName,
          invoice_date: invoiceDate,
          due_date: inv.due_date ?? null,
          line_description: li.description ?? "Mitigation services",
          line_amount: Number(li.line_total ?? 0),
          line_qty: Number(li.qty ?? 1),
          status: inv.status,
        });
      }
    }

    logAudit({
      user,
      action: "quickbooks.export",
      details: { kind, from: fromDate, to: toDate, rows: rows.length },
    });

    return {
      ok: true,
      filename: `qbo-invoices-${fromDate}-to-${toDate}.csv`,
      csv: invoicesToCsv(rows),
      rowCount: rows.length,
    };
  }

  if (kind === "payments") {
    const { data, error } = await supabase
      .from("payments")
      .select(
        "amount, received_at, method, reference, invoices!inner(invoice_number, jobs!inner(customers(name)))"
      )
      .gte("received_at", fromDate)
      .lte("received_at", toDate);
    if (error) return { error: error.message };

    const rows: PaymentRow[] = ((data ?? []) as any[]).map((p) => ({
      customer_name:
        p.invoices?.jobs?.customers?.name ?? "(unknown)",
      invoice_number: p.invoices?.invoice_number ?? "",
      payment_date: p.received_at,
      amount: Number(p.amount),
      method: (p.method ?? "").toString(),
      reference: p.reference,
    }));

    logAudit({
      user,
      action: "quickbooks.export",
      details: { kind, from: fromDate, to: toDate, rows: rows.length },
    });

    return {
      ok: true,
      filename: `qbo-payments-${fromDate}-to-${toDate}.csv`,
      csv: paymentsToCsv(rows),
      rowCount: rows.length,
    };
  }

  return { error: `Unknown export kind: ${kind}` };
}
