import { describe, it, expect } from "vitest";
import {
  LEGAL_DOC_TYPES,
  LEGAL_DOC_BY_VALUE,
  LEGAL_STATUS_BADGE,
} from "@/lib/esquire-types";

describe("LEGAL_DOC_TYPES", () => {
  it("includes Work Authorization (the gap we caught at runtime)", () => {
    const wa = LEGAL_DOC_TYPES.find((d) => d.value === "work_authorization");
    expect(wa).toBeDefined();
    expect(wa!.label).toMatch(/work authorization/i);
    expect(wa!.needsSignature).toBe(true);
  });

  it("LEGAL_DOC_BY_VALUE has every value covered", () => {
    for (const t of LEGAL_DOC_TYPES) {
      expect(LEGAL_DOC_BY_VALUE[t.value]).toBe(t);
    }
  });

  it("status badge map covers all 5 statuses", () => {
    for (const s of ["draft", "approved", "sent", "signed", "void"] as const) {
      expect(LEGAL_STATUS_BADGE[s]).toBeTruthy();
    }
  });

  it("demand_letter and notice_of_appraisal both need a recipient", () => {
    const demand = LEGAL_DOC_BY_VALUE.demand_letter;
    const appraisal = LEGAL_DOC_BY_VALUE.notice_of_appraisal;
    expect(demand.needsRecipient).toBe(true);
    expect(appraisal.needsRecipient).toBe(true);
    expect(demand.needsSignature).toBe(false);
  });

  it("all signature-required docs are homeowner-facing (no recipient)", () => {
    for (const d of LEGAL_DOC_TYPES) {
      if (d.needsSignature) {
        expect(d.needsRecipient).toBe(false);
      }
    }
  });
});
