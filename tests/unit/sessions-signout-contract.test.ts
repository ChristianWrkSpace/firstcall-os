import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const actionSource = readFileSync("app/actions/sessions.ts", "utf8");
const panelSource = readFileSync(
  "app/(dashboard)/settings/security/SessionsPanel.tsx",
  "utf8"
);

describe("target-session operator controls", () => {
  it("cannot regress to unsupported UUID-based admin global sign-out", () => {
    expect(actionSource).not.toMatch(/auth\.admin\.signOut\s*\(/);
    expect(actionSource).not.toContain("forceSignOutUser");
    expect(panelSource).not.toContain("forceSignOutUser");
    expect(panelSource).not.toContain("Force sign-out");
  });

  it("directs operators to the canonical user deactivation flow", () => {
    expect(panelSource).toContain('href="/settings/users"');
    expect(panelSource).toMatch(/deactivat/i);
  });
});
