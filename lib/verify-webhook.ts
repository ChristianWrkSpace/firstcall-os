// Generic HMAC webhook verification helper.
// For Stripe specifically, prefer their SDK's `webhooks.constructEvent` —
// it handles tolerance + signature scheme parsing for you.
// This helper is for vendors that send a plain HMAC-SHA256 in a single header
// (Twilio for some endpoints, Resend, custom partner integrations).

import crypto from "node:crypto";

export interface VerifyOptions {
  rawBody: string | Buffer;
  signature: string | null | undefined;
  secret: string | undefined;
  /** "sha256=..." prefix used by GitHub-style senders. Default: false. */
  hasSchemePrefix?: boolean;
  /** Custom comparison encoding. Default: "hex". */
  encoding?: "hex" | "base64";
}

export function verifyHmacSignature(opts: VerifyOptions): boolean {
  if (!opts.signature || !opts.secret) return false;

  const expected = crypto
    .createHmac("sha256", opts.secret)
    .update(opts.rawBody)
    .digest(opts.encoding ?? "hex");

  const received = opts.hasSchemePrefix
    ? opts.signature.replace(/^sha256=/, "")
    : opts.signature;

  // Length-independent equality, then constant-time compare on equal-length buffers.
  if (expected.length !== received.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(received)
    );
  } catch {
    return false;
  }
}
