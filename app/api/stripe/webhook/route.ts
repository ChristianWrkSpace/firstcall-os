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
  } catch (err: any) {
    console.error("[stripe-webhook] signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const invoiceId = session.metadata?.invoice_id;

    if (!invoiceId) {
      console.warn("[stripe-webhook] no invoice_id in metadata");
      return NextResponse.json({ received: true });
    }

    const amount = (session.amount_total ?? 0) / 100;
    const reference = session.payment_intent as string;
    const admin = createAdminClient();

    // Insert payment record (paid via Stripe)
    await admin.from("payments").insert({
      invoice_id: invoiceId,
      amount,
      method: "credit_card",
      reference: `stripe:${reference}`,
      received_at: new Date().toISOString().split("T")[0],
      notes: "Paid online via Stripe Checkout",
    });

    // Recompute invoice status
    const [{ data: payments }, { data: lines }] = await Promise.all([
      admin.from("payments").select("amount").eq("invoice_id", invoiceId),
      admin
        .from("invoice_line_items")
        .select("line_total")
        .eq("invoice_id", invoiceId),
    ]);
    const totalPaid = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
    const totalDue = (lines ?? []).reduce(
      (s, l) => s + Number(l.line_total ?? 0),
      0
    );

    let newStatus: string;
    if (totalPaid >= totalDue) newStatus = "paid";
    else if (totalPaid > 0) newStatus = "partial";
    else newStatus = "sent";

    await admin
      .from("invoices")
      .update({
        status: newStatus,
        paid_at: newStatus === "paid" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceId);

    // Audit log it (best-effort)
    try {
      await admin.from("audit_logs").insert({
        action: "payment.recorded_via_stripe",
        entity_type: "invoice",
        entity_id: invoiceId,
        details: {
          amount,
          reference: `stripe:${reference}`,
          new_status: newStatus,
        },
      });
    } catch {}
  }

  return NextResponse.json({ received: true });
}
