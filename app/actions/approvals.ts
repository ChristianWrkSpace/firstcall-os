"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";

export async function listPendingApprovals(limit: number = 25) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("pending_approvals")
    .select("id, kind, job_id, entity_type, entity_id, title, detail, link, source, status, created_at, metadata")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return { error: error.message, items: [] };
  return { items: data ?? [] };
}

export async function dismissApproval(approvalId: string, deleteUnderlying: boolean = false) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("pending_approvals")
    .select("id, kind, entity_type, entity_id, job_id")
    .eq("id", approvalId)
    .single();
  if (!row) return { error: "Approval not found." };

  await admin
    .from("pending_approvals")
    .update({
      status: "rejected",
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    })
    .eq("id", approvalId);

  // Optional: delete the underlying draft if asked. Hard rule: NEVER delete
  // the underlying entity if it's already been approved/sent/signed/paid.
  // Once a doc is committed, it's a permanent record on the job.
  let underlyingDeleted = false;
  let refusedReason: string | null = null;
  if (deleteUnderlying && row.entity_type && row.entity_id) {
    if (row.entity_type === "legal_document") {
      const { data: ld } = await admin
        .from("legal_documents")
        .select("status")
        .eq("id", row.entity_id)
        .single();
      if (ld && ld.status !== "draft" && ld.status !== "void") {
        refusedReason = `legal doc is ${ld.status}, cannot delete a committed record`;
      } else {
        await admin.from("legal_documents").delete().eq("id", row.entity_id);
        underlyingDeleted = true;
      }
    } else if (row.entity_type === "estimate") {
      const { data: est } = await admin
        .from("estimates")
        .select("status")
        .eq("id", row.entity_id)
        .single();
      if (est && est.status !== "draft") {
        refusedReason = `estimate is ${est.status}, cannot delete after approval/send`;
      } else {
        await admin.from("estimate_line_items").delete().eq("estimate_id", row.entity_id);
        await admin.from("estimates").delete().eq("id", row.entity_id);
        underlyingDeleted = true;
      }
    } else if (row.entity_type === "invoice") {
      const { data: inv } = await admin
        .from("invoices")
        .select("status")
        .eq("id", row.entity_id)
        .single();
      if (inv && inv.status !== "draft") {
        refusedReason = `invoice is ${inv.status}, cannot delete after send/payment`;
      } else {
        await admin.from("invoice_line_items").delete().eq("invoice_id", row.entity_id);
        await admin.from("invoices").delete().eq("id", row.entity_id);
        underlyingDeleted = true;
      }
    }
  }

  logAudit({
    user,
    action: "approval.dismissed",
    entity_type: "pending_approval",
    entity_id: approvalId,
    details: {
      deleted_underlying: underlyingDeleted,
      delete_refused: refusedReason,
      kind: row.kind,
    },
  });

  revalidatePath("/approvals");
  if (row.job_id) revalidatePath(`/jobs/${row.job_id}`);
  if (refusedReason) {
    return {
      ok: true,
      message: `Inbox entry dismissed, but the ${row.entity_type} was kept on the job because it has been committed (${refusedReason}).`,
    };
  }
  return { ok: true };
}

/**
 * For status_suggestion approvals only — apply the suggested change.
 * For draft approvals (estimate/legal/invoice/etc.), the user reviews via
 * the entity's own page; this action is not used for those.
 */
export async function applySuggestion(approvalId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("pending_approvals")
    .select("id, kind, job_id, metadata")
    .eq("id", approvalId)
    .single();
  if (!row) return { error: "Approval not found." };
  if (row.kind !== "status_suggestion") {
    return { error: "Only status suggestions can be applied directly." };
  }
  if (!row.job_id) return { error: "Suggestion has no job to apply to." };

  const meta: any = row.metadata ?? {};
  const newStatus = meta.suggested_status as string | undefined;
  if (!newStatus) return { error: "Suggestion has no target status." };

  // Update job status — uses the same auto-notify path as the manual flip
  const { error } = await admin
    .from("jobs")
    .update({ status: newStatus })
    .eq("id", row.job_id);
  if (error) return { error: error.message };

  // Trigger auto-notify after the response so the email send isn't killed
  after(async () => {
    try {
      const { autoNotifyOnStatusChange } = await import("@/lib/auto-notify");
      await autoNotifyOnStatusChange(row.job_id!, newStatus);
    } catch (err) {
      console.error("[approvals.applySuggestion.notify]", err);
    }
  });

  await admin
    .from("pending_approvals")
    .update({
      status: "approved",
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    })
    .eq("id", approvalId);

  logAudit({
    user,
    action: "approval.suggestion_applied",
    entity_type: "pending_approval",
    entity_id: approvalId,
    details: { new_status: newStatus, job_id: row.job_id },
  });

  revalidatePath("/approvals");
  revalidatePath(`/jobs/${row.job_id}`);
  return { ok: true };
}

export async function setJobAutoPaused(jobId: string, paused: boolean) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };
  if (user.role !== "owner" && user.role !== "manager") {
    return { error: "Owner / manager only." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("jobs")
    .update({ auto_actions_paused: paused })
    .eq("id", jobId);
  if (error) return { error: error.message };

  logAudit({
    user,
    action: paused ? "job.auto_paused" : "job.auto_resumed",
    entity_type: "job",
    entity_id: jobId,
  });

  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}
