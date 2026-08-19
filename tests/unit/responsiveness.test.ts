import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("dashboard responsiveness", () => {
  it("streams a dashboard-wide navigation skeleton", () => {
    expect(existsSync(resolve(root, "app/(dashboard)/loading.tsx"))).toBe(true);
  });

  it("streams the notification bell without blocking the dashboard shell", () => {
    const layout = source("app/(dashboard)/layout.tsx");
    expect(layout).toContain("<Suspense");
    expect(layout).toContain("<NotificationBell />");
    expect(layout).toContain("NotificationBellFallback");
  });

  it("uses client navigation instead of full-page reloads for core workflows", () => {
    const approvals = source("app/(dashboard)/approvals/ApprovalActions.tsx");
    const esquire = source("app/(dashboard)/jobs/[id]/EsquirePanel.tsx");
    const legal = source("app/(dashboard)/jobs/[id]/legal/[docId]/LegalDocActions.tsx");

    expect(approvals).not.toContain("window.location.reload()");
    expect(approvals).toContain("router.refresh()");
    expect(esquire).not.toContain("window.location.href");
    expect(esquire).toContain("router.push(");
    expect(legal).not.toContain("window.location.href");
    expect(legal).not.toContain("setTimeout(() => window.location.reload(), 1500)");
    expect(legal).toContain("router.refresh()");
    expect(legal).toContain("router.push(");
  });
});
