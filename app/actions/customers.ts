"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";

export async function setCustomerAutoNotify(
  customerId: string,
  jobId: string,
  enabled: boolean
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("customers")
    .update({ auto_notify_emails: enabled })
    .eq("id", customerId);

  if (error) return { error: error.message };

  logAudit({
    user,
    action: "customer.auto_notify_set",
    entity_type: "customer",
    entity_id: customerId,
    details: { enabled },
  });

  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

export interface CustomerIntake {
  name: string;
  phone?: string | null;
  email?: string | null;
  insurance_company?: string | null;
  insurance_policy_number?: string | null;
  insurance_claim_number?: string | null;
}

/**
 * Edit the customer's contact + insurance info from the job page. Office
 * usually starts a job with just first-name-and-phone over the phone, then
 * fills in the rest (full legal name, policy/claim #) when the tech meets
 * the customer on site.
 */
export async function updateCustomerInfo(
  customerId: string,
  jobId: string,
  patch: CustomerIntake
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const trimmedName = patch.name?.trim();
  if (!trimmedName) return { error: "Name is required." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("customers")
    .update({
      name: trimmedName,
      phone: patch.phone?.trim() || null,
      email: patch.email?.trim() || null,
      insurance_company: patch.insurance_company?.trim() || null,
      insurance_policy_number: patch.insurance_policy_number?.trim() || null,
      insurance_claim_number: patch.insurance_claim_number?.trim() || null,
    })
    .eq("id", customerId);

  if (error) return { error: error.message };

  logAudit({
    user,
    action: "customer.info_updated",
    entity_type: "customer",
    entity_id: customerId,
    details: { jobId },
  });

  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}
