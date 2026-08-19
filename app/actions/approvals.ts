"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { logAgentOutcome, kindToAgentTask } from "@/lib/agent-feedback";

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
  if (deleteUnderlying && user.role !== "owner" && user.role !== "manager") {
    return { error: "Only owners and managers can delete underlying drafts." };
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("pending_approvals")
    .select("id, kind, entity_type, entity_id, job_id")
    .eq("id", approvalId)
    .single();
  if (!row) return { error: "Approval not found." };

  const { error: dismissError } = await admin
    .from("pending_approvals")
    .update({
      status: "rejected",
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    })
    .eq("id", approvalId);
  if (dismissError) return { error: "Unable to dismiss the approval." };

  // Optional: delete the underlying draft if asked. Hard rule: NEVER delete
  // the underlying entity if it's already been approved/sent/signed/paid.
  // Once a doc is committed, it's a permanent record on the job.
  let underlyingDeleted = false;
  let underlyingArchived = false;
  let refusedReason: string | null = null;
  if (deleteUnderlying && row.entity_type && row.entity_id) {
    if (row.entity_type === "legal_document") {
      const { data: ld } = await admin
        .from("legal_documents")
        .select("status, automation_key")
        .eq("id", row.entity_id)
        .single();
      if (!ld) {
        refusedReason = "legal document no longer exists";
      } else if (ld.status !== "draft" && ld.status !== "void") {
        refusedReason = `legal doc is ${ld.status}, cannot delete a committed record`;
      } else if (ld.automation_key) {
        if (ld.status === "void") {
          underlyingArchived = true;
        } else {
          const { data: archived, error: archiveError } = await admin
            .from("legal_documents")
            .update({ status: "void" })
            .eq("id", row.entity_id)
            .eq("status", "draft")
            .select("id")
            .maybeSingle();
          if (archiveError || !archived) {
            refusedReason = "automated draft changed before it could be archived";
          } else {
            underlyingArchived = true;
          }
        }
      } else {
        refusedReason = "manual legal drafts must be deleted from the document page";
      }
    } else if (row.entity_type === "estimate" || row.entity_type === "invoice") {
      refusedReason = `${row.entity_type} drafts must be removed from their dedicated workflow`;
    }
  }

  await logAudit({
    user,
    action: "approval.dismissed",
    entity_type: "pending_approval",
    entity_id: approvalId,
    details: {
      deleted_underlying: underlyingDeleted,
      archived_underlying: underlyingArchived,
      delete_refused: refusedReason,
      kind: row.kind,
    },
  });

  // Outcome telemetry — closes the Turing 2026-05-04 gap (3/16 coverage).
  // Dismissing an approval is a "rejected" signal for the underlying agent.
  const at = kindToAgentTask(row.kind);
  if (at) {
    after(() =>
      logAgentOutcome({
        agent: at.agent,
        task: at.task,
        outcome: "rejected",
        jobId: row.job_id ?? null,
        entityType: row.entity_type ?? null,
        entityId: row.entity_id ?? null,
        userId: user.id,
        delta: {
          via: "approval.dismissed",
          deleted_underlying: underlyingDeleted,
          archived_underlying: underlyingArchived,
        },
      })
    );
  }

  revalidatePath("/approvals");
  if (row.job_id) revalidatePath(`/jobs/${row.job_id}`);
  if (refusedReason) {
    return {
      ok: true,
      message: `Inbox entry dismissed, but the ${row.entity_type} was kept (${refusedReason}).`,
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

  // Outcome telemetry — applying a status suggestion is "approved_unchanged"
  // for the agent that proposed it (Echo).
  const at = kindToAgentTask(row.kind);
  if (at) {
    after(() =>
      logAgentOutcome({
        agent: at.agent,
        task: at.task,
        outcome: "approved_unchanged",
        jobId: row.job_id ?? null,
        userId: user.id,
        delta: { via: "approval.suggestion_applied", new_status: newStatus },
      })
    );
  }

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
  const { data: job } = await admin
    .from("jobs")
    .select("is_test")
    .eq("id", jobId)
    .single();
  if (!job) return { error: "Job not found." };
  if (job.is_test && !paused) {
    return { error: "Test jobs must keep automation paused." };
  }

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
