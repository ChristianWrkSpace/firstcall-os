import { describe, expect, it } from "vitest";
import { authorizeCronRequest } from "@/lib/cron-auth";

describe("authorizeCronRequest", () => {
  it("fails closed when the configured secret is missing", () => {
    expect(authorizeCronRequest(null, undefined)).toEqual({
      ok: false,
      status: 503,
      error: "Cron is not configured.",
    });
  });

  it("rejects a missing authorization header", () => {
    expect(authorizeCronRequest(null, "expected-secret")).toEqual({
      ok: false,
      status: 401,
      error: "Unauthorized",
    });
  });

  it("rejects an invalid bearer token", () => {
    expect(authorizeCronRequest("Bearer wrong-secret", "expected-secret")).toEqual({
      ok: false,
      status: 401,
      error: "Unauthorized",
    });
  });

  it("accepts the exact configured bearer token", () => {
    expect(authorizeCronRequest("Bearer expected-secret", "expected-secret")).toEqual({ ok: true });
  });
});
