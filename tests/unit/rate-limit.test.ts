import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";

// We give each test its own unique key to avoid Map cross-pollution since
// the limiter is module-singleton and persists across tests in the same file.

let counter = 0;
function uniqueKey(label: string) {
  return `test:${label}:${++counter}:${Date.now()}`;
}

describe("checkRateLimit", () => {
  it("allows up to max within window", () => {
    const key = uniqueKey("under-cap");
    const opts = { key, max: 3, windowMs: 1000 };
    expect(checkRateLimit(opts).ok).toBe(true);
    expect(checkRateLimit(opts).ok).toBe(true);
    const last = checkRateLimit(opts);
    expect(last.ok).toBe(true);
    expect(last.remaining).toBe(0);
  });

  it("blocks the (max+1)th hit", () => {
    const key = uniqueKey("over-cap");
    const opts = { key, max: 2, windowMs: 5000 };
    checkRateLimit(opts);
    checkRateLimit(opts);
    const blocked = checkRateLimit(opts);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetAt).toBeGreaterThan(Date.now());
  });

  it("isolates per key", () => {
    const a = uniqueKey("a");
    const b = uniqueKey("b");
    expect(checkRateLimit({ key: a, max: 1, windowMs: 5000 }).ok).toBe(true);
    expect(checkRateLimit({ key: a, max: 1, windowMs: 5000 }).ok).toBe(false);
    // b should be unaffected
    expect(checkRateLimit({ key: b, max: 1, windowMs: 5000 }).ok).toBe(true);
  });

  it("recovers after the window passes", async () => {
    const key = uniqueKey("recover");
    const opts = { key, max: 1, windowMs: 50 };
    expect(checkRateLimit(opts).ok).toBe(true);
    expect(checkRateLimit(opts).ok).toBe(false);
    await new Promise((r) => setTimeout(r, 60));
    expect(checkRateLimit(opts).ok).toBe(true);
  });
});
