import { describe, it, expect } from "vitest";
import {
  PAYMENT_ROUTES,
  PAYMENT_ROUTE_BY_VALUE,
  type PaymentRoute,
} from "@/lib/constants";

// Pure logic that lives inside the customer portal — replicated here so the
// invariant is locked in by tests rather than scattered across UI files.
function deductibleBalance({
  fullBalance,
  paid,
  paymentRoute,
  deductible,
}: {
  fullBalance: number;
  paid: number;
  paymentRoute: PaymentRoute;
  deductible: number | null;
}): number {
  if (paymentRoute === "insurance_primary") return 0;
  if (paymentRoute === "insurance_with_deductible" && deductible != null) {
    return Math.max(0, Math.min(fullBalance, deductible - paid));
  }
  return fullBalance;
}

describe("payment routing", () => {
  it("constant map is exhaustive", () => {
    for (const r of PAYMENT_ROUTES) {
      expect(PAYMENT_ROUTE_BY_VALUE[r.value]).toBe(r);
    }
  });
});

describe("deductibleBalance (customer portal cap logic)", () => {
  it("customer-pay shows full balance", () => {
    expect(
      deductibleBalance({
        fullBalance: 4800,
        paid: 0,
        paymentRoute: "customer_pay",
        deductible: null,
      })
    ).toBe(4800);
  });

  it("insurance_primary always shows zero (no out-of-pocket)", () => {
    expect(
      deductibleBalance({
        fullBalance: 4800,
        paid: 0,
        paymentRoute: "insurance_primary",
        deductible: null,
      })
    ).toBe(0);
  });

  it("insurance + deductible caps at deductible amount", () => {
    expect(
      deductibleBalance({
        fullBalance: 4800,
        paid: 0,
        paymentRoute: "insurance_with_deductible",
        deductible: 1000,
      })
    ).toBe(1000);
  });

  it("deductible already partially paid reduces the payable amount", () => {
    expect(
      deductibleBalance({
        fullBalance: 4800,
        paid: 600,
        paymentRoute: "insurance_with_deductible",
        deductible: 1000,
      })
    ).toBe(400);
  });

  it("deductible already fully paid means $0 owed", () => {
    expect(
      deductibleBalance({
        fullBalance: 4800,
        paid: 1000,
        paymentRoute: "insurance_with_deductible",
        deductible: 1000,
      })
    ).toBe(0);
  });

  it("never charges more than the full balance even with a huge deductible", () => {
    expect(
      deductibleBalance({
        fullBalance: 500,
        paid: 0,
        paymentRoute: "insurance_with_deductible",
        deductible: 5000,
      })
    ).toBe(500);
  });
});
