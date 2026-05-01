import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifyHmacSignature } from "@/lib/verify-webhook";

function sign(body: string, secret: string, encoding: "hex" | "base64" = "hex") {
  return crypto.createHmac("sha256", secret).update(body).digest(encoding);
}

describe("verifyHmacSignature", () => {
  const secret = "shh";
  const body = JSON.stringify({ event: "thing.happened", id: "evt_1" });

  it("accepts a correctly-signed body", () => {
    const sig = sign(body, secret);
    expect(verifyHmacSignature({ rawBody: body, signature: sig, secret })).toBe(true);
  });

  it("rejects a tampered body", () => {
    const sig = sign(body, secret);
    const tamperedBody = body + "X";
    expect(
      verifyHmacSignature({ rawBody: tamperedBody, signature: sig, secret })
    ).toBe(false);
  });

  it("rejects when secret is wrong", () => {
    const sig = sign(body, secret);
    expect(
      verifyHmacSignature({ rawBody: body, signature: sig, secret: "different" })
    ).toBe(false);
  });

  it("rejects when signature header is missing", () => {
    expect(
      verifyHmacSignature({ rawBody: body, signature: null, secret })
    ).toBe(false);
  });

  it("rejects when secret is missing", () => {
    const sig = sign(body, secret);
    expect(
      verifyHmacSignature({ rawBody: body, signature: sig, secret: undefined })
    ).toBe(false);
  });

  it("supports the sha256= prefix scheme (GitHub-style)", () => {
    const sig = sign(body, secret);
    expect(
      verifyHmacSignature({
        rawBody: body,
        signature: `sha256=${sig}`,
        secret,
        hasSchemePrefix: true,
      })
    ).toBe(true);
  });

  it("supports base64 encoding", () => {
    const sig = sign(body, secret, "base64");
    expect(
      verifyHmacSignature({ rawBody: body, signature: sig, secret, encoding: "base64" })
    ).toBe(true);
  });
});
