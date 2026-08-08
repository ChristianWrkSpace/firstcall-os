import crypto from "node:crypto";

export function hashBearerToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
