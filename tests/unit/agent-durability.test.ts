import { describe, it, expect } from "vitest";
import {
  requireInputs,
  isFresh,
  PreconditionError,
} from "@/lib/agent-preconditions";
import { kindToAgentTask } from "@/lib/agent-feedback";

/**
 * Five-Laws stress harness — 100+ scenarios across the new durability layer.
 *
 * What this DOES validate:
 *   - Law 1 preconditions fire correctly across job-type x dispatch-input matrix
 *   - kindToAgentTask covers every approval kind defined in migration 020
 *   - isFresh boundary behavior (cache window correctness)
 *   - hasValue handles every JS edge case (null, undefined, "", [], {}, false, 0)
 *
 * What this does NOT validate:
 *   - Live LLM behavior (would cost real $, requires prod auth)
 *   - End-to-end DB writes (covered by manual smoke tests against prod)
 *   - Real spend-cap kill-switch (validated by reading lib/ai.ts changes; the
 *     query-against-agent_invocations branch needs an integration test)
 *
 * The synthetic ceiling: this proves the WIRING is correct. It does not prove
 * agent quality — only the guards around them.
 */

type JobType = "water" | "fire" | "mold" | "storm" | "sewage";

interface SyntheticJob {
  id: string;
  type: JobType;
  dispatch_inputs: {
    ceiling_height_ft?: number;
    water_source_secured?: boolean;
    property_type?: string;
    year_built?: number;
  } | null;
  scope_assessment?: object | null;
  scope_analyzed_at?: string | null;
  photo_count: number;
}

// Deterministic generator — same seed produces same scenarios on every run.
function generateScenarios(count: number): SyntheticJob[] {
  const types: JobType[] = ["water", "fire", "mold", "storm", "sewage"];
  const out: SyntheticJob[] = [];
  for (let i = 0; i < count; i++) {
    const type = types[i % types.length];
    const hasDispatch = i % 3 !== 0; // ~67% have dispatch_inputs
    const hasCeiling = hasDispatch && i % 5 !== 0; // ~80% of those have ceiling
    const hasWaterSecured = hasDispatch && i % 7 !== 0; // ~86% have it
    const ageHours = [0.1, 1, 12, 23.9, 24, 24.1, 72, 168, 720][i % 9];
    const photoCount = [0, 1, 3, 8, 16, 24, 50, 100][i % 8];

    out.push({
      id: `job-${i.toString().padStart(3, "0")}`,
      type,
      dispatch_inputs: hasDispatch
        ? {
            ...(hasCeiling ? { ceiling_height_ft: 8 + (i % 5) } : {}),
            ...(hasWaterSecured ? { water_source_secured: i % 2 === 0 } : {}),
            property_type: i % 2 === 0 ? "residential" : "commercial",
            year_built: 1950 + (i % 75),
          }
        : null,
      scope_assessment: i % 4 === 0 ? { water_category: "1" } : null,
      scope_analyzed_at:
        i % 4 === 0
          ? new Date(Date.now() - ageHours * 3_600_000).toISOString()
          : null,
      photo_count: photoCount,
    });
  }
  return out;
}

// Re-implements the precondition logic from app/actions/scope.ts so the test
// can exercise it without dragging in the full server action (no Supabase, no
// next/cache, no auth).
function checkArgusPreconditions(job: SyntheticJob): {
  ok: boolean;
  refused?: { missing: string[]; reason: string };
} {
  const required = ["dispatch_inputs.ceiling_height_ft"];
  if (job.type === "water") {
    required.push("dispatch_inputs.water_source_secured");
  }
  try {
    requireInputs(
      "argus.scope_assessment",
      job as unknown as Record<string, any>,
      required,
      "Fill the Dispatch Inputs panel."
    );
    return { ok: true };
  } catch (err) {
    if (err instanceof PreconditionError) {
      return {
        ok: false,
        refused: { missing: err.missing, reason: err.message },
      };
    }
    throw err;
  }
}

describe("Five-Laws stress harness — 100 jobs", () => {
  const scenarios = generateScenarios(100);

  it("generates exactly 100 deterministic scenarios", () => {
    expect(scenarios.length).toBe(100);
    expect(scenarios[0].id).toBe("job-000");
    expect(scenarios[99].id).toBe("job-099");
  });

  it("Argus refuses the right percentage of jobs (Law 1 — Bounded Inputs)", () => {
    const results = scenarios.map((j) => ({
      type: j.type,
      ...checkArgusPreconditions(j),
    }));
    const refused = results.filter((r) => !r.ok);
    const allowed = results.filter((r) => r.ok);

    // Every refusal must name at least one missing field
    for (const r of refused) {
      expect(r.refused?.missing.length).toBeGreaterThan(0);
    }

    // Every allowed water job MUST have both required fields
    const allowedWater = scenarios
      .map((j) => ({ job: j, res: checkArgusPreconditions(j) }))
      .filter((x) => x.res.ok && x.job.type === "water");
    for (const { job } of allowedWater) {
      expect(job.dispatch_inputs?.ceiling_height_ft).toBeDefined();
      expect(job.dispatch_inputs?.water_source_secured).toBeDefined();
    }

    // Every allowed non-water job MUST have ceiling_height_ft
    const allowedNonWater = scenarios
      .map((j) => ({ job: j, res: checkArgusPreconditions(j) }))
      .filter((x) => x.res.ok && x.job.type !== "water");
    for (const { job } of allowedNonWater) {
      expect(job.dispatch_inputs?.ceiling_height_ft).toBeDefined();
    }

    // Refusal rate sanity check — should be meaningful but not 100%
    expect(refused.length).toBeGreaterThan(20);
    expect(refused.length).toBeLessThan(80);
    expect(allowed.length + refused.length).toBe(100);
  });

  it("water jobs have stricter requirements than non-water (Law 1)", () => {
    const water = scenarios.filter((j) => j.type === "water");
    const nonWater = scenarios.filter((j) => j.type !== "water");

    const waterRefusalRate =
      water.filter((j) => !checkArgusPreconditions(j).ok).length / water.length;
    const nonWaterRefusalRate =
      nonWater.filter((j) => !checkArgusPreconditions(j).ok).length /
      nonWater.length;

    // Water requires 2 fields, non-water requires 1 — water refusal rate must be >=
    expect(waterRefusalRate).toBeGreaterThanOrEqual(nonWaterRefusalRate);
  });

  it("freshness guard — only fresh-scoped jobs would be skip-worthy", () => {
    const freshCount = scenarios.filter((j) =>
      isFresh(j.scope_analyzed_at, 24)
    ).length;
    const staleCount = scenarios.filter(
      (j) => j.scope_analyzed_at && !isFresh(j.scope_analyzed_at, 24)
    ).length;
    const neverScoped = scenarios.filter((j) => !j.scope_analyzed_at).length;

    expect(freshCount + staleCount + neverScoped).toBe(100);
    expect(freshCount).toBeGreaterThan(0);
    expect(staleCount).toBeGreaterThan(0);
    expect(neverScoped).toBeGreaterThan(0);
  });
});

describe("requireInputs — edge case matrix", () => {
  it("missing top-level field throws PreconditionError", () => {
    expect(() => requireInputs("test", {}, ["foo"])).toThrow(PreconditionError);
  });

  it("present top-level field passes", () => {
    expect(() =>
      requireInputs("test", { foo: "bar" }, ["foo"])
    ).not.toThrow();
  });

  it("nested dot-path missing throws with full path in error", () => {
    try {
      requireInputs("test", { a: {} }, ["a.b.c"]);
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(PreconditionError);
      expect((err as PreconditionError).missing).toContain("a.b.c");
    }
  });

  it("nested dot-path present passes", () => {
    expect(() =>
      requireInputs("test", { a: { b: { c: 1 } } }, ["a.b.c"])
    ).not.toThrow();
  });

  it("empty string is treated as missing", () => {
    expect(() => requireInputs("test", { foo: "" }, ["foo"])).toThrow(
      PreconditionError
    );
  });

  it("whitespace-only string is treated as missing", () => {
    expect(() => requireInputs("test", { foo: "   " }, ["foo"])).toThrow(
      PreconditionError
    );
  });

  it("empty array is treated as missing", () => {
    expect(() => requireInputs("test", { foo: [] }, ["foo"])).toThrow(
      PreconditionError
    );
  });

  it("empty object is treated as missing", () => {
    expect(() => requireInputs("test", { foo: {} }, ["foo"])).toThrow(
      PreconditionError
    );
  });

  it("zero is a present value (NOT missing)", () => {
    expect(() => requireInputs("test", { foo: 0 }, ["foo"])).not.toThrow();
  });

  it("false is a present value (critical for water_source_secured)", () => {
    expect(() =>
      requireInputs("test", { foo: false }, ["foo"])
    ).not.toThrow();
  });

  it("null inputs object refuses everything", () => {
    expect(() => requireInputs("test", null, ["foo"])).toThrow(
      PreconditionError
    );
  });

  it("undefined inputs object refuses everything", () => {
    expect(() => requireInputs("test", undefined, ["foo"])).toThrow(
      PreconditionError
    );
  });

  it("multiple missing keys are all reported", () => {
    try {
      requireInputs("test", {}, ["a", "b", "c"]);
      throw new Error("should have thrown");
    } catch (err) {
      expect((err as PreconditionError).missing).toEqual(["a", "b", "c"]);
    }
  });

  it("PreconditionError.agent matches what was passed", () => {
    try {
      requireInputs("argus.scope_assessment", {}, ["foo"]);
    } catch (err) {
      expect((err as PreconditionError).agent).toBe("argus.scope_assessment");
    }
  });

  it("hint appears in error message when provided", () => {
    try {
      requireInputs("test", {}, ["foo"], "Fill the form.");
    } catch (err) {
      expect((err as Error).message).toContain("Fill the form.");
    }
  });
});

describe("isFresh — boundary correctness", () => {
  it("null is never fresh", () => {
    expect(isFresh(null, 24)).toBe(false);
  });

  it("undefined is never fresh", () => {
    expect(isFresh(undefined, 24)).toBe(false);
  });

  it("just-now is fresh", () => {
    expect(isFresh(new Date(), 24)).toBe(true);
  });

  it("ISO string from 1h ago within 24h is fresh", () => {
    const iso = new Date(Date.now() - 3_600_000).toISOString();
    expect(isFresh(iso, 24)).toBe(true);
  });

  it("ISO string from 25h ago is NOT fresh within 24h", () => {
    const iso = new Date(Date.now() - 25 * 3_600_000).toISOString();
    expect(isFresh(iso, 24)).toBe(false);
  });

  it("invalid date string is not fresh", () => {
    expect(isFresh("not-a-date", 24)).toBe(false);
  });

  it("Date object respects window", () => {
    const d = new Date(Date.now() - 12 * 3_600_000);
    expect(isFresh(d, 24)).toBe(true);
    expect(isFresh(d, 6)).toBe(false);
  });
});

describe("kindToAgentTask — full coverage of migration 020", () => {
  // Every kind from supabase/migrations/020_auto_actions_foundation.sql must map
  const allKinds = [
    "estimate_draft",
    "legal_doc_draft",
    "invoice_draft",
    "drying_cert_draft",
    "demand_letter_draft",
    "status_suggestion",
    "referral_attribution",
  ];

  for (const kind of allKinds) {
    it(`maps "${kind}" to a known agent`, () => {
      const result = kindToAgentTask(kind);
      expect(result).not.toBeNull();
      expect(result?.agent).toBeTruthy();
      expect(result?.task).toBeTruthy();
    });
  }

  it("unknown kind returns null", () => {
    expect(kindToAgentTask("not_a_real_kind")).toBeNull();
  });

  it("estimate_draft → ledger", () => {
    expect(kindToAgentTask("estimate_draft")?.agent).toBe("ledger");
  });

  it("legal_doc_draft → esquire", () => {
    expect(kindToAgentTask("legal_doc_draft")?.agent).toBe("esquire");
  });

  it("invoice_draft → abacus", () => {
    expect(kindToAgentTask("invoice_draft")?.agent).toBe("abacus");
  });

  it("status_suggestion → echo", () => {
    expect(kindToAgentTask("status_suggestion")?.agent).toBe("echo");
  });
});
