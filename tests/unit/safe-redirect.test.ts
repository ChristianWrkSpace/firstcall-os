import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/safe-redirect";

describe("safeRedirectPath", () => {
  it("accepts a local absolute path", () => {
    expect(safeRedirectPath("/jobs/123?tab=field", "/dashboard")).toBe("/jobs/123?tab=field");
  });

  it("rejects absolute external URLs", () => {
    expect(safeRedirectPath("https://evil.example/phish", "/dashboard")).toBe("/dashboard");
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeRedirectPath("//evil.example/phish", "/dashboard")).toBe("/dashboard");
  });

  it("rejects encoded and backslash redirect tricks", () => {
    expect(safeRedirectPath("/%2f%2fevil.example", "/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("/\\evil.example", "/dashboard")).toBe("/dashboard");
  });

  it("uses the fallback for null or relative input", () => {
    expect(safeRedirectPath(null, "/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("jobs", "/dashboard")).toBe("/dashboard");
  });
});
