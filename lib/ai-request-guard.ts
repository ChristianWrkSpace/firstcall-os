export const MAX_BODY_BYTES = 64 * 1024;
const MAX_TRANSCRIPT_CHARS = 20_000;

export type AiTranscriptValidation =
  | { ok: true; transcript: string }
  | { ok: false; status: 400 | 413; error: string };

export function validateAiTranscriptRequest(
  contentLengthHeader: string | null,
  transcript: unknown
): AiTranscriptValidation {
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return { ok: false, status: 413, error: "Request body is too large." };
    }
  }

  if (typeof transcript !== "string" || !transcript.trim()) {
    return { ok: false, status: 400, error: "Missing transcript." };
  }

  const normalized = transcript.trim();
  if (normalized.length > MAX_TRANSCRIPT_CHARS) {
    return { ok: false, status: 413, error: "Transcript is too long." };
  }

  return { ok: true, transcript: normalized };
}
