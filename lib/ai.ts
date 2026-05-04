import Anthropic from "@anthropic-ai/sdk";

/**
 * AI plumbing for FirstCall OS — model-agnostic via Vercel AI Gateway.
 *
 * Routing:
 *   - If AI_GATEWAY_API_KEY is set → route through Vercel AI Gateway
 *     (model-agnostic, observability, fallbacks, zero-data-retention).
 *   - Else → direct Anthropic API.
 *
 * Either way, every existing call site keeps working without code changes
 * because we still expose the Anthropic SDK shape.
 *
 * Model tiers — ALWAYS import MODELS.* instead of hardcoding strings.
 * That way, when the right tradeoff for a task changes, we flip ONE constant.
 */

const GATEWAY_KEY = process.env.AI_GATEWAY_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

// Law 3 — Bounded Cost: per-day USD kill-switch.
// Reads sum(cost_usd) from agent_invocations for today. If over cap,
// next call is refused with a clear error. Cap is configurable via env.
// Set AI_KILL_SWITCH_OFF=true in Vercel env to disable (Owner override).
const DAILY_CAP_USD = Number(process.env.AI_DAILY_SPEND_CAP_USD ?? 50);
const KILL_SWITCH_OFF = process.env.AI_KILL_SWITCH_OFF === "true";

// Cached daily spend total — TTL 60s. Bounded blast radius per instance.
let _spendCache: { total: number; expiresAt: number } | null = null;

async function todaysSpendUsd(): Promise<number> {
  if (_spendCache && _spendCache.expiresAt > Date.now()) return _spendCache.total;
  try {
    const { createAdminClient } = await import("./supabase-server");
    const admin = createAdminClient();
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await admin
      .from("agent_invocations")
      .select("cost_usd")
      .gte("created_at", `${today}T00:00:00Z`);
    if (error) throw error;
    const total = (data ?? []).reduce(
      (sum: number, row: any) => sum + Number(row.cost_usd ?? 0),
      0
    );
    _spendCache = { total, expiresAt: Date.now() + 60_000 };
    return total;
  } catch {
    // Fail open on transient DB hiccup — better to allow than to block all AI.
    // Cache last-known value if we have one, else 0.
    return _spendCache?.total ?? 0;
  }
}

// Two-flag setup so we never accidentally route through the gateway when
// it isn't ready. AI_GATEWAY_ENABLED must be explicitly "true" — having a
// key alone isn't enough (the gateway 403s without a credit card on file).
// When disabled, fall through to direct Anthropic.
const GATEWAY_ENABLED =
  process.env.AI_GATEWAY_ENABLED === "true" && !!GATEWAY_KEY;

const _anthropic = new Anthropic({
  apiKey: GATEWAY_ENABLED ? GATEWAY_KEY : ANTHROPIC_KEY,
  ...(GATEWAY_ENABLED ? { baseURL: "https://ai-gateway.vercel.sh" } : {}),
});

// Wrap messages.create so every call auto-logs to agent_invocations with
// model + tokens + estimated cost. Existing call sites stay unchanged —
// they import `anthropic` and call `.messages.create(...)` exactly as before.
//
// Logging is fire-and-forget — failures NEVER block the user-facing response.
const _originalCreate = _anthropic.messages.create.bind(_anthropic.messages);
(_anthropic.messages as any).create = async function (
  params: any,
  options?: any
) {
  const t0 = Date.now();
  const model = params?.model ?? "unknown";
  // Optional context tags via custom headers — they're no-ops on the API
  // and we strip them before they cause schema-validation issues. Both the
  // direct Anthropic API and Vercel AI Gateway ignore unknown x-* headers.
  const ctxAgent = params?._agent ?? null;
  const ctxTask = params?._task ?? null;
  const ctxJobId = params?._job_id ?? null;
  // Law 3 — Bounded Cost: per-call timeout (default 60s) and max_tokens
  // ceiling. Override per-call via `_timeout_ms` (e.g. vision/thinking
  // calls that legitimately need longer). SDK default is 10 minutes — too
  // long for a hung connection.
  const ctxTimeoutMs = typeof params?._timeout_ms === "number" ? params._timeout_ms : 60_000;
  // Strip ANY `_*` private context field so future call sites can't leak
  // unknown tags into the upstream API (Anthropic/Gateway both 400 on
  // unknown body params). Belt-and-suspenders over the explicit deletes
  // above; the explicit captures still grab the tags we care about for
  // logging.
  if (params && typeof params === "object") {
    for (const k of Object.keys(params)) {
      if (k.startsWith("_")) delete params[k];
    }
    // Default a sane max_tokens ceiling so unbounded outputs can't run away.
    // Call sites that need more should pass max_tokens explicitly.
    if (params.max_tokens == null) {
      params.max_tokens = 4096;
    }
  }

  // Law 3 — kill-switch check. Refuse the call if today's spend has hit
  // the cap. This is the single most important guard against runaway loops.
  if (!KILL_SWITCH_OFF) {
    const spent = await todaysSpendUsd();
    if (spent >= DAILY_CAP_USD) {
      const err = new Error(
        `AI daily spend cap reached: $${spent.toFixed(2)} >= $${DAILY_CAP_USD.toFixed(2)}. ` +
          `Raise AI_DAILY_SPEND_CAP_USD or set AI_KILL_SWITCH_OFF=true to override.`
      );
      // Log the refusal so the kill-switch is visible in spend dashboards.
      Promise.resolve().then(async () => {
        try {
          const { createAdminClient } = await import("./supabase-server");
          const admin = createAdminClient();
          await admin.from("agent_invocations").insert({
            model,
            agent: ctxAgent,
            task: ctxTask,
            job_id: ctxJobId,
            tokens_in: 0,
            tokens_out: 0,
            cost_usd: 0,
            duration_ms: Date.now() - t0,
            error: "kill_switch: daily_cap_reached",
          });
        } catch {}
      });
      throw err;
    }
  }

  try {
    const result = await _originalCreate(params, { ...(options ?? {}), timeout: ctxTimeoutMs });
    const tIn = (result as any)?.usage?.input_tokens ?? 0;
    const tOut = (result as any)?.usage?.output_tokens ?? 0;
    // Lazy-import to avoid pulling Supabase into edge contexts that don't need it
    Promise.resolve().then(async () => {
      try {
        const [{ priceCall }, { createAdminClient }] = await Promise.all([
          import("./ai-cost"),
          import("./supabase-server"),
        ]);
        const admin = createAdminClient();
        await admin.from("agent_invocations").insert({
          model,
          agent: ctxAgent,
          task: ctxTask,
          job_id: ctxJobId,
          tokens_in: tIn,
          tokens_out: tOut,
          cost_usd: priceCall(model, tIn, tOut),
          duration_ms: Date.now() - t0,
        });
      } catch {
        // Logging must never break a request
      }
    });
    return result;
  } catch (err: any) {
    Promise.resolve().then(async () => {
      try {
        const { createAdminClient } = await import("./supabase-server");
        const admin = createAdminClient();
        await admin.from("agent_invocations").insert({
          model,
          agent: ctxAgent,
          task: ctxTask,
          job_id: ctxJobId,
          tokens_in: 0,
          tokens_out: 0,
          cost_usd: 0,
          duration_ms: Date.now() - t0,
          error: String(err?.message ?? err).slice(0, 500),
        });
      } catch {}
    });
    throw err;
  }
};

export const anthropic = _anthropic;

export const AI_PROVIDER: "gateway" | "direct" = GATEWAY_ENABLED ? "gateway" : "direct";

const PROVIDER_PREFIX = GATEWAY_ENABLED ? "anthropic/" : "";

/**
 * Tiered models. Pick by what the task actually needs.
 *
 * FAST (Haiku 4.5) — classification, parsing, lead research, light extraction.
 *   Cheap + fast. Use whenever a precise schema is enforced and the task is
 *   not multi-hop.
 *
 * BALANCED (Sonnet 4.6) — drafts that a human reviews (estimates, legal docs,
 *   adjuster outreach). Good reasoning at moderate cost. Default for "agent
 *   produces a draft, person approves."
 *
 * SMART (Opus 4.7) — vision-heavy scope analysis (Argus), chat/orchestration
 *   (Solomon), anything where wrong answers are expensive.
 */
export const MODELS = {
  FAST: `${PROVIDER_PREFIX}claude-haiku-4-5`,
  BALANCED: `${PROVIDER_PREFIX}claude-sonnet-4-6`,
  SMART: `${PROVIDER_PREFIX}claude-opus-4-7`,
} as const;

export type ModelTier = keyof typeof MODELS;

/**
 * Pick a model by intent without thinking about provider strings:
 *   modelFor("fast") → "claude-haiku-4-5"
 */
export function modelFor(tier: Lowercase<ModelTier> | ModelTier): string {
  const upper = tier.toUpperCase() as ModelTier;
  return MODELS[upper];
}
