import { describe, expect, it } from "vitest";
import {
  canTransitionJobStatus,
  normalizeCustomerEmail,
  normalizeCustomerPhone,
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
});
