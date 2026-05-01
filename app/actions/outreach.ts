"use server";

import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase-server";
import {
  generateColdEmail,
  generateVoicemailScript,
  generateFollowUpEmail,
  type BusinessType,
} from "@/lib/hunter";
import { logAgentOutcome } from "@/lib/agent-feedback";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function createLead(_prev: any, formData: FormData) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("outreach_leads")
    .insert({
      company_name: (formData.get("company_name") as string)?.trim(),
      contact_name: (formData.get("contact_name") as string)?.trim() || null,
      contact_title: (formData.get("contact_title") as string)?.trim() || null,
      contact_email: (formData.get("contact_email") as string)?.trim() || null,
      contact_phone: (formData.get("contact_phone") as string)?.trim() || null,
      business_type: formData.get("business_type") as string,
      city: (formData.get("city") as string)?.trim() || "Austin",
      website: (formData.get("website") as string)?.trim() || null,
      source: (formData.get("source") as string)?.trim() || null,
      notes: (formData.get("notes") as string)?.trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  redirect(`/partners/outreach/${data.id}`);
}

export async function setLeadStatus(leadId: string, status: string) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("outreach_leads")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", leadId);
  if (error) return { error: error.message };
  revalidatePath(`/partners/outreach`);
  revalidatePath(`/partners/outreach/${leadId}`);
  return { ok: true };
}

export async function generateMessage(
  leadId: string,
  channel: "email" | "voicemail" | "follow_up"
) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { data: lead } = await admin
    .from("outreach_leads")
    .select("*")
    .eq("id", leadId)
    .single();
  if (!lead) return { error: "Lead not found." };

  let subject: string | null = null;
  let body: string;

  try {
    if (channel === "email") {
      const result = await generateColdEmail({
        company_name: lead.company_name,
        contact_name: lead.contact_name,
        contact_title: lead.contact_title,
        business_type: lead.business_type as BusinessType,
        city: lead.city,
        notes: lead.notes,
      });
      subject = result.subject;
      body = result.body;
    } else if (channel === "voicemail") {
      body = await generateVoicemailScript({
        company_name: lead.company_name,
        contact_name: lead.contact_name,
        contact_title: lead.contact_title,
        business_type: lead.business_type as BusinessType,
        city: lead.city,
        notes: lead.notes,
      });
    } else {
      // follow_up — find latest sent message to reference
      const { data: prev } = await admin
        .from("outreach_messages")
        .select("draft_content")
        .eq("lead_id", leadId)
        .eq("status", "sent")
        .order("sent_at", { ascending: false })
        .limit(1)
        .single();
      const prevContent = prev?.draft_content ?? "(no prior message)";
      const result = await generateFollowUpEmail(
        {
          company_name: lead.company_name,
          contact_name: lead.contact_name,
          business_type: lead.business_type as BusinessType,
        },
        prevContent
      );
      subject = result.subject;
      body = result.body;
    }
  } catch (err: any) {
    return { error: err.message ?? "AI draft failed." };
  }

  const { error: insertErr } = await admin.from("outreach_messages").insert({
    lead_id: leadId,
    channel: channel === "follow_up" ? "email" : channel,
    subject,
    draft_content: body,
    generated_by: user.id,
  });
  if (insertErr) return { error: insertErr.message };

  // Bump status to drafted if currently "new" or "researching"
  if (lead.status === "new" || lead.status === "researching") {
    await admin.from("outreach_leads").update({ status: "drafted" }).eq("id", leadId);
  }

  revalidatePath(`/partners/outreach/${leadId}`);
  return { ok: true };
}

export async function updateMessageDraft(
  messageId: string,
  leadId: string,
  newContent: string,
  newSubject?: string
) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("outreach_messages")
    .select("draft_content, subject, channel")
    .eq("id", messageId)
    .maybeSingle();

  const { error } = await admin
    .from("outreach_messages")
    .update({
      draft_content: newContent,
      ...(newSubject !== undefined ? { subject: newSubject } : {}),
    })
    .eq("id", messageId);
  if (error) return { error: error.message };

  // Recursive feedback: human edited a Hunter draft. Capture the diff so
  // future drafts of the same channel learn from it.
  if (existing) {
    const subjectChanged =
      newSubject !== undefined && (existing.subject ?? "") !== newSubject;
    const bodyChanged = (existing.draft_content ?? "") !== newContent;
    if (subjectChanged || bodyChanged) {
      const task =
        existing.channel === "voicemail" ? "voicemail_script" : "cold_email";
      after(() =>
        logAgentOutcome({
          agent: "hunter",
          task,
          outcome: "approved_with_edits",
          entityType: "outreach_message",
          entityId: messageId,
          delta: {
            subject_changed: subjectChanged,
            body_chars_before: (existing.draft_content ?? "").length,
            body_chars_after: newContent.length,
          },
          userId: user.id,
        })
      );
    }
  }

  revalidatePath(`/partners/outreach/${leadId}`);
  return { ok: true };
}

export async function markMessageSent(messageId: string, leadId: string) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("outreach_messages")
    .select("channel")
    .eq("id", messageId)
    .maybeSingle();

  await admin
    .from("outreach_messages")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", messageId);

  // Send-as-is is a positive signal — Hunter's draft was good enough to ship.
  if (existing) {
    const task =
      existing.channel === "voicemail" ? "voicemail_script" : "cold_email";
    after(() =>
      logAgentOutcome({
        agent: "hunter",
        task,
        outcome: "approved_unchanged",
        entityType: "outreach_message",
        entityId: messageId,
        userId: user.id,
      })
    );
  }

  // Bump lead status if still drafted
  const { data: lead } = await admin
    .from("outreach_leads")
    .select("status")
    .eq("id", leadId)
    .single();
  if (lead?.status === "drafted" || lead?.status === "new") {
    await admin.from("outreach_leads").update({ status: "sent" }).eq("id", leadId);
  }

  revalidatePath(`/partners/outreach/${leadId}`);
  return { ok: true };
}

export async function recordReply(
  messageId: string,
  leadId: string,
  replyNotes: string
) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  await admin
    .from("outreach_messages")
    .update({ reply_received: true, reply_notes: replyNotes })
    .eq("id", messageId);
  await admin.from("outreach_leads").update({ status: "replied" }).eq("id", leadId);

  revalidatePath(`/partners/outreach/${leadId}`);
  return { ok: true };
}

export async function convertLeadToPartner(leadId: string) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { data: lead } = await admin
    .from("outreach_leads")
    .select("*")
    .eq("id", leadId)
    .single();
  if (!lead) return { error: "Lead not found." };

  const { data: partner, error } = await admin
    .from("partners")
    .insert({
      name: lead.contact_name ?? lead.company_name,
      company: lead.company_name,
      phone: lead.contact_phone,
      email: lead.contact_email,
      notes: lead.notes,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await admin
    .from("outreach_leads")
    .update({ status: "converted", converted_to_partner_id: partner.id })
    .eq("id", leadId);

  revalidatePath(`/partners/outreach`);
  revalidatePath(`/partners/outreach/${leadId}`);
  return { ok: true };
}

export async function deleteLead(leadId: string) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  await admin.from("outreach_leads").delete().eq("id", leadId);

  revalidatePath(`/partners/outreach`);
  redirect(`/partners/outreach`);
}
