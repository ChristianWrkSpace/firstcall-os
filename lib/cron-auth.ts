import { timingSafeEqual } from "node:crypto";

export type CronAuthorization =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

function secretsMatch(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function authorizeCronRequest(
  authorizationHeader: string | null,
  configuredSecret: string | undefined
): CronAuthorization {
  if (!configuredSecret) {
    return { ok: false, status: 503, error: "Cron is not configured." };
  }

  const expected = `Bearer ${configuredSecret}`;
  if (!authorizationHeader || !secretsMatch(authorizationHeader, expected)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  return { ok: true };
}
