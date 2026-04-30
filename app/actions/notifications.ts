"use server";

import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase-server";
import { sendEmail } from "@/lib/resend";
import {
  buildNotificationEmail,
  type NotificationEvent,
} from "@/lib/notifications";
import { revalidatePath } from "next/cache";

async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function sendCustomerNotification(
  jobId: string,
  event: NotificationEvent,
  customMessage?: string,
  recipientOverride?: string
) {
  const user = await requireUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  const { data: job } = await admin
    .from("jobs")
    .select("job_number, site_address, customers(name, email)")
    .eq("id", jobId)
    .single();
  if (!job) return { error: "Job not found." };

  const customer = (job as any).customers;
  const recipient = (recipientOverride?.trim()) || customer?.email;
  if (!recipient) {
    return {
      error:
        "No customer email on file. Add one in the customer record, or enter an override below.",
    };
  }

  const { subject, html } = buildNotificationEmail(
    event,
    {
      customer_name: customer?.name ?? "there",
      job_number: job.job_number,
      site_address: job.site_address,
    },
    customMessage
  );

  try {
    await sendEmail({ to: recipient, subject, html });
  } catch (err: any) {
    return { error: `Email failed: ${err.message}` };
  }

  await admin.from("customer_notifications").insert({
    job_id: jobId,
    event_type: event,
    channel: "email",
    sent_to: recipient,
    subject,
    body: html,
    sent_by: user.id,
    custom_message: event === "custom" ? customMessage ?? null : null,
  });

  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}
