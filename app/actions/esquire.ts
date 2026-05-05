"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import {
  generateLegalDocByType,
  type GenerateOptions,
  type InvoiceContext,
  type MoistureContext,
} from "@/lib/esquire";
import type { LegalDocType } from "@/lib/esquire-types";
import { autoSendLegalDocToCustomer } from "@/lib/auto-send-legal-doc";
import { resolveApprovalsForEntity } from "@/lib/auto-actions";
import { logAgentOutcome } from "@/lib/agent-feedback";
import { requireInputs, PreconditionError } from "@/lib/agent-preconditions";

/**
 * Manual override — send (or re-send) the doc to the customer right now,
 * bypassing auto-pause + opt-out checks. Useful when auto-send was blocked
 * but the office wants to push it through anyway.
 */
export async function manualSendLegalDocToCustomer(docId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };
  if (user.role === "technician") {
    return { error: "Office / manager / owner only." };
  }

  // Run synchronously this time so the office sees the result immediately
  await autoSendLegalDocToCustomer(docId, { force: true });

  // Fetch the result
  const admin = createAdminClient();
  const { data: doc } = await admin
    .from("legal_documents")
    .select("last_send_attempt, status, job_id")
    .eq("id", docId)
    .single();

  logAudit({
    user,
    action: "legal_doc.manual_send_triggered",
    entity_type: "legal_document",
    entity_id: docId,
    details: { result: doc?.last_send_attempt ?? null },
  });

  if (doc?.job_id) revalidatePath(`/jobs/${doc.job_id}/legal/${docId}`);
  return {
    ok: true,
    attempt: doc?.last_send_attempt ?? null,
    status: doc?.status ?? null,
  };
}

interface GenerateInput {
  jobId: string;
  docType: LegalDocType;
  invoiceId?: string;
  disputeSummary?: string;
}

export async function generateLegalDoc(input: GenerateInput) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const supabase = await createServerSupabaseClient();

  // Pull job + customer context
  const { data: job } = await supabase
    .from("jobs")
    .select(
      "id, job_number, type, description, site_address, site_city, site_state, site_zip, scope_assessment, created_at, customers(name, phone, email, address, city, state, zip, insurance_company, insurance_policy_number, insurance_claim_number)"
    )
    .eq("id", input.jobId)
    .single();

  if (!job) return { error: "Job not found." };

  const customer = (job as any).customers ?? {};

  // Law 1 — Bounded Inputs. Every legal doc references the customer by name,
  // the job number, and the damage type. Without these, Esquire would fill in
  // placeholders that won't survive a real legal review. Refuse upfront.
  try {
    requireInputs(
      "esquire.legal_doc_draft",
      {
        customer_name: customer.name,
        job_number: job.job_number,
        job_type: job.type,
      },
      ["customer_name", "job_number", "job_type"],
      "Confirm the customer name, job number, and damage type before drafting a legal document."
    );
  } catch (err) {
    if (err instanceof PreconditionError) return { error: err.message };
    throw err;
  }

  const opts: GenerateOptions = {
    job: {
      job_number: job.job_number,
      type: job.type ?? null,
      description: job.description ?? null,
      site_address: job.site_address ?? null,
      site_city: job.site_city ?? null,
      site_state: job.site_state ?? null,
      site_zip: job.site_zip ?? null,
      scope_assessment: job.scope_assessment ?? null,
      created_at: job.created_at ?? null,
    },
    customer: {
      name: customer.name ?? "(unknown)",
      phone: customer.phone ?? null,
      email: customer.email ?? null,
      address: customer.address ?? null,
      city: customer.city ?? null,
      state: customer.state ?? null,
      zip: customer.zip ?? null,
      insurance_company: customer.insurance_company ?? null,
      insurance_policy_number: customer.insurance_policy_number ?? null,
      insurance_claim_number: customer.insurance_claim_number ?? null,
    },
  };

  // Demand letter needs invoice context
  if (input.docType === "demand_letter") {
    if (!input.invoiceId) {
      return { error: "Pick an overdue invoice for the demand letter." };
    }
    const { data: invoice } = await supabase
      .from("invoices")
      .select(
        "id, invoice_number, status, sent_at, due_date, line_items:invoice_line_items(line_total), payments(amount)"
      )
      .eq("id", input.invoiceId)
      .single();

    if (!invoice) return { error: "Invoice not found." };

    const total = (invoice.line_items ?? []).reduce(
      (s: number, li: any) => s + Number(li.line_total ?? 0),
      0
    );
    const paid = (invoice.payments ?? []).reduce(
      (s: number, p: any) => s + Number(p.amount),
      0
    );
    const sentAt = invoice.sent_at ? new Date(invoice.sent_at) : null;
    const days_overdue = sentAt
      ? Math.max(0, Math.floor((Date.now() - sentAt.getTime()) / 86_400_000))
      : 0;

    const ctx: InvoiceContext = {
      invoice_number: invoice.invoice_number,
      total,
      paid,
      balance: total - paid,
      sent_at: invoice.sent_at ?? null,
      due_date: invoice.due_date ?? null,
      days_overdue,
    };
    opts.invoice = ctx;
  }

  // Drying certificate needs moisture readings
  if (input.docType === "drying_certificate") {
    const { data: readings } = await supabase
      .from("moisture_readings")
      .select("room, reading_date, is_dry_standard")
      .eq("job_id", input.jobId)
      .order("reading_date", { ascending: true });

    if (!readings || readings.length === 0) {
      return {
        error:
          "No moisture readings logged on this job — record at least one before drafting a drying certificate.",
      };
    }
    const rooms = Array.from(
      new Set((readings as any[]).map((r) => r.room).filter(Boolean))
    );
    const allDry = (readings as any[]).every((r) => r.is_dry_standard);
    const ctx: MoistureContext = {
      rooms,
      reading_count: readings.length,
      first_reading_date: readings[0]?.reading_date ?? null,
      last_reading_date: readings[readings.length - 1]?.reading_date ?? null,
      all_dry_standard: allDry,
    };
    opts.moisture = ctx;
  }

  if (input.docType === "notice_of_appraisal") {
    opts.disputeSummary = input.disputeSummary ?? "";
  }

  let drafted: { subject: string; body: string };
  try {
    drafted = await generateLegalDocByType(input.docType, opts);
  } catch (err: any) {
    console.error("[esquire.generate]", err);
    return { error: err?.message ?? "Generation failed." };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("legal_documents")
    .insert({
      job_id: input.jobId,
      doc_type: input.docType,
      subject: drafted.subject,
      body: drafted.body,
      status: "draft",
      generated_by: user.id,
      generation_meta: {
        model: "claude-opus-4-7",
        invoice_id: input.invoiceId ?? null,
        dispute_summary: input.disputeSummary ?? null,
        generated_at: new Date().toISOString(),
      },
    })
    .select("id")
    .single();

  if (insertError) return { error: insertError.message };

  logAudit({
    user,
    action: "legal_doc.generated",
    entity_type: "legal_document",
    entity_id: inserted.id,
    details: { doc_type: input.docType, job_id: input.jobId },
  });

  revalidatePath(`/jobs/${input.jobId}`);
  return { ok: true, docId: inserted.id };
}

export async function updateLegalDoc(
  prevState: { error?: string; ok?: boolean } | undefined,
  formData: FormData
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const id = formData.get("doc_id") as string;
  const subject = (formData.get("subject") as string) || null;
  const body = (formData.get("body") as string) || "";
  if (!body.trim()) return { error: "Document body cannot be empty." };

  const supabase = await createServerSupabaseClient();
  const { data: existing } = await supabase
    .from("legal_documents")
    .select("status, job_id, doc_type, subject, body")
    .eq("id", id)
    .single();
  if (!existing) return { error: "Document not found." };
  if (existing.status === "sent" || existing.status === "signed") {
    return { error: `Cannot edit a ${existing.status} document.` };
  }

  const { error } = await supabase
    .from("legal_documents")
    .update({ subject, body, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };

  // Recursive feedback: human edited an Esquire draft. Capture the diff so
  // future drafts of the same doc_type learn from it.
  const subjectChanged = (existing.subject ?? "") !== (subject ?? "");
  const bodyChanged = (existing.body ?? "") !== body;
  if (subjectChanged || bodyChanged) {
    after(() =>
      logAgentOutcome({
        agent: "esquire",
        task: `${existing.doc_type}_draft`,
        outcome: "approved_with_edits",
        jobId: existing.job_id,
        entityType: "legal_document",
        entityId: id,
        delta: {
          subject_changed: subjectChanged,
          body_chars_before: (existing.body ?? "").length,
          body_chars_after: body.length,
        },
        userId: user.id,
      })
    );
  }

  revalidatePath(`/jobs/${existing.job_id}/legal/${id}`);
  return { ok: true };
}

export async function approveLegalDoc(docId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const supabase = await createServerSupabaseClient();
  const { data: existing } = await supabase
    .from("legal_documents")
    .select("status, job_id, doc_type")
    .eq("id", docId)
    .single();
  if (!existing) return { error: "Document not found." };
  if (existing.status !== "draft") {
    return { error: `Already ${existing.status}.` };
  }

  const { error } = await supabase
    .from("legal_documents")
    .update({
      status: "approved",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", docId);

  if (error) return { error: error.message };

  logAudit({
    user,
    action: "legal_doc.approved",
    entity_type: "legal_document",
    entity_id: docId,
    details: { doc_type: existing.doc_type },
  });

  // Auto-resolve any pending_approvals on this doc — office acted on it
  after(() => resolveApprovalsForEntity("legal_document", docId, user.id, "approved"));

  // Recursive feedback: an approved doc with no edits is a positive signal.
  after(() =>
    logAgentOutcome({
      agent: "esquire",
      task: `${existing.doc_type}_draft`,
      outcome: "approved_unchanged",
      jobId: existing.job_id,
      entityType: "legal_document",
      entityId: docId,
      userId: user.id,
    })
  );

  // Auto-send to customer (homeowner-facing types only — never carrier docs).
  // The helper handles all guard checks (auto-pause, customer email, opt-out)
  // and flips status to 'sent' on success.
  after(() => autoSendLegalDocToCustomer(docId));

  revalidatePath(`/jobs/${existing.job_id}/legal/${docId}`);
  revalidatePath(`/jobs/${existing.job_id}`);
  return { ok: true };
}

export async function markLegalDocSent(docId: string, sentTo: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };
  if (!sentTo.trim()) return { error: "Recipient is required." };

  const supabase = await createServerSupabaseClient();
  const { data: existing } = await supabase
    .from("legal_documents")
    .select("status, job_id, doc_type")
    .eq("id", docId)
    .single();
  if (!existing) return { error: "Document not found." };
  if (existing.status === "draft") {
    return { error: "Approve the document first." };
  }
  if (existing.status === "sent" || existing.status === "signed") {
    return { error: `Already ${existing.status}.` };
  }

  const { error } = await supabase
    .from("legal_documents")
    .update({
      status: "sent",
      sent_to: sentTo.trim(),
      sent_at: new Date().toISOString(),
    })
    .eq("id", docId);

  if (error) return { error: error.message };

  logAudit({
    user,
    action: "legal_doc.sent",
    entity_type: "legal_document",
    entity_id: docId,
    details: { doc_type: existing.doc_type, sent_to: sentTo.trim() },
  });

  revalidatePath(`/jobs/${existing.job_id}/legal/${docId}`);
  revalidatePath(`/jobs/${existing.job_id}`);
  return { ok: true };
}

export async function markLegalDocSigned(docId: string, signedByName: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };
  if (!signedByName.trim()) return { error: "Signer name is required." };

  const supabase = await createServerSupabaseClient();
  const { data: existing } = await supabase
    .from("legal_documents")
    .select("status, job_id, doc_type")
    .eq("id", docId)
    .single();
  if (!existing) return { error: "Document not found." };

  const { error } = await supabase
    .from("legal_documents")
    .update({
      status: "signed",
      signed_by_name: signedByName.trim(),
      signed_at: new Date().toISOString(),
    })
    .eq("id", docId);

  if (error) return { error: error.message };

  logAudit({
    user,
    action: "legal_doc.signed",
    entity_type: "legal_document",
    entity_id: docId,
    details: { doc_type: existing.doc_type, signed_by_name: signedByName.trim() },
  });

  revalidatePath(`/jobs/${existing.job_id}/legal/${docId}`);
  revalidatePath(`/jobs/${existing.job_id}`);
  return { ok: true };
}

export async function deleteLegalDoc(docId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };
  if (user.role !== "owner" && user.role !== "manager") {
    return { error: "Only owners and managers can delete legal documents." };
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("legal_documents")
    .select("job_id, doc_type, status")
    .eq("id", docId)
    .single();
  if (!existing) return { error: "Document not found." };

  // Hard rule: never delete approved/sent/signed legal docs. They're a
  // permanent record of customer/carrier authorization. If the doc needs
  // to go away, void it (status='void') instead — preserves audit trail.
  if (existing.status !== "draft" && existing.status !== "void") {
    return {
      error: `Cannot delete a ${existing.status} document. Once a legal doc is approved, sent, or signed it becomes a permanent record on the job. If you need to invalidate it, mark it void instead.`,
    };
  }

  const { error } = await admin
    .from("legal_documents")
    .delete()
    .eq("id", docId);

  if (error) return { error: error.message };

  logAudit({
    user,
    action: "legal_doc.deleted",
    entity_type: "legal_document",
    entity_id: docId,
    details: { doc_type: existing.doc_type },
  });

  revalidatePath(`/jobs/${existing.job_id}`);
  return { ok: true };
}
