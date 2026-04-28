"use server";

import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function createEquipment(
  _prev: { error?: string } | undefined,
  formData: FormData
) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  const type = formData.get("type") as string;
  const serial_number = (formData.get("serial_number") as string)?.trim();
  const model = (formData.get("model") as string)?.trim() || null;
  const manufacturer = (formData.get("manufacturer") as string)?.trim() || null;
  const purchased_at_raw = formData.get("purchased_at") as string;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!type || !serial_number) return { error: "Type and serial number are required." };

  const { data, error } = await admin
    .from("equipment")
    .insert({
      type,
      serial_number,
      model,
      manufacturer,
      purchased_at: purchased_at_raw || null,
      notes,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/equipment");
  redirect(`/equipment/${data.id}`);
}

export async function updateEquipment(id: string, formData: FormData) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  const updates: Record<string, any> = {
    serial_number: (formData.get("serial_number") as string)?.trim(),
    model: (formData.get("model") as string)?.trim() || null,
    manufacturer: (formData.get("manufacturer") as string)?.trim() || null,
    location_notes: (formData.get("location_notes") as string)?.trim() || null,
    notes: (formData.get("notes") as string)?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin.from("equipment").update(updates).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/equipment/${id}`);
  revalidatePath("/equipment");
  return { ok: true };
}

export async function assignToJob(
  equipmentId: string,
  jobId: string,
  hoursAtDeploy: number
) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  // Insert assignment
  const { error: assignErr } = await admin.from("equipment_assignments").insert({
    equipment_id: equipmentId,
    job_id: jobId,
    deployed_by: user.id,
    hours_at_deploy: hoursAtDeploy,
  });
  if (assignErr) return { error: assignErr.message };

  // Update equipment status
  const { error: equipErr } = await admin
    .from("equipment")
    .update({
      status: "deployed",
      current_job_id: jobId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", equipmentId);
  if (equipErr) return { error: equipErr.message };

  revalidatePath(`/equipment/${equipmentId}`);
  revalidatePath("/equipment");
  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

export async function retrieveFromJob(
  equipmentId: string,
  hoursAtReturn: number,
  notes: string
) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  // Find the open assignment for this equipment
  const { data: openAssign, error: findErr } = await admin
    .from("equipment_assignments")
    .select("id, hours_at_deploy, job_id")
    .eq("equipment_id", equipmentId)
    .is("retrieved_at", null)
    .order("deployed_at", { ascending: false })
    .limit(1)
    .single();

  if (findErr || !openAssign) {
    return { error: "No open assignment found for this equipment." };
  }

  // Close the assignment
  const { error: closeErr } = await admin
    .from("equipment_assignments")
    .update({
      retrieved_at: new Date().toISOString(),
      retrieved_by: user.id,
      hours_at_return: hoursAtReturn,
      notes: notes || null,
    })
    .eq("id", openAssign.id);
  if (closeErr) return { error: closeErr.message };

  // Update equipment: clear deployment, add hours
  const hoursWorked = Math.max(
    0,
    hoursAtReturn - (Number(openAssign.hours_at_deploy) || 0)
  );

  // Get current hours_logged
  const { data: equip } = await admin
    .from("equipment")
    .select("hours_logged")
    .eq("id", equipmentId)
    .single();

  const newHoursLogged = (Number(equip?.hours_logged) || 0) + hoursWorked;

  const { error: equipErr } = await admin
    .from("equipment")
    .update({
      status: "available",
      current_job_id: null,
      hours_logged: newHoursLogged,
      updated_at: new Date().toISOString(),
    })
    .eq("id", equipmentId);
  if (equipErr) return { error: equipErr.message };

  revalidatePath(`/equipment/${equipmentId}`);
  revalidatePath("/equipment");
  revalidatePath(`/jobs/${openAssign.job_id}`);
  return { ok: true };
}

export async function setStatus(
  equipmentId: string,
  newStatus: "available" | "maintenance" | "retired"
) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  const { error } = await admin
    .from("equipment")
    .update({
      status: newStatus,
      current_job_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", equipmentId);
  if (error) return { error: error.message };

  revalidatePath(`/equipment/${equipmentId}`);
  revalidatePath("/equipment");
  return { ok: true };
}

export async function getActiveJobs() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("jobs")
    .select("id, job_number, customers(name)")
    .not("status", "in", "(completed,cancelled)")
    .order("created_at", { ascending: false })
    .limit(100);
  return (
    data?.map((j) => ({
      id: j.id,
      job_number: j.job_number,
      customer_name: (j.customers as any)?.name ?? "—",
    })) ?? []
  );
}

export async function deleteEquipment(id: string) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { error } = await admin.from("equipment").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/equipment");
  redirect("/equipment");
}
