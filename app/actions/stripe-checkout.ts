"use server";

import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase-server";
import { headers } from "next/headers";

/**
 * Creates a Stripe Checkout Session for a customer to pay an invoice online.
 * Called from the public customer portal — no auth required (token in URL is auth).
 */
export async function createInvoiceCheckout(
  invoiceId: string,
  customerToken: string
) {
  const admin = createAdminClient();

  // Verify the customer token + load invoice + customer
  const { data: job } = await admin
    .from("jobs")
    .select("id, customer_share_token, customers(name, email)")
    .eq("customer_share_token", customerToken)
    .single();
  if (!job) return { error: "Invalid portal link." };

  const { data: invoice } = await admin
    .from("invoices")
    .select(
      "id, invoice_number, status, sent_at, line_items:invoice_line_items(line_total), payments(amount), job_id"
    )
    .eq("id", invoiceId)
    .single();
  if (!invoice) return { error: "Invoice not found." };

  if (invoice.job_id !== job.id) {
    return { error: "Invoice does not belong to this job." };
  }
  if (invoice.status === "paid" || invoice.status === "void") {
    return { error: `Invoice already ${invoice.status}.` };
  }

  const total = (invoice.line_items ?? []).reduce(
    (s: number, li: any) => s + Number(li.line_total ?? 0),
    0
  );
  const paid = (invoice.payments ?? []).reduce(
    (s: number, p: any) => s + Number(p.amount),
    0
  );
  const balance = total - paid;
  if (balance <= 0) return { error: "Nothing left to pay." };

  const customer = job.customers as any;
  const stripe = getStripe();

  const hdrs = await headers();
  const origin =
    hdrs.get("origin") ??
    `https://${hdrs.get("host") ?? "firstcall-os.vercel.app"}`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: customer?.email ?? undefined,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Invoice ${invoice.invoice_number}`,
            description: `Payment for First Call Mitigation services`,
          },
          unit_amount: Math.round(balance * 100),
        },
        quantity: 1,
      },
    ],
    metadata: {
      invoice_id: invoice.id,
      job_id: job.id,
      invoice_number: invoice.invoice_number,
    },
    success_url: `${origin}/portal/${customerToken}?paid=1`,
    cancel_url: `${origin}/portal/${customerToken}?cancelled=1`,
  });

  return { ok: true, url: session.url };
}
