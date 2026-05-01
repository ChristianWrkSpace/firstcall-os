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
