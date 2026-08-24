import { describe, expect, it, vi } from "vitest";
import {
  loadArtifactForJob,
  requireArtifactForJob,
  requireFinancialQueryData,
  sumFiniteFinancialAmounts,
  summarizePrintLineItems,
} from "@/lib/financial-document-integrity";

const invoiceCategoryOrder = [
  "Services",
  "Water Extraction",
  "Equipment Setup",
  "Daily Drying",
  "Demolition",
  "Cleaning & Antimicrobial",
  "Containment",
  "Other",
];

class FakeArtifactQuery<T> {
  readonly filters: Array<[string, string]> = [];

  constructor(
    private readonly result: {
      data: T | null;
      error: { message: string } | null;
    }
  ) {}

  eq(column: string, value: string) {
    this.filters.push([column, value]);
    return this;
  }

  async maybeSingle() {
    return this.result;
  }
}

describe("financial document integrity", () => {
  it("executes artifact and URL-job filters before fetching one row", async () => {
    const artifact = { id: "invoice-1", job_id: "job-1" };
    const query = new FakeArtifactQuery({ data: artifact, error: null });

    const result = await loadArtifactForJob(query, "invoice-1", "job-1");

    expect(query.filters).toEqual([
      ["id", "invoice-1"],
      ["job_id", "job-1"],
    ]);
    expect(result).toEqual({ data: artifact, error: null });
  });

  it("rejects missing or cross-job artifacts through the not-found callback", () => {
    const notFound = vi.fn(() => {
      throw new Error("NOT_FOUND");
    });
    const artifact = { id: "invoice-1", job_id: "job-1" };

    expect(requireArtifactForJob(artifact, "job-1", notFound)).toBe(artifact);
    expect(notFound).not.toHaveBeenCalled();

    expect(() => requireArtifactForJob(null, "job-1", notFound)).toThrow("NOT_FOUND");
    expect(() => requireArtifactForJob(artifact, "job-2", notFound)).toThrow("NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(2);
  });

  it("rejects failed or missing related financial query data", () => {
    expect(() =>
      requireFinancialQueryData(
        { data: null, error: { message: "database unavailable" } },
        "invoice line items"
      )
    ).toThrow("Unable to load invoice line items");

    expect(() =>
      requireFinancialQueryData({ data: null, error: null }, "invoice payments")
    ).toThrow("Unable to load invoice payments");

    expect(
      requireFinancialQueryData({ data: [], error: null }, "invoice payments")
    ).toEqual([]);
  });

  it("orders known categories first, sorted custom categories next, and Other last", () => {
    const summary = summarizePrintLineItems(
      [
        { category: "Z Custom", line_total: "4.25" },
        { category: "Other", line_total: "1.00" },
        { category: "Services", line_total: "10.00" },
        { category: "A Custom", line_total: "2.50" },
        { category: "Water Extraction", line_total: null },
      ],
      invoiceCategoryOrder
    );

    expect(summary.categories).toEqual([
      "Services",
      "Water Extraction",
      "A Custom",
      "Z Custom",
      "Other",
    ]);
    expect(summary.subtotalsByCategory).toEqual({
      Services: 10,
      "Water Extraction": 0,
      "A Custom": 2.5,
      "Z Custom": 4.25,
      Other: 1,
    });
    expect(summary.grandTotal).toBe(17.75);
    expect(summary.byCategory["A Custom"]).toHaveLength(1);
  });

  it("supports category names that overlap Object prototype keys", () => {
    const summary = summarizePrintLineItems(
      [
        { category: "__proto__", line_total: 2 },
        { category: "constructor", line_total: 3 },
        { category: "toString", line_total: 4 },
      ],
      invoiceCategoryOrder
    );

    expect(summary.categories).toEqual(["__proto__", "constructor", "toString"]);
    expect(summary.byCategory["__proto__"]).toHaveLength(1);
    expect(summary.subtotalsByCategory["constructor"]).toBe(3);
    expect(summary.grandTotal).toBe(9);
  });

  it.each(["NaN", "not-a-number", Number.POSITIVE_INFINITY])(
    "fails closed for a non-finite line total: %s",
    (lineTotal) => {
      expect(() =>
        summarizePrintLineItems(
          [{ category: "Services", line_total: lineTotal }],
          invoiceCategoryOrder
        )
      ).toThrow("Invalid financial amount");
    }
  );

  it("fails closed when individually finite amounts overflow during accumulation", () => {
    expect(() =>
      sumFiniteFinancialAmounts([Number.MAX_VALUE, Number.MAX_VALUE])
    ).toThrow("Invalid financial total");
  });

  it("uses the same finite-safe summation for payments", () => {
    expect(sumFiniteFinancialAmounts(["10.25", 4.75, null])).toBe(15);
    expect(() => sumFiniteFinancialAmounts(["NaN"])).toThrow(
      "Invalid financial amount"
    );
  });
});
