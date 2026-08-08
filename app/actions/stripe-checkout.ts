"use server";

import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase-server";
import { hashBearerToken } from "@/lib/token-hash";

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
    .select(
      "id, payment_route, deductible_amount, customers(name, email)"
    )
    .eq("customer_share_token_hash", hashBearerToken(customerToken))
    .gt("customer_share_expires_at", new Date().toISOString())
    .single();
  if (!job) return { error: "Invalid portal link." };

  const paymentRoute = (job as any).payment_route ?? "customer_pay";
  if (paymentRoute === "insurance_primary") {
    return {
      error:
        "This claim is being billed directly to your insurance — no out-of-pocket payment is owed.",
    };
  }

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

  // For deductible routes, cap the amount the customer can pay at their
  // remaining deductible (not the full invoice balance — insurance covers the rest).
  let chargeAmount = balance;
  if (paymentRoute === "insurance_with_deductible") {
    const deductible =
      (job as any).deductible_amount != null
        ? Number((job as any).deductible_amount)
        : null;
    if (deductible == null || deductible <= 0) {
      return { error: "Deductible has not been set on this job." };
    }
    chargeAmount = Math.max(0, Math.min(balance, deductible - paid));
    if (chargeAmount <= 0) {
      return {
        error:
          "Your deductible has already been paid. Insurance is settling the remainder.",
      };
    }
  }

  const customer = job.customers as any;
  const stripe = getStripe();

  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!origin || !/^https?:\/\//.test(origin)) {
    return { error: "Online payments are temporarily unavailable." };
  }

  const isDeductible = paymentRoute === "insurance_with_deductible";
  const productName = isDeductible
    ? `Invoice ${invoice.invoice_number} — Deductible`
    : `Invoice ${invoice.invoice_number}`;
  const productDesc = isDeductible
    ? "Customer deductible payment for First Call Mitigation services"
    : "Payment for First Call Mitigation services";

  const balanceState = `${invoice.id}:${Math.round(paid * 100)}:${Math.round(chargeAmount * 100)}`;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: customer?.email ?? undefined,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: productName,
            description: productDesc,
          },
          unit_amount: Math.round(chargeAmount * 100),
        },
        quantity: 1,
      },
    ],
    metadata: {
      invoice_id: invoice.id,
      job_id: job.id,
      invoice_number: invoice.invoice_number,
      payment_route: paymentRoute,
      payment_kind: isDeductible ? "deductible" : "full",
    },
    success_url: `${origin}/portal/${customerToken}?paid=1`,
    cancel_url: `${origin}/portal/${customerToken}?cancelled=1`,
  }, {
    // The same invoice balance state always reuses one Checkout Session, so
    // retries or parallel tabs cannot create independently chargeable sessions.
    idempotencyKey: `invoice-checkout:${balanceState}`,
  });

  return { ok: true, url: session.url };
}
