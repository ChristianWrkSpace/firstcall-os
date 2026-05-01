"use server";

import { createAdminClient, createServerSupabaseClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth-helpers";

export async function updateCostBasis(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData
) {
  const me = await getCurrentUser();
  if (!me) return { error: "Not authenticated." };
  if (me.role !== "owner" && me.role !== "manager") {
    return { error: "Owner or manager only." };
  }

  const default_hourly_rate = Number(formData.get("default_hourly_rate"));
  const van_cost_per_job = Number(formData.get("van_cost_per_job"));
  const monthly_overhead = Number(formData.get("monthly_overhead"));
  const default_equipment_daily = Number(formData.get("default_equipment_daily"));

  if (
    [default_hourly_rate, van_cost_per_job, monthly_overhead, default_equipment_daily].some(
      (n) => !Number.isFinite(n) || n < 0
    )
  ) {
    return { error: "All values must be non-negative numbers." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("cost_basis_settings")
    .update({
      default_hourly_rate,
      van_cost_per_job,
      monthly_overhead,
      default_equipment_daily,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) return { error: error.message };

  logAudit({
    user: me,
    action: "cost_basis.updated",
    entity_type: "cost_basis_settings",
    entity_id: "1",
    details: {
      default_hourly_rate,
      van_cost_per_job,
      monthly_overhead,
      default_equipment_daily,
    },
  });

  revalidatePath("/settings/cost-basis");
  revalidatePath("/reports/job-economics");
  return { ok: true };
}
