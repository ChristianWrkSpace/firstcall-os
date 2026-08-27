import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ reconcile: vi.fn() }));

vi.mock("@/lib/account-active-transitions", () => ({
  reconcileAccountActiveTransitions: mocks.reconcile,
}));

import { GET } from "@/app/api/cron/reconcile-account-active-transitions/route";

function request(secret?: string) {
  return new Request("http://localhost/api/cron/reconcile-account-active-transitions", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

describe("account-active reconciliation cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CRON_SECRET;
    mocks.reconcile.mockResolvedValue({
      apply: true,
      listed: 0,
      processed: 0,
      completed: 0,
      pending: 0,
      skipped: 0,
      errors: 0,
      items: [],
    });
  });

  it("fails closed when CRON_SECRET is absent", async () => {
    const response = await GET(request() as never);
    expect(response.status).toBe(503);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it("rejects a mismatched bearer secret", async () => {
    process.env.CRON_SECRET = "correct-secret";
    const response = await GET(request("wrong-secret") as never);
    expect(response.status).toBe(401);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it("runs a bounded apply batch through shared orchestration", async () => {
    process.env.CRON_SECRET = "correct-secret";
    const response = await GET(request("correct-secret") as never);
    expect(response.status).toBe(200);
    expect(mocks.reconcile).toHaveBeenCalledWith({ apply: true, limit: 25 });
    expect(await response.json()).toMatchObject({ ok: true, apply: true });
  });

  it("returns a redacted failure without leaking thrown details", async () => {
    process.env.CRON_SECRET = "correct-secret";
    mocks.reconcile.mockRejectedValue(new Error("private@example.com secret provider detail"));
    const response = await GET(request("correct-secret") as never);
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("private@example.com");
  });
});
