import { describe, expect, it } from "vitest";
import { hashBearerToken } from "@/lib/token-hash";

describe("hashBearerToken", () => {
  it("returns a deterministic SHA-256 digest without retaining the raw bearer token", () => {
    expect(hashBearerToken("portal-secret")).toBe(
      "9792ab9d5299bb82a4b403da1bfa99def25e8884e678dd67281da34aedf5e881"
    );
    expect(hashBearerToken("portal-secret")).not.toContain("portal-secret");
  });
});
