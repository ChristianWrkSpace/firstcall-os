"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import {
  canLogInvestmentFor,
  type InvestmentCategory,
  type PartnerType,
  type PayoutMethod,
} from "@/lib/partner-types";

export async function updatePartner(
  partnerId: string,
  fields: { name?: string; company?: string; phone?: string; email?: string; partner_type?: PartnerType; notes?: string; active?: boolean }
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };
  if (user.role === "technician") {
    return { error: "Office, manager, or owner only." };
  }

  const supabase = await createServerSupabaseClient();
  const update: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) update[k] = v;
  }
  if (Object.keys(update).length === 0) return { ok: true };

  const { error } = await supabase
    .from("partners")
    .update(update)
    .eq("id", partnerId);
  if (error) return { error: error.message };

  logAudit({
    user,
    action: "partner.updated",
    entity_type: "partner",
    entity_id: partnerId,
    details: update,
  });

  revalidatePath(`/partners/${partnerId}`);
  revalidatePath("/partners");
  return { ok: true };
}

export async function logPartnerPayout(
  partnerId: string,
  data: {
    amount: number;
    occurred_on: string; // YYYY-MM-DD
    method: PayoutMethod;
    reference?: string;
    job_id?: string;
    notes?: string;
  }
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };
  if (user.role !== "owner" && user.role !== "manager") {
    return { error: "Cash payouts are owner/manager only." };
  }
  if (data.amount <= 0) return { error: "Amount must be greater than zero." };

  const supabase = await createServerSupabaseClient();

  // Block payouts to insurance adjusters
  const { data: partner } = await supabase
    .from("partners")
    .select("partner_type, name")
    .eq("id", partnerId)
    .single();
  if (!partner) return { error: "Partner not found." };
  if (!canLogInvestmentFor(partner.partner_type)) {
    return {
      error:
        "Cannot log a cash payout to an insurance adjuster. TX Insurance Code § 4102.158 prohibits paying value for claim referrals.",
    };
  }

  const { error } = await supabase.from("partner_payouts").insert({
    partner_id: partnerId,
    job_id: data.job_id ?? null,
    occurred_on: data.occurred_on,
    amount: data.amount,
    method: data.method,
    reference: data.reference ?? null,
    notes: data.notes ?? null,
    recorded_by: user.id,
  });
  if (error) return { error: error.message };

  logAudit({
    user,
    action: "partner.payout_logged",
    entity_type: "partner",
    entity_id: partnerId,
    details: { amount: data.amount, method: data.method, job_id: data.job_id ?? null },
  });

  revalidatePath(`/partners/${partnerId}`);
  return { ok: true };
}

export async function logPartnerInvestment(
  partnerId: string,
  data: {
    amount: number;
    occurred_on: string;
    category: InvestmentCategory;
    notes?: string;
  }
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };
  if (user.role === "technician") {
    return { error: "Office / manager / owner only." };
  }
  if (data.amount < 0) return { error: "Amount cannot be negative." };

  const supabase = await createServerSupabaseClient();

  const { data: partner } = await supabase
    .from("partners")
    .select("partner_type, name")
    .eq("id", partnerId)
    .single();
  if (!partner) return { error: "Partner not found." };
  if (!canLogInvestmentFor(partner.partner_type)) {
    return {
      error:
        "Cannot log an investment for an insurance adjuster (TX Insurance Code § 4102.158).",
    };
  }

  const { error } = await supabase.from("partner_investments").insert({
    partner_id: partnerId,
    occurred_on: data.occurred_on,
    amount: data.amount,
    category: data.category,
    notes: data.notes ?? null,
    recorded_by: user.id,
  });
  if (error) return { error: error.message };

  logAudit({
    user,
    action: "partner.investment_logged",
    entity_type: "partner",
    entity_id: partnerId,
    details: { amount: data.amount, category: data.category },
  });

  revalidatePath(`/partners/${partnerId}`);
  return { ok: true };
}

export async function deletePartnerLedgerEntry(
  kind: "payout" | "investment",
  entryId: string,
  partnerId: string
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };
  if (user.role !== "owner" && user.role !== "manager") {
    return { error: "Owner / manager only." };
  }

  const supabase = await createServerSupabaseClient();
  const table = kind === "payout" ? "partner_payouts" : "partner_investments";
  const { error } = await supabase.from(table).delete().eq("id", entryId);
  if (error) return { error: error.message };

  logAudit({
    user,
    action: `partner.${kind}_deleted`,
    entity_type: "partner",
    entity_id: partnerId,
    details: { entry_id: entryId },
  });

  revalidatePath(`/partners/${partnerId}`);
  return { ok: true };
}
