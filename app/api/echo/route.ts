import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { askEcho, recordEchoFeedback } from "@/lib/echo";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";

// POST /api/echo — ask Echo a question. Returns { answer, conversationId, ... }.
// PATCH /api/echo — record thumbs-up / thumbs-down feedback.

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Per-user rate limit on Echo specifically — independent of global limits.
  // 30 questions / 5 min is generous for normal use, blocks runaway scripts.
  const rl = checkRateLimit({
    key: `echo:${me.id}`,
    max: 30,
    windowMs: 5 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: `Rate limited. Try again in ${Math.ceil((rl.resetAt - Date.now()) / 1000)}s.`,
      },
      { status: 429 }
    );
  }
  // Sweep stale buckets occasionally
  void LIMITS;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const question = (body?.question ?? "").toString().trim();
  if (!question) {
    return NextResponse.json({ error: "Question is required" }, { status: 400 });
  }
  if (question.length > 1000) {
    return NextResponse.json({ error: "Question too long (max 1000 chars)" }, { status: 400 });
  }

  try {
    const result = await askEcho({
      operator: { id: me.id, name: me.name, role: me.role },
      question,
    });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[echo] failed:", err);
    return NextResponse.json(
      { error: err?.message ?? "Echo failed to answer." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const conversationId = (body?.conversationId ?? "").toString();
  const feedback = body?.feedback;
  const note = body?.note;

  if (!conversationId) return NextResponse.json({ error: "conversationId required" }, { status: 400 });
  if (feedback !== "up" && feedback !== "down") {
    return NextResponse.json({ error: "feedback must be 'up' or 'down'" }, { status: 400 });
  }

  try {
    await recordEchoFeedback({
      conversationId,
      feedback,
      note: typeof note === "string" ? note : undefined,
      userId: me.id,
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Could not save feedback." },
      { status: 500 }
    );
  }
}
