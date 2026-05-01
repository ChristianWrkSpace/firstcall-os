"use server";

import { createAdminClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

const VALID_CATEGORIES = [
  "fuel",
  "maintenance",
  "insurance",
  "lease",
  "registration",
  "tolls",
  "parking",
  "other",
] as const;

export async function logExpense(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData
) {
  const me = await getCurrentUser();
  if (!me) return { error: "Not authenticated." };
  if (me.role !== "owner" && me.role !== "manager" && me.role !== "office") {
    return { error: "Office, manager, or owner only." };
  }

  const expense_date = (formData.get("expense_date") as string) || new Date().toISOString().slice(0, 10);
  const category = formData.get("category") as string;
  const amount = Number(formData.get("amount"));
  const vehicle_id = ((formData.get("vehicle_id") as string) ?? "").trim() || null;
  const notes = ((formData.get("notes") as string) ?? "").trim() || null;

  if (!VALID_CATEGORIES.includes(category as any)) {
    return { error: "Invalid category." };
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return { error: "Amount must be ≥ 0." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("vehicle_expenses").insert({
    expense_date,
    category,
    amount,
    vehicle_id,
    notes,
  });
  if (error) return { error: error.message };

  revalidatePath("/expenses");
  return { ok: true };
}

export async function deleteExpense(id: string) {
  const me = await getCurrentUser();
  if (!me) return { error: "Not authenticated." };
  if (me.role !== "owner" && me.role !== "manager") {
    return { error: "Owner or manager only." };
  }
  const admin = createAdminClient();
  const { error } = await admin.from("vehicle_expenses").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/expenses");
  return { ok: true };
}
