import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { askIris, recordIrisFeedback } from "@/lib/iris";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";

// POST /api/iris — ask Iris a question. Returns { answer, conversationId, ... }.
// PATCH /api/iris — record thumbs-up / thumbs-down feedback.

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Per-user rate limit on Iris specifically — independent of global limits.
  // 30 questions / 5 min is generous for normal use, blocks runaway scripts.
  const rl = checkRateLimit({
    key: `iris:${me.id}`,
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
    const result = await askIris({
      operator: { id: me.id, name: me.name, role: me.role },
      question,
    });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[iris] failed:", err);
    return NextResponse.json(
      { error: err?.message ?? "Iris failed to answer." },
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
    await recordIrisFeedback({
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
