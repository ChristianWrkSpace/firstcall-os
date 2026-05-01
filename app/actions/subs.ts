"use server";

import { createAdminClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

export async function createSub(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData
) {
  const me = await getCurrentUser();
  if (!me) return { error: "Not authenticated." };
  if (me.role !== "owner" && me.role !== "manager" && me.role !== "office") {
    return { error: "Office, manager, or owner only." };
  }

  const name = ((formData.get("name") as string) ?? "").trim();
  if (!name) return { error: "Name is required." };

  const admin = createAdminClient();
  const { error } = await admin.from("subcontractors").insert({
    name,
    trade: ((formData.get("trade") as string) ?? "").trim() || null,
    contact_name: ((formData.get("contact_name") as string) ?? "").trim() || null,
    phone: ((formData.get("phone") as string) ?? "").trim() || null,
    email: ((formData.get("email") as string) ?? "").trim() || null,
    ein_or_ssn_last4: ((formData.get("ein_or_ssn_last4") as string) ?? "").trim() || null,
    is_corporation: formData.get("is_corporation") === "on",
    notes: ((formData.get("notes") as string) ?? "").trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/subs");
  return { ok: true };
}

export async function logSubInvoice(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData
) {
  const me = await getCurrentUser();
  if (!me) return { error: "Not authenticated." };
  if (me.role !== "owner" && me.role !== "manager" && me.role !== "office") {
    return { error: "Office, manager, or owner only." };
  }

  const job_id = formData.get("job_id") as string;
  const subcontractor_id = formData.get("subcontractor_id") as string;
  const amount = Number(formData.get("amount"));
  const invoice_number = ((formData.get("invoice_number") as string) ?? "").trim() || null;
  const invoice_date = (formData.get("invoice_date") as string) || new Date().toISOString().slice(0, 10);
  const description = ((formData.get("description") as string) ?? "").trim() || null;
  const payment_method = (formData.get("payment_method") as string) || null;
  const paid_at_raw = formData.get("paid_at") as string;
  const paid_at = paid_at_raw ? new Date(paid_at_raw).toISOString() : null;

  if (!job_id) return { error: "Missing job." };
  if (!subcontractor_id) return { error: "Pick a subcontractor." };
  if (!Number.isFinite(amount) || amount < 0) return { error: "Amount must be ≥ 0." };

  const admin = createAdminClient();
  const { error } = await admin.from("sub_invoices").insert({
    job_id,
    subcontractor_id,
    invoice_number,
    invoice_date,
    amount,
    payment_method,
    paid_at,
    description,
    created_by: me.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/subs");
  revalidatePath(`/jobs/${job_id}`);
  return { ok: true };
}

export async function markSubInvoicePaid(invoiceId: string) {
  const me = await getCurrentUser();
  if (!me) return { error: "Not authenticated." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("sub_invoices")
    .update({ paid_at: new Date().toISOString() })
    .eq("id", invoiceId);
  if (error) return { error: error.message };
  revalidatePath("/subs");
  return { ok: true };
}
