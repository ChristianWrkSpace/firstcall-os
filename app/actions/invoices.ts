"use server";

import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase-server";
import { sendEmail } from "@/lib/resend";
import { buildInvoiceEmail, buildReminderEmail } from "@/lib/abacus-templates";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function createInvoiceFromEstimate(estimateId: string, jobId: string) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  // Verify estimate exists and is approved
  const { data: estimate, error: estErr } = await admin
    .from("estimates")
    .select("id, status, job_id")
    .eq("id", estimateId)
    .single();
  if (estErr || !estimate) return { error: "Estimate not found." };
  if (estimate.status !== "approved" && estimate.status !== "sent") {
    return { error: "Estimate must be approved before invoicing." };
  }

  // Pull line items
  const { data: lineItems } = await admin
    .from("estimate_line_items")
    .select("*")
    .eq("estimate_id", estimateId)
    .order("sort_order", { ascending: true });

  // Default due date: 30 days from issue
  const due = new Date();
  due.setDate(due.getDate() + 30);
  const dueStr = due.toISOString().split("T")[0];

  // Create invoice
  const { data: invoice, error: invErr } = await admin
    .from("invoices")
    .insert({
      job_id: jobId,
      estimate_id: estimateId,
      status: "draft",
      due_date: dueStr,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (invErr || !invoice) return { error: invErr?.message ?? "Failed to create invoice." };

  // Copy line items
  if (lineItems && lineItems.length > 0) {
    const lineRows = lineItems.map((li) => ({
      invoice_id: invoice.id,
      sort_order: li.sort_order,
      category: li.category,
      xactimate_code: li.xactimate_code,
      description: li.description,
      quantity: li.quantity,
      unit: li.unit,
      unit_price: li.unit_price,
      notes: li.notes,
    }));
    const { error: linesErr } = await admin
      .from("invoice_line_items")
      .insert(lineRows);
    if (linesErr) return { error: linesErr.message };
  }

  revalidatePath(`/jobs/${jobId}`);
  redirect(`/jobs/${jobId}/invoices/${invoice.id}`);
}

export async function updateInvoiceLine(
  lineItemId: string,
  updates: {
    description?: string;
    quantity?: number;
    unit?: string;
    unit_price?: number;
    xactimate_code?: string;
  },
  invoiceId: string,
  jobId: string
) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("invoice_line_items")
    .update(updates)
    .eq("id", lineItemId);
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}/invoices/${invoiceId}`);
  return { ok: true };
}

export async function addInvoiceLine(
  invoiceId: string,
  jobId: string,
  formData: FormData
) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  const description = (formData.get("description") as string)?.trim();
  if (!description) return { error: "Description required." };

  const { data: maxRow } = await admin
    .from("invoice_line_items")
    .select("sort_order")
    .eq("invoice_id", invoiceId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const sort_order = (maxRow?.[0]?.sort_order ?? -1) + 1;

  const { error } = await admin.from("invoice_line_items").insert({
    invoice_id: invoiceId,
    sort_order,
    description,
    quantity: Number(formData.get("quantity")) || 1,
    unit: (formData.get("unit") as string) || "EA",
    unit_price: Number(formData.get("unit_price")) || 0,
    xactimate_code: (formData.get("xactimate_code") as string)?.trim() || null,
    category: (formData.get("category") as string)?.trim() || null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}/invoices/${invoiceId}`);
  return { ok: true };
}

export async function deleteInvoiceLine(
  lineItemId: string,
  invoiceId: string,
  jobId: string
) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("invoice_line_items")
    .delete()
    .eq("id", lineItemId);
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}/invoices/${invoiceId}`);
  return { ok: true };
}

export async function updateInvoiceMeta(
  invoiceId: string,
  jobId: string,
  updates: { due_date?: string; notes?: string }
) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("invoices")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", invoiceId);
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}/invoices/${invoiceId}`);
  return { ok: true };
}

async function loadInvoiceContext(invoiceId: string) {
  const admin = createAdminClient();
  const [{ data: invoice }, { data: fullLineItems }] = await Promise.all([
    admin
      .from("invoices")
      .select(
        "*, jobs(job_number, site_address, site_city, site_state, site_zip, customers(name, insurance_company, insurance_claim_number))"
      )
      .eq("id", invoiceId)
      .single(),
    admin
      .from("invoice_line_items")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("sort_order", { ascending: true }),
  ]);

  if (!invoice) throw new Error("Invoice not found");

  const items = fullLineItems ?? [];
  const total = items.reduce(
    (s: number, li: any) => s + Number(li.line_total ?? 0),
    0
  );
  const job = invoice.jobs as any;
  const customer = job?.customers as any;
  const lossAddress = [
    job?.site_address,
    job?.site_city,
    job?.site_state,
    job?.site_zip,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    invoice,
    total,
    ctx: {
      invoice_number: invoice.invoice_number,
      job_number: job?.job_number,
      customer_name: customer?.name ?? "—",
      insurance_company: customer?.insurance_company,
      claim_number: customer?.insurance_claim_number,
      loss_address: lossAddress || null,
      total,
      due_date: invoice.due_date,
      line_items: items.map((li: any) => ({
        category: li.category,
        xactimate_code: li.xactimate_code,
        description: li.description,
        quantity: Number(li.quantity),
        unit: li.unit,
        unit_price: Number(li.unit_price),
        line_total: Number(li.line_total),
      })),
    },
  };
}

export async function sendInvoice(
  invoiceId: string,
  jobId: string,
  recipientEmail: string
) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };
  if (!recipientEmail.trim()) return { error: "Recipient email required." };

  const admin = createAdminClient();

  let payload;
  try {
    payload = await loadInvoiceContext(invoiceId);
  } catch (err: any) {
    return { error: err.message };
  }

  const { subject, html } = buildInvoiceEmail(payload.ctx);

  try {
    await sendEmail({ to: recipientEmail, subject, html });
  } catch (err: any) {
    return { error: `Email failed: ${err.message}` };
  }

  const { error } = await admin
    .from("invoices")
    .update({
      status: "sent",
      sent_to: recipientEmail,
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}/invoices/${invoiceId}`);
  revalidatePath("/ar");
  return { ok: true };
}

export async function sendReminder(
  invoiceId: string,
  jobId: string,
  type: "gentle" | "firm" | "final"
) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  let payload;
  try {
    payload = await loadInvoiceContext(invoiceId);
  } catch (err: any) {
    return { error: err.message };
  }

  if (!payload.invoice.sent_to) {
    return { error: "Invoice has no recipient. Send the original invoice first." };
  }

  // Days outstanding
  const sentAt = payload.invoice.sent_at
    ? new Date(payload.invoice.sent_at).getTime()
    : Date.now();
  const days = Math.floor((Date.now() - sentAt) / (1000 * 60 * 60 * 24));

  const { subject, html } = buildReminderEmail(
    { ...payload.ctx, days_outstanding: days },
    type
  );

  try {
    await sendEmail({ to: payload.invoice.sent_to, subject, html });
  } catch (err: any) {
    return { error: `Email failed: ${err.message}` };
  }

  await admin.from("invoice_reminders").insert({
    invoice_id: invoiceId,
    reminder_type: type,
    sent_to: payload.invoice.sent_to,
    email_subject: subject,
    email_body: html,
    sent_by: user.id,
  });

  revalidatePath(`/jobs/${jobId}/invoices/${invoiceId}`);
  revalidatePath("/ar");
  return { ok: true };
}

export async function recordPayment(
  invoiceId: string,
  jobId: string,
  formData: FormData
) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const amount = Number(formData.get("amount"));
  if (!amount || amount <= 0) return { error: "Amount must be positive." };

  const method = (formData.get("method") as string) || null;
  const reference = (formData.get("reference") as string)?.trim() || null;
  const received_at_raw = formData.get("received_at") as string;
  const notes = (formData.get("notes") as string)?.trim() || null;

  const admin = createAdminClient();
  const { error: payErr } = await admin.from("payments").insert({
    invoice_id: invoiceId,
    amount,
    method,
    reference,
    received_at: received_at_raw || new Date().toISOString().split("T")[0],
    notes,
    recorded_by: user.id,
  });
  if (payErr) return { error: payErr.message };

  // Recompute invoice status: sum payments vs total
  const [{ data: payments }, { data: lines }] = await Promise.all([
    admin.from("payments").select("amount").eq("invoice_id", invoiceId),
    admin.from("invoice_line_items").select("line_total").eq("invoice_id", invoiceId),
  ]);
  const totalPaid = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const totalDue = (lines ?? []).reduce((s, l) => s + Number(l.line_total ?? 0), 0);

  let newStatus: string;
  if (totalPaid >= totalDue) newStatus = "paid";
  else if (totalPaid > 0) newStatus = "partial";
  else newStatus = "sent";

  await admin
    .from("invoices")
    .update({
      status: newStatus,
      paid_at: newStatus === "paid" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);

  revalidatePath(`/jobs/${jobId}/invoices/${invoiceId}`);
  revalidatePath("/ar");
  return { ok: true };
}

export async function deletePayment(
  paymentId: string,
  invoiceId: string,
  jobId: string
) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  await admin.from("payments").delete().eq("id", paymentId);

  // Recompute status
  const [{ data: payments }, { data: lines }] = await Promise.all([
    admin.from("payments").select("amount").eq("invoice_id", invoiceId),
    admin.from("invoice_line_items").select("line_total").eq("invoice_id", invoiceId),
  ]);
  const totalPaid = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const totalDue = (lines ?? []).reduce((s, l) => s + Number(l.line_total ?? 0), 0);

  let newStatus: string;
  if (totalPaid >= totalDue && totalDue > 0) newStatus = "paid";
  else if (totalPaid > 0) newStatus = "partial";
  else newStatus = "sent";

  await admin
    .from("invoices")
    .update({
      status: newStatus,
      paid_at: newStatus === "paid" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);

  revalidatePath(`/jobs/${jobId}/invoices/${invoiceId}`);
  revalidatePath("/ar");
  return { ok: true };
}

export async function voidInvoice(invoiceId: string, jobId: string) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("invoices")
    .update({ status: "void", updated_at: new Date().toISOString() })
    .eq("id", invoiceId);
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}/invoices/${invoiceId}`);
  revalidatePath("/ar");
  return { ok: true };
}
