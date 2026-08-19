// Server-only helper that fires customer-facing event emails on job state
// transitions. Called fire-and-forget from updateJobStatus etc. — never blocks
// the user response if the email send fails.
//
// Dedupe rule: never send the same event_type twice for the same job. The
// customer_notifications table is the source of truth (every send writes a row).
// This means re-flipping a job back-and-forth between statuses won't spam.

import { createAdminClient } from "./supabase-server";
import { sendEmail } from "./resend";
import {
  buildNotificationEmail,
  type NotificationEvent,
} from "./notifications";

/**
 * Map a job status to the email event we send when entering that status.
 * Statuses without a mapping (lead/inspection/reconstruction/cancelled) don't
 * trigger anything — those are handled by manual or non-customer-facing flows.
 */
const STATUS_TO_EVENT: Partial<Record<string, NotificationEvent>> = {
  mitigation: "mitigation_started",
  drying: "drying_started",
  completed: "work_completed",
};

export async function autoNotifyOnStatusChange(
  jobId: string,
  newStatus: string
) {
  const event = STATUS_TO_EVENT[newStatus];
  if (!event) return; // status doesn't trigger an auto-email

  try {
    const admin = createAdminClient();

    // Pull job + customer context, including the per-customer toggle
    const { data: job } = await admin
      .from("jobs")
      .select(
        "id, job_number, site_address, auto_actions_paused, is_test, customers(name, email, auto_notify_emails)"
      )
      .eq("id", jobId)
      .single();

    if (!job) return;
    if (job.is_test || job.auto_actions_paused) return;
    const customer = (job as any).customers;
    if (!customer?.email) return; // no email, can't send
    if (customer.auto_notify_emails === false) return; // opted out

    // Dedupe: have we already sent this event for this job?
    const { data: existing } = await admin
      .from("customer_notifications")
      .select("id")
      .eq("job_id", jobId)
      .eq("event_type", event)
      .limit(1);
    if (existing && existing.length > 0) return;

    const { subject, html } = buildNotificationEmail(event, {
      customer_name: customer.name ?? "there",
      job_number: job.job_number,
      site_address: job.site_address ?? null,
    });

    const dedupeKey = `lifecycle:${jobId}:${event}:email`;
    const { data: claim, error: claimError } = await admin
      .from("customer_notifications")
      .insert({
        job_id: jobId,
        event_type: event,
        channel: "email",
        sent_to: customer.email,
        subject,
        body: html,
        sent_by: null,
        sent_at: null,
        dedupe_key: dedupeKey,
      })
      .select("id")
      .single();
    if (claimError?.code === "23505") return;
    if (claimError || !claim) {
      console.error("[auto-notify.claim]", claimError?.message ?? "Unable to reserve notification");
      return;
    }

    // Claim first, then send. If the process dies after delivery, the unique
    // claim prevents a retry from emailing the customer twice.
    try {
      await sendEmail({
        to: customer.email,
        subject,
        html,
        idempotencyKey: dedupeKey,
      });
    } catch (sendError) {
      // Resend uses the same idempotency key on retry, so releasing a failed
      // local claim cannot create a second provider delivery.
      await admin.from("customer_notifications").delete().eq("id", claim.id);
      throw sendError;
    }

    const { error: sentError } = await admin
      .from("customer_notifications")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", claim.id);
    if (sentError) console.error("[auto-notify.sent-at]", sentError.message);
  } catch (err: any) {
    // Auto-notify must never break the user flow that triggered it.
    console.error("[auto-notify]", err?.message ?? err);
  }
}
