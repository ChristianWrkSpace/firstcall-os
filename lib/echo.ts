import { anthropic, MODELS } from "./ai";
import { feedbackPreamble } from "./agent-feedback";
import { buildEchoContext } from "./echo-context";
import { createAdminClient } from "./supabase-server";

export interface EchoRequest {
  question: string;
  operator: { id: string; name: string; role: string };
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface EchoResponse {
  answer: string;
  conversationId: string;
  model: string;
  tier: "fast" | "balanced";
  costUsd: number;
}

// Cap Echo-specific spend so chat-y questions can't accidentally rack up
// $50/day. Tunable per env if you want it tighter.
const DAILY_CAP_USD = Number(process.env.ECHO_DAILY_CAP_USD ?? 2);

/**
 * Heuristic: route to BALANCED (Sonnet) when the question is genuinely
 * complex. Default to FAST (Haiku) for everything else. Saves ~5x on
 * the typical ask. The user never picks the model.
 */
function pickTier(question: string): "fast" | "balanced" {
  const q = question.trim().toLowerCase();
  if (q.length > 220) return "balanced";
  // Reasoning / recommendation / multi-hop signals
  const heavy = /\b(why|how should|recommend|compare|analy|strateg|optim|trade ?off|pros and cons|forecast|predict|root cause|deep ?dive)\b/i;
  if (heavy.test(question)) return "balanced";
  return "fast";
}

async function todaySpendUsd(): Promise<number> {
  const admin = createAdminClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { data } = await admin
    .from("echo_conversations")
    .select("cost_usd")
    .gte("created_at", todayStart.toISOString());
  return (data ?? []).reduce((s: number, r: any) => s + Number(r.cost_usd ?? 0), 0);
}

export async function askEcho(req: EchoRequest): Promise<EchoResponse> {
  const t0 = Date.now();

  // ── Cost cap (cheap pre-check)
  const spent = await todaySpendUsd();
  if (spent >= DAILY_CAP_USD) {
    const cap = DAILY_CAP_USD.toFixed(2);
    const conversationId = await persist({
      userId: req.operator.id,
      question: req.question,
      answer: `Echo is paused for the day — you've used $${spent.toFixed(2)} of the $${cap} daily cap. Resets at midnight. Need more? Set ECHO_DAILY_CAP_USD higher in env.`,
      model: "skipped (cap)",
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      durationMs: Date.now() - t0,
    });
    return {
      conversationId,
      answer: `Echo is paused for the day — used $${spent.toFixed(2)} of $${cap} cap. Resets at midnight.`,
      model: "skipped",
      tier: "fast",
      costUsd: 0,
    };
  }

  const tier: "fast" | "balanced" = pickTier(req.question);
  const model = tier === "balanced" ? MODELS.BALANCED : MODELS.FAST;

  // Recursive learning: pull past corrections to Echo
  const preamble = await feedbackPreamble("echo", "qa", 5);
  const systemContext = await buildEchoContext({
    name: req.operator.name,
    role: req.operator.role,
  });

  // Compose the message thread. Recent history is included if provided
  // (caller decides — Command Center sends none for now, single-turn).
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [
    ...(req.history ?? []),
    { role: "user", content: req.question },
  ];

  const result = await anthropic.messages.create({
    model,
    max_tokens: tier === "balanced" ? 800 : 500,
    system: preamble + systemContext,
    messages,
    // Tag the call so agent_invocations can attribute it to Echo (the SDK
    // wrapper in lib/ai.ts strips these before sending to the API).
    ...({ _agent: "echo", _task: "qa", _user_id: req.operator.id } as any),
  } as any);

  const tokensIn = (result as any)?.usage?.input_tokens ?? 0;
  const tokensOut = (result as any)?.usage?.output_tokens ?? 0;
  const answer = (result.content as any[])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim() || "(no response)";

  // Compute cost via the same pricing table the SDK wrapper uses
  const { priceCall } = await import("./ai-cost");
  const costUsd = priceCall(model, tokensIn, tokensOut);

  const conversationId = await persist({
    userId: req.operator.id,
    question: req.question,
    answer,
    model,
    tokensIn,
    tokensOut,
    costUsd,
    durationMs: Date.now() - t0,
  });

  return { conversationId, answer, model, tier, costUsd };
}

async function persist(args: {
  userId: string;
  question: string;
  answer: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  durationMs: number;
}): Promise<string> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("echo_conversations")
      .insert({
        user_id: args.userId,
        question: args.question,
        answer: args.answer,
        model: args.model,
        tokens_in: args.tokensIn,
        tokens_out: args.tokensOut,
        cost_usd: args.costUsd,
        duration_ms: args.durationMs,
      })
      .select("id")
      .single();
    return data?.id ?? "unknown";
  } catch (err) {
    console.error("[echo] failed to persist conversation:", err);
    return "unknown";
  }
}

/**
 * Capture user feedback (👍 / 👎) on an Echo answer. Writes to
 * echo_conversations + the global agent_outcomes table so the recursive
 * feedback preamble picks it up on the next ask.
 */
export async function recordEchoFeedback(args: {
  conversationId: string;
  feedback: "up" | "down";
  note?: string;
  userId?: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("echo_conversations")
    .update({
      feedback: args.feedback,
      feedback_note: args.note?.trim() || null,
      feedback_at: new Date().toISOString(),
    })
    .eq("id", args.conversationId);

  // Mirror to agent_outcomes for the cross-agent feedback preamble
  try {
    await admin.from("agent_outcomes").insert({
      agent: "echo",
      task: "qa",
      outcome: args.feedback === "up" ? "approved_unchanged" : "rejected",
      entity_type: "echo_conversation",
      entity_id: args.conversationId,
      user_id: args.userId ?? null,
      delta: args.note ? { note: args.note } : {},
    });
  } catch (err) {
    console.error("[echo] failed to mirror to agent_outcomes:", err);
  }
}
