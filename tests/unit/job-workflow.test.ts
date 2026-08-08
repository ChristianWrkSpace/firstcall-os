import { describe, expect, it } from "vitest";
import {
  canTransitionJobStatus,
  normalizeCustomerEmail,
  normalizeCustomerPhone,
  parseManualJobAmount,
} from "@/lib/job-workflow";

describe("job workflow guards", () => {
  it("normalizes customer identity for deduplication", () => {
    expect(normalizeCustomerEmail("  OWNER@Example.COM ")).toBe("owner@example.com");
    expect(normalizeCustomerPhone("(512) 555-0199")).toBe("5125550199");
  });

  it("allows forward workflow and same-state updates", () => {
    expect(canTransitionJobStatus("lead", "inspection")).toBe(true);
    expect(canTransitionJobStatus("inspection", "drying")).toBe(true);
    expect(canTransitionJobStatus("drying", "completed")).toBe(true);
    expect(canTransitionJobStatus("drying", "drying")).toBe(true);
  });

  it("rejects backwards, unknown, and terminal transitions", () => {
    expect(canTransitionJobStatus("drying", "lead")).toBe(false);
    expect(canTransitionJobStatus("completed", "mitigation")).toBe(false);
    expect(canTransitionJobStatus("cancelled", "lead")).toBe(false);
    expect(canTransitionJobStatus("lead", "hacked")).toBe(false);
  });

  it("allows cancellation from an active job", () => {
    expect(canTransitionJobStatus("lead", "cancelled")).toBe(true);
    expect(canTransitionJobStatus("drying", "cancelled")).toBe(true);
  });

  it("parses a manual job billing amount without requiring an AI estimate", () => {
    expect(parseManualJobAmount("1200")).toEqual({ value: 1200 });
    expect(parseManualJobAmount("1,200.50")).toEqual({ value: 1200.5 });
    expect(parseManualJobAmount(" ")).toEqual({ value: null });
  });

  it("rejects invalid manual job billing amounts", () => {
    expect(parseManualJobAmount("-1")).toEqual({
      error: "Enter a billing amount of $0 or more.",
    });
    expect(parseManualJobAmount("12.345")).toEqual({
      error: "Enter no more than two decimal places.",
    });
    expect(parseManualJobAmount("not money")).toEqual({
      error: "Enter a valid billing amount.",
    });
    expect(parseManualJobAmount("100000000")).toEqual({
      error: "Billing amount must be less than $100,000,000.",
    });
  });
});
