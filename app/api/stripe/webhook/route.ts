import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase-server";
import type Stripe from "stripe";

// Stripe sends webhooks. We verify signature, then act on payment events.
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing signature or webhook secret." },
      { status: 400 }
    );
  }

  const rawBody = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch {
    console.error("[stripe-webhook] signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const invoiceId = session.metadata?.invoice_id;
    const paymentKind = session.metadata?.payment_kind ?? "full";
    const reference =
      typeof session.payment_intent === "string" ? session.payment_intent : null;
    const amountTotal = session.amount_total;

    if (
      !event.id ||
      !invoiceId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(invoiceId) ||
      !reference ||
      !["full", "deductible"].includes(paymentKind)
    ) {
      console.warn("[stripe-webhook] invalid payment metadata");
      return NextResponse.json({ error: "Invalid payment data" }, { status: 400 });
    }

    if (
      typeof amountTotal !== "number" ||
      !Number.isSafeInteger(amountTotal) ||
      amountTotal <= 0
    ) {
      console.warn("[stripe-webhook] invalid payment amount");
      return NextResponse.json({ error: "Invalid payment data" }, { status: 400 });
    }

    const admin = createAdminClient();
    let result;
    try {
      result = await admin.rpc("process_stripe_payment", {
        p_event_id: event.id,
        p_invoice_id: invoiceId,
        p_amount: amountTotal / 100,
        p_reference: reference,
        p_payment_kind: paymentKind,
      });
    } catch {
      console.error("[stripe-webhook] durable payment processing failed");
      return NextResponse.json(
        { error: "Payment processing failed" },
        { status: 500 }
      );
    }

    const { data, error } = result;

    if (error) {
      console.error("[stripe-webhook] durable payment processing failed");
      return NextResponse.json(
        { error: "Payment processing failed" },
        { status: 500 }
      );
    }

    const outcome = Array.isArray(data) ? data[0] : null;
    if (!outcome) {
      console.error("[stripe-webhook] payment RPC returned no outcome");
      return NextResponse.json(
        { error: "Payment processing failed" },
        { status: 500 }
      );
    }
    if (outcome.payment_id == null) {
      try {
        await stripe.refunds.create(
          { payment_intent: reference },
          { idempotencyKey: `invoice-overpayment-refund:${event.id}` }
        );
      } catch {
        console.error("[stripe-webhook] automatic overpayment refund failed");
        return NextResponse.json(
          { error: "Payment refund failed" },
          { status: 500 }
        );
      }
      return NextResponse.json({ received: true, refunded: true });
    }

    if (outcome?.already_processed === true) {
      return NextResponse.json({ received: true, duplicate: true });
    }
  }

  return NextResponse.json({ received: true });
}
