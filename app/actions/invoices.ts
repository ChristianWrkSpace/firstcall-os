"use server";

import { createAdminClient } from "@/lib/supabase-server";
import { sendEmail } from "@/lib/resend";
import { buildInvoiceEmail, buildReminderEmail } from "@/lib/abacus-templates";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";

export async function createInvoiceFromManualAmount(jobId: string) {
  const auth = await requirePermission("invoices.edit");
  if ("error" in auth) return auth;

  const due = new Date();
  due.setDate(due.getDate() + 30);

  const admin = createAdminClient();
  const { data: invoiceId, error } = await admin.rpc(
    "create_manual_invoice_from_job_amount",
    {
      p_job_id: jobId,
      p_due_date: due.toISOString().split("T")[0],
      p_created_by: auth.user.id,
    }
  );
  if (error || !invoiceId) {
    return {
      error:
        error?.message === "Enter a billing amount greater than zero first"
          ? "Enter and save a billing amount greater than zero first."
          : "Unable to create the draft invoice.",
    };
  }

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/ar");
  redirect(`/jobs/${jobId}/invoices/${invoiceId}`);
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
  const auth = await requirePermission("invoices.edit");
  if ("error" in auth) return auth;

  const admin = createAdminClient();
  const { error } = await admin
    .from("invoice_line_items")
    .update(updates)
    .eq("id", lineItemId);
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}/invoices/${invoiceId}`);
  return { ok: true, error: undefined };
}

export async function addInvoiceLine(
  invoiceId: string,
  jobId: string,
  formData: FormData
) {
  const auth = await requirePermission("invoices.edit");
  if ("error" in auth) return auth;

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
  return { ok: true, error: undefined };
}

export async function deleteInvoiceLine(
  lineItemId: string,
  invoiceId: string,
  jobId: string
) {
  const auth = await requirePermission("invoices.edit");
  if ("error" in auth) return auth;

  const admin = createAdminClient();
  const { error } = await admin
    .from("invoice_line_items")
    .delete()
    .eq("id", lineItemId);
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}/invoices/${invoiceId}`);
  return { ok: true, error: undefined };
}

export async function updateInvoiceMeta(
  invoiceId: string,
  jobId: string,
  updates: { due_date?: string; notes?: string }
) {
  const auth = await requirePermission("invoices.edit");
  if ("error" in auth) return auth;

  const admin = createAdminClient();
  const { error } = await admin
    .from("invoices")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", invoiceId);
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}/invoices/${invoiceId}`);
  return { ok: true, error: undefined };
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
  const check = await requirePermission("invoices.send");
  if ("error" in check) return { error: check.error };
  const user = check.user;
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

  await logAudit({
    user,
    action: "invoice.sent",
    entity_type: "invoice",
    entity_id: invoiceId,
    details: { recipient: recipientEmail, job_id: jobId },
  });

  revalidatePath(`/jobs/${jobId}/invoices/${invoiceId}`);
  revalidatePath("/ar");
  return { ok: true, error: undefined };
}

export async function sendReminder(
  invoiceId: string,
  jobId: string,
  type: "gentle" | "firm" | "final"
) {
  const auth = await requirePermission("invoices.send");
  if ("error" in auth) return auth;
  const user = auth.user;

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
  return { ok: true, error: undefined };
}

export async function recordPayment(
  invoiceId: string,
  jobId: string,
  formData: FormData
) {
  const check = await requirePermission("invoices.record_payment");
  if ("error" in check) return { error: check.error };
  const user = check.user;

  const amount = Number(formData.get("amount"));
  if (!amount || amount <= 0) return { error: "Amount must be positive." };

  const method = (formData.get("method") as string) || null;
  const reference = (formData.get("reference") as string)?.trim() || null;
  const received_at_raw = formData.get("received_at") as string;
  const notes = (formData.get("notes") as string)?.trim() || null;

  const admin = createAdminClient();
  const { data: newStatus, error: paymentError } = await admin.rpc(
    "record_payment_and_reconcile",
    {
      p_invoice_id: invoiceId,
      p_amount: amount,
      p_method: method,
      p_reference: reference,
      p_received_at: received_at_raw || new Date().toISOString().split("T")[0],
      p_notes: notes,
      p_recorded_by: user.id,
    }
  );
  if (paymentError) {
    return { error: "Unable to record and reconcile the payment." };
  }

  await logAudit({
    user,
    action: "payment.recorded",
    entity_type: "invoice",
    entity_id: invoiceId,
    details: { amount, method, reference, new_status: newStatus, job_id: jobId },
  });

  revalidatePath(`/jobs/${jobId}/invoices/${invoiceId}`);
  revalidatePath("/ar");
  return { ok: true, error: undefined };
}

export async function deletePayment(
  paymentId: string,
  invoiceId: string,
  jobId: string
) {
  const auth = await requirePermission("payments.delete");
  if ("error" in auth) return auth;

  const admin = createAdminClient();
  const { error } = await admin.rpc("delete_payment_and_reconcile", {
    p_payment_id: paymentId,
    p_invoice_id: invoiceId,
  });
  if (error) return { error: "Unable to delete and reconcile the payment." };

  revalidatePath(`/jobs/${jobId}/invoices/${invoiceId}`);
  revalidatePath("/ar");
  return { ok: true, error: undefined };
}

export async function voidInvoice(invoiceId: string, jobId: string) {
  const check = await requirePermission("invoices.void");
  if ("error" in check) return { error: check.error };
  const user = check.user;

  const admin = createAdminClient();
  const { error } = await admin
    .from("invoices")
    .update({ status: "void", updated_at: new Date().toISOString() })
    .eq("id", invoiceId);
  if (error) return { error: error.message };

  await logAudit({
    user,
    action: "invoice.voided",
    entity_type: "invoice",
    entity_id: invoiceId,
    details: { job_id: jobId },
  });

  revalidatePath(`/jobs/${jobId}/invoices/${invoiceId}`);
  revalidatePath("/ar");
  return { ok: true, error: undefined };
}
