import { describe, expect, it } from "vitest";
import { validateAiTranscriptRequest } from "@/lib/ai-request-guard";

describe("validateAiTranscriptRequest", () => {
  it("rejects a request body declared over the byte limit", () => {
    expect(validateAiTranscriptRequest("70000", "short transcript")).toEqual({
      ok: false,
      status: 413,
      error: "Request body is too large.",
    });
  });

  it("rejects a missing transcript", () => {
    expect(validateAiTranscriptRequest(null, null)).toEqual({
      ok: false,
      status: 400,
      error: "Missing transcript.",
    });
  });

  it("rejects a transcript over the character limit", () => {
    expect(validateAiTranscriptRequest(null, "x".repeat(20_001))).toEqual({
      ok: false,
      status: 413,
      error: "Transcript is too long.",
    });
  });

  it("trims and accepts a bounded transcript", () => {
    expect(validateAiTranscriptRequest(null, "  water loss  ")).toEqual({
      ok: true,
      transcript: "water loss",
    });
  });
});
