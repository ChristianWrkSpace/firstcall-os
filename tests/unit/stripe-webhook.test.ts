import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../..");
const migrationPath = resolve(
  repoRoot,
  "supabase/migrations/032_payment_integrity.sql"
);

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  rpc: vi.fn(),
  refund: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    webhooks: { constructEvent: mocks.constructEvent },
    refunds: { create: mocks.refund },
  }),
}));

vi.mock("@/lib/supabase-server", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));

import { POST } from "@/app/api/stripe/webhook/route";

function checkoutEvent(amountTotal: number | null) {
  return {
    id: "evt_payment_123",
    type: "checkout.session.completed",
    data: {
      object: {
        amount_total: amountTotal,
        payment_intent: "pi_123",
        metadata: { invoice_id: "8ff14aac-0921-4a9d-a7be-c8c73421f395", payment_kind: "full" },
      },
    },
  };
}

function request() {
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    body: "signed-body",
    headers: { "stripe-signature": "valid-signature" },
  });
}

describe("Stripe webhook payment integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  });

  it("does not log Stripe signature error details", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.constructEvent.mockImplementation(() => {
      throw new Error("signature failed for customer@example.com");
    });

    const response = await POST(request() as never);

    expect(response.status).toBe(400);
    expect(log).toHaveBeenCalledWith("[stripe-webhook] signature verification failed");
    expect(JSON.stringify(log.mock.calls)).not.toContain("customer@example.com");
    log.mockRestore();
  });

  it.each([0, -100])("rejects a non-positive Stripe amount_total of %s", async (amountTotal) => {
    mocks.constructEvent.mockReturnValue(checkoutEvent(amountTotal));

    const response = await POST(request() as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid payment data" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects malformed payment metadata", async () => {
    const event = checkoutEvent(12500);
    event.data.object.metadata = { payment_kind: "full" } as typeof event.data.object.metadata;
    mocks.constructEvent.mockReturnValue(event);

    const response = await POST(request() as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid payment data" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns 500 when durable payment processing fails", async () => {
    mocks.constructEvent.mockReturnValue(checkoutEvent(12500));
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "database unavailable" } });

    const response = await POST(request() as never);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Payment processing failed" });
    expect(mocks.rpc).toHaveBeenCalledWith("process_stripe_payment", {
      p_event_id: "evt_payment_123",
      p_invoice_id: "8ff14aac-0921-4a9d-a7be-c8c73421f395",
      p_amount: 125,
      p_reference: "pi_123",
      p_payment_kind: "full",
    });
  });

  it("returns 500 when the payment RPC throws", async () => {
    mocks.constructEvent.mockReturnValue(checkoutEvent(12500));
    mocks.rpc.mockRejectedValue(new Error("connection reset"));

    const response = await POST(request() as never);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Payment processing failed" });
  });

  it("fails closed when the payment RPC returns no outcome", async () => {
    mocks.constructEvent.mockReturnValue(checkoutEvent(12500));
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    const response = await POST(request() as never);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Payment processing failed" });
  });

  it("treats an already-processed Stripe event as a successful duplicate", async () => {
    mocks.constructEvent.mockReturnValue(checkoutEvent(12500));
    mocks.rpc.mockResolvedValue({
      data: [
        {
          processed: false,
          already_processed: true,
          payment_id: "a7f3f94c-bb76-4bc2-b4fe-eef4137dc906",
          invoice_status: "paid",
        },
      ],
      error: null,
    });

    const response = await POST(request() as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true, duplicate: true });
  });

  it("idempotently refunds a completed Checkout payment that no longer fits the balance", async () => {
    mocks.constructEvent.mockReturnValue(checkoutEvent(12500));
    mocks.rpc.mockResolvedValue({
      data: [{ processed: false, already_processed: false, payment_id: null, invoice_status: "paid" }],
      error: null,
    });
    mocks.refund.mockResolvedValue({ id: "re_123" });

    const response = await POST(request() as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true, refunded: true });
    expect(mocks.refund).toHaveBeenCalledWith(
      { payment_intent: "pi_123" },
      { idempotencyKey: "invoice-overpayment-refund:evt_payment_123" }
    );
  });

  it("durably deduplicates Stripe events inside the payment transaction", () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(/payments_amount_positive\s+check\s*\(amount\s*>\s*0\)/i);
    expect(sql).toMatch(/stripe_payment_events[\s\S]*event_id\s+text\s+primary\s+key/i);
    expect(sql).toMatch(/create or replace function public\.process_stripe_payment/i);
    expect(sql).toMatch(/for update/i);
    expect(sql).toMatch(/on conflict \(event_id\) do nothing/i);
    expect(sql).toMatch(/if not found then[\s\S]*return query\s+select\s+false,\s+true/i);
    expect(sql).toMatch(/create or replace function public\.delete_payment_and_reconcile/i);
    expect(sql).toMatch(/delete from public\.payments[\s\S]*update public\.invoices/i);
    expect(sql).toMatch(/create or replace function public\.record_payment_and_reconcile/i);
    expect(sql).toMatch(/payment exceeds outstanding balance/i);
    expect(sql).toMatch(/record_payment_and_reconcile[\s\S]*to service_role/i);
    expect(sql).toMatch(/create or replace function public\.create_invoice_from_estimate/i);
    expect(sql).toMatch(/v_estimate_job_id\s+is distinct from\s+p_job_id/i);
    expect(sql).toMatch(/create_invoice_from_estimate[\s\S]*to service_role/i);
    expect(sql).toMatch(/create trigger prevent_duplicate_active_invoice/i);
    expect(sql).toMatch(/Invoice job must match estimate job/i);
    expect(sql).toMatch(/create trigger require_draft_estimate_for_line_change/i);
    expect(sql).toMatch(/create trigger require_draft_invoice_for_line_change/i);
  });

  it("reuses a Stripe Checkout session for the same invoice balance state", () => {
    const source = readFileSync(resolve(repoRoot, "app/actions/stripe-checkout.ts"), "utf8");
    expect(source).toContain("idempotencyKey: `invoice-checkout:${balanceState}`");
    expect(source).toContain("Math.round(paid * 100)");
    expect(source).toContain("Math.round(chargeAmount * 100)");
  });
});
