import { NextRequest, NextResponse } from "next/server";
import { extractFromTranscript } from "@/lib/extract";
import { getCurrentUser } from "@/lib/auth-helpers";
import { MAX_BODY_BYTES, validateAiTranscriptRequest } from "@/lib/ai-request-guard";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";

async function readBoundedJson(req: NextRequest): Promise<{ ok: true; value: unknown } | { ok: false; tooLarge: boolean }> {
  if (!req.body) return { ok: false, tooLarge: false };
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_BODY_BYTES) {
      await reader.cancel();
      return { ok: false, tooLarge: true };
    }
    chunks.push(value);
  }

  const body = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
  try {
    return { ok: true, value: JSON.parse(body) };
  } catch {
    return { ok: false, tooLarge: false };
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentLength = req.headers.get("content-length");
    const declaredSize = validateAiTranscriptRequest(contentLength, "size-check");
    if (!declaredSize.ok && declaredSize.status === 413) {
      return NextResponse.json({ error: declaredSize.error }, { status: declaredSize.status });
    }

    const body = await readBoundedJson(req);
    if (!body.ok) {
      return NextResponse.json(
        { error: body.tooLarge ? "Request body is too large." : "Request body must be valid JSON." },
        { status: body.tooLarge ? 413 : 400 }
      );
    }
    const transcript =
      typeof body.value === "object" && body.value !== null && "transcript" in body.value
        ? (body.value as { transcript: unknown }).transcript
        : undefined;
    const validated = validateAiTranscriptRequest(null, transcript);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: validated.status });
    }

    const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const perUser = checkRateLimit({ key: `user:${user.id}:calls-extract`, ...LIMITS.ai_call });
    const perIp = checkRateLimit({ key: `ip:${forwardedFor}:calls-extract`, ...LIMITS.ai_call });
    if (!perUser.ok || !perIp.ok) {
      const resetAt = Math.max(perUser.resetAt, perIp.resetAt);
      return NextResponse.json(
        { error: "Too many extraction requests. Try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))) },
        }
      );
    }

    const extraction = await extractFromTranscript(validated.transcript);
    return NextResponse.json({ transcript: validated.transcript, extraction });
  } catch (err: unknown) {
    console.error("[calls/extract] request failed", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
