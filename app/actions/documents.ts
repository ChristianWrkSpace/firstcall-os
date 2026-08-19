"use server";

import { createAdminClient, createServerSupabaseClient } from "@/lib/supabase-server";
import { getCurrentUser, requirePermission } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

const BUCKET = "job-documents";

async function requireUser() {
  return getCurrentUser();
}

export async function recordJobDocument(
  jobId: string,
  storagePath: string,
  filename: string,
  mimeType: string,
  sizeBytes: number,
  docType: string,
  notes?: string
) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { error } = await admin.from("job_documents").insert({
    job_id: jobId,
    storage_path: storagePath,
    filename,
    mime_type: mimeType,
    size_bytes: sizeBytes,
    doc_type: docType,
    uploaded_by: user.id,
    notes: notes ?? null,
  });
  if (error) {
    console.error("[recordJobDocument]", error);
    return { error: error.message };
  }

  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

export async function deleteJobDocument(documentId: string, jobId: string) {
  const auth = await requirePermission("documents.delete");
  if ("error" in auth) return { error: auth.error };

  const admin = createAdminClient();

  const { data: doc, error: fetchErr } = await admin
    .from("job_documents")
    .select("*")
    .eq("id", documentId)
    .single();
  if (fetchErr || !doc) return { error: "Document not found." };
  if (doc.signed || doc.signed_at) {
    return { error: "Signed documents are permanent records and cannot be deleted." };
  }

  // Win the database race before touching the binary. The signed-state
  // predicates and DB trigger prevent a file signed concurrently from being
  // removed after our initial read.
  const { data: deleted, error: deleteError } = await admin
    .from("job_documents")
    .delete()
    .eq("id", documentId)
    .eq("signed", false)
    .is("signed_at", null)
    .select("id")
    .maybeSingle();
  if (deleteError) {
    return { error: "Unable to delete the document record. The stored file was kept." };
  }
  if (!deleted) {
    return { error: "The document changed or was signed. Nothing was deleted." };
  }

  const { error: storageError } = await admin.storage
    .from(BUCKET)
    .remove([doc.storage_path]);
  if (storageError) {
    // The binary still exists. Restore its metadata so it remains reachable
    // and a later cleanup can retry safely.
    const { error: restoreError } = await admin.from("job_documents").insert(doc);
    if (restoreError) {
      console.error("[deleteJobDocument.restore]", restoreError);
      return { error: "The file was kept, but its metadata could not be restored. Contact support." };
    }
    return { error: "Unable to remove the stored file. The document record was restored." };
  }

  await logAudit({
    user: auth.user,
    action: "job_document.deleted",
    entity_type: "job_document",
    entity_id: documentId,
    details: {
      job_id: doc.job_id,
      doc_type: doc.doc_type,
    },
  });

  revalidatePath(`/jobs/${doc.job_id || jobId}`);
  return { ok: true };
}

export async function getDocumentSignedUrl(
  storagePath: string,
  expiresInSeconds: number = 60 * 60
) {
  const user = await requireUser();
  if (!user) return null;

  const supabase = await createServerSupabaseClient();
  const { data: document, error: lookupError } = await supabase
    .from("job_documents")
    .select("id")
    .eq("storage_path", storagePath)
    .maybeSingle();
  if (lookupError || !document) return null;

  const boundedExpiry = Math.max(30, Math.min(expiresInSeconds, 60 * 60));
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, boundedExpiry);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function getShareLink(documentId: string) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const supabase = await createServerSupabaseClient();
  const { data: doc, error: fetchErr } = await supabase
    .from("job_documents")
    .select("storage_path")
    .eq("id", documentId)
    .single();
  if (fetchErr || !doc) return { error: "Document not found." };

  // 7-day shareable link
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(doc.storage_path, 60 * 60 * 24 * 7);
  if (error || !data) return { error: error?.message ?? "Failed to generate link." };

  return { ok: true, url: data.signedUrl };
}

export async function markDocumentSigned(
  documentId: string,
  signedByName: string,
  jobId: string
) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };
  if (!signedByName.trim()) return { error: "Signer name required." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("job_documents")
    .update({
      signed: true,
      signed_at: new Date().toISOString(),
      signed_by_name: signedByName.trim(),
    })
    .eq("id", documentId);
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

export async function unmarkDocumentSigned(documentId: string, jobId: string) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("job_documents")
    .update({
      signed: false,
      signed_at: null,
      signed_by_name: null,
    })
    .eq("id", documentId);
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

export async function updateDocumentMeta(
  documentId: string,
  jobId: string,
  updates: { doc_type?: string; notes?: string }
) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("job_documents")
    .update(updates)
    .eq("id", documentId);
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}
