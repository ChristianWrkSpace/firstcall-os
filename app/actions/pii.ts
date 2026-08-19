"use server";

import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";

export interface PiiSearchResult {
  type: "customer";
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  job_count: number;
  invoice_count: number;
  payment_count: number;
}

export async function searchCustomerForPii(
  query: string
): Promise<{ results: PiiSearchResult[] } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };
  if (user.role !== "owner" && user.role !== "manager") {
    return { error: "Owner / manager only." };
  }
  if (!query.trim()) return { results: [] };

  const supabase = await createServerSupabaseClient();
  const q = `%${query.trim()}%`;
  const { data, error } = await supabase
    .from("customers")
    .select(
      "id, name, email, phone, jobs(count), jobs!inner(invoices(count), invoices!inner(payments(count)))"
    )
    .or(`name.ilike.${q},email.ilike.${q},phone.ilike.${q}`)
    .limit(15);

  if (error) {
    // Fallback to a simpler query that doesn't try to count nested records
    const { data: simple } = await supabase
      .from("customers")
      .select("id, name, email, phone")
      .or(`name.ilike.${q},email.ilike.${q},phone.ilike.${q}`)
      .limit(15);

    return {
      results: ((simple ?? []) as any[]).map((c) => ({
        type: "customer" as const,
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        job_count: 0,
        invoice_count: 0,
        payment_count: 0,
      })),
    };
  }

  return {
    results: ((data ?? []) as any[]).map((c) => ({
      type: "customer" as const,
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      job_count: 0,
      invoice_count: 0,
      payment_count: 0,
    })),
  };
}

export async function deleteCustomerPii(
  customerId: string,
  reason: string
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };
  if (user.role !== "owner") {
    return { error: "Only the Owner can perform PII deletion." };
  }
  if (!reason.trim()) {
    return { error: "Reason / ticket reference required (will be logged)." };
  }

  const admin = createAdminClient();

  // Confirm the row exists without copying erased PII into durable logs.
  const { data: snapshot } = await admin
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .single();

  if (!snapshot) return { error: "Customer not found." };

  // Redact PII columns rather than deleting the row entirely. This preserves
  // financial records (invoices, payments) for tax/audit while removing
  // identifying data per Texas privacy law (Tex. Bus. & Com. Code § 521.052).
  const redactionId = `[REDACTED-${customerId.slice(0, 8)}]`;
  const { error: redactError } = await admin
    .from("customers")
    .update({
      name: redactionId,
      email: null,
      phone: null,
      address: null,
      city: null,
      state: null,
      zip: null,
      insurance_company: null,
      insurance_policy_number: null,
      insurance_claim_number: null,
      notes: null,
    })
    .eq("id", customerId);

  if (redactError) return { error: redactError.message };

  await logAudit({
    user,
    action: "customer.pii_redacted",
    entity_type: "customer",
    entity_id: customerId,
    details: {
      reason: reason.trim(),
      redaction_id: redactionId,
      fields_redacted: [
        "name",
        "email",
        "phone",
        "address",
        "city",
        "state",
        "zip",
        "insurance_company",
        "insurance_policy_number",
        "insurance_claim_number",
        "notes",
      ],
    },
  });

  return { ok: true, redactionId };
}
