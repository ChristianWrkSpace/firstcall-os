import "server-only";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "./supabase-admin.ts";

export type AccountActiveOutcome = "completed" | "pending" | "conflict" | "error";
export type AccountProviderState = "banned" | "unbanned" | "missing" | "unknown";
export type AccountTransitionStatus =
  | "provider_pending"
  | "provider_in_progress"
  | "provider_failed"
  | "provider_applied"
  | "succeeded"
  | "closed_inactive"
  | "unavailable";

export interface AccountActiveTransitionResult {
  outcome: AccountActiveOutcome;
  transitionId: string | null;
  desiredActive: boolean;
  profileActive: boolean | null;
  providerState: AccountProviderState;
  transitionStatus: AccountTransitionStatus;
  retryable: boolean;
  message: string;
}

export type AccountActiveSnapshot = {
  transition_id: string;
  target_profile_id: string;
  desired_active: boolean;
  transition_status: Exclude<AccountTransitionStatus, "unavailable">;
  profile_active: boolean;
  provider_state: AccountProviderState;
  attempt_count: number;
  retryable: boolean;
  provider_observed_at?: string | null;
  last_error_code?: string | null;
};

type OrchestrationInput = {
  targetProfileId: string;
  desiredActive: boolean;
  idempotencyKey: string;
  actorId: string;
};
type RpcResult = { data: unknown; error: unknown };
type AdminClient = ReturnType<typeof createAdminClient>;
type Claim = Omit<AccountActiveSnapshot, "target_profile_id">;
type AcquiredWork = {
  transition_id: string;
  target_profile_id: string;
  desired_active: boolean;
  attempt_number: number;
  transition_status: "provider_in_progress";
};
export type ReconciliationItem = {
  transitionId: string;
  priorStatus: string;
  outcome: "dry-run" | "completed" | "pending" | "skipped" | "error";
};
export type ReconciliationSummary = {
  apply: boolean;
  listed: number;
  processed: number;
  completed: number;
  pending: number;
  skipped: number;
  errors: number;
  items: ReconciliationItem[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TERMINAL = new Set<AccountTransitionStatus>(["succeeded", "closed_inactive"]);
const LEASE_SECONDS = 60;
const PROVIDER_TIMEOUT_MS = 45_000;
const MAX_RECOVERY_ATTEMPTS = 5;
const MAX_BATCH = 25;

function firstRow(data: unknown): Record<string, unknown> | null {
  return Array.isArray(data) && data.length === 1 && data[0] !== null && typeof data[0] === "object"
    ? data[0] as Record<string, unknown>
    : null;
}
function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
function isProviderState(value: unknown): value is AccountProviderState {
  return value === "banned" || value === "unbanned" || value === "missing" || value === "unknown";
}
function isTransitionStatus(value: unknown): value is AccountActiveSnapshot["transition_status"] {
  return value === "provider_pending" || value === "provider_in_progress" || value === "provider_failed" ||
    value === "provider_applied" || value === "succeeded" || value === "closed_inactive";
}
function parseClaim(data: unknown, desiredActive: boolean): Claim | null {
  const row = firstRow(data);
  if (!row || !isUuid(row.transition_id) || row.desired_active !== desiredActive ||
      typeof row.profile_active !== "boolean" || typeof row.retryable !== "boolean" ||
      !isTransitionStatus(row.transition_status) || !isProviderState(row.provider_state) ||
      !Number.isInteger(row.attempt_count) || (row.attempt_count as number) < 0) return null;
  return row as unknown as Claim;
}
function parseSnapshot(data: unknown, expected?: { transitionId?: string; targetProfileId?: string; desiredActive?: boolean }): AccountActiveSnapshot | null {
  const row = firstRow(data);
  if (!row || !isUuid(row.transition_id) || !isUuid(row.target_profile_id) ||
      typeof row.desired_active !== "boolean" || typeof row.profile_active !== "boolean" ||
      typeof row.retryable !== "boolean" || !Number.isInteger(row.attempt_count) ||
      (row.attempt_count as number) < 0 || !isTransitionStatus(row.transition_status) ||
      !isProviderState(row.provider_state)) return null;
  if (expected?.transitionId && row.transition_id !== expected.transitionId) return null;
  if (expected?.targetProfileId && row.target_profile_id !== expected.targetProfileId) return null;
  if (typeof expected?.desiredActive === "boolean" && row.desired_active !== expected.desiredActive) return null;
  return row as unknown as AccountActiveSnapshot;
}
function parseAcquiredWork(data: unknown, snapshot: AccountActiveSnapshot): AcquiredWork | null {
  const row = firstRow(data);
  if (!row || row.transition_id !== snapshot.transition_id || row.target_profile_id !== snapshot.target_profile_id ||
      row.desired_active !== snapshot.desired_active || row.transition_status !== "provider_in_progress" ||
      !Number.isInteger(row.attempt_number) || row.attempt_number !== snapshot.attempt_count + 1) return null;
  return row as unknown as AcquiredWork;
}
function parseRecordedResult(data: unknown, snapshot: AccountActiveSnapshot, succeeded: boolean, state: AccountProviderState): boolean {
  const row = firstRow(data);
  return Boolean(row && row.transition_id === snapshot.transition_id &&
    row.transition_status === (succeeded ? "provider_applied" : "provider_failed") &&
    row.profile_active === snapshot.profile_active && row.provider_state === state && row.retryable === !succeeded);
}
function providerDescription(state: AccountProviderState): string {
  return state === "banned" ? "banned" : state === "unbanned" ? "unbanned" : state === "missing" ? "missing" : "not yet confirmed";
}
export function accountActiveResultFromSnapshot(snapshot: AccountActiveSnapshot): AccountActiveTransitionResult {
  const completed = TERMINAL.has(snapshot.transition_status);
  const application = snapshot.profile_active ? "active" : "inactive";
  let message: string;
  if (completed) {
    message = snapshot.desired_active
      ? "Application access is active; Auth sign-in is restored."
      : snapshot.provider_state === "missing"
        ? "Application access is inactive; the Auth user is missing and the transition is closed."
        : "Application access is inactive; Auth sign-in is blocked.";
  } else if (snapshot.transition_status === "provider_applied") {
    message = `Application access is ${application}; Auth access is ${providerDescription(snapshot.provider_state)}. Final application confirmation is pending; retry this transition.`;
  } else if (snapshot.transition_status === "provider_failed") {
    message = snapshot.desired_active
      ? "Application access remains inactive; Auth sign-in restoration is not confirmed. Retry this transition."
      : "Application access is inactive; Auth sign-in blocking is not confirmed. Retry this transition.";
  } else if (snapshot.transition_status === "provider_in_progress") {
    message = `Application access is ${application}; the Auth change is in progress. Refresh before retrying this transition.`;
  } else {
    message = snapshot.desired_active
      ? "Application access remains inactive; Auth sign-in restoration is pending. Retry this transition."
      : "Application access is inactive; Auth sign-in blocking is pending. Retry this transition.";
  }
  return { outcome: completed ? "completed" : "pending", transitionId: snapshot.transition_id,
    desiredActive: snapshot.desired_active, profileActive: snapshot.profile_active,
    providerState: snapshot.provider_state, transitionStatus: snapshot.transition_status,
    retryable: snapshot.retryable, message };
}
function unavailable(desiredActive: boolean, transitionId: string | null): AccountActiveTransitionResult {
  return { outcome: "error", transitionId, desiredActive, profileActive: null, providerState: "unknown",
    transitionStatus: "unavailable", retryable: true,
    message: "Application and Auth access could not be confirmed. Please retry." };
}
const CONFLICT_TOKENS = new Set([
  "account_transition_conflict",
  "account_transition_idempotency_conflict",
  "account_transition_stale_replay",
]);
function isConflictError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  if (typeof value.code !== "string" || value.code.toUpperCase() !== "P0001") return false;
  return [value.message, value.details, value.hint].some((part) => typeof part === "string" &&
    [...CONFLICT_TOKENS].some((token) => part.trim().toLowerCase() === token || part.trim().toLowerCase().startsWith(`${token}:`)));
}
type ProviderErrorCode = "provider_timeout" | "provider_unavailable" | "provider_rate_limited" |
  "provider_rejected" | "provider_user_missing" | "provider_response_unverified";
function classifyProviderError(error: unknown): { code: ProviderErrorCode; state: AccountProviderState } {
  if (error instanceof TypeError) return { code: "provider_unavailable", state: "unknown" };
  if (!error || typeof error !== "object") return { code: "provider_rejected", state: "unknown" };
  const value = error as { status?: unknown; code?: unknown; name?: unknown };
  const status = typeof value.status === "number" ? value.status : typeof value.status === "string" && /^\d{3}$/.test(value.status) ? Number(value.status) : null;
  const code = typeof value.code === "string" ? value.code.toLowerCase() : "";
  if (status === 404 || code === "user_not_found" || code === "not_found") return { code: "provider_user_missing", state: "missing" };
  if (status === 429 || code.includes("rate_limit")) return { code: "provider_rate_limited", state: "unknown" };
  if (status === 408 || value.name === "AbortError" || code.includes("timeout")) return { code: "provider_timeout", state: "unknown" };
  if ((status !== null && status >= 500) || code.includes("unavailable")) return { code: "provider_unavailable", state: "unknown" };
  return { code: "provider_rejected", state: "unknown" };
}
async function rpc(admin: AdminClient, name: string, args: Record<string, unknown>): Promise<RpcResult> {
  try { return await admin.rpc(name, args) as RpcResult; } catch { return { data: null, error: true }; }
}
async function readSnapshot(admin: AdminClient, transitionId: string, expected?: { targetProfileId?: string; desiredActive?: boolean }) {
  const result = await rpc(admin, "get_account_active_transition", { p_transition_id: transitionId });
  return result.error ? null : parseSnapshot(result.data, { transitionId, ...expected });
}
async function readTargetSnapshot(admin: AdminClient, targetProfileId: string) {
  const result = await rpc(admin, "get_account_active_transition_for_target", { p_target_profile_id: targetProfileId });
  return result.error ? null : parseSnapshot(result.data, { targetProfileId });
}
async function authoritativeResult(admin: AdminClient, expected: { transitionId: string; targetProfileId?: string; desiredActive?: boolean }) {
  const snapshot = await readSnapshot(admin, expected.transitionId, expected);
  return snapshot ? accountActiveResultFromSnapshot(snapshot) : unavailable(expected.desiredActive ?? false, expected.transitionId);
}
function providerCallWithTimeout(admin: AdminClient, snapshot: AccountActiveSnapshot) {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error("timeout"), { name: "AbortError" })), PROVIDER_TIMEOUT_MS);
  });
  return Promise.race([
    admin.auth.admin.updateUserById(snapshot.target_profile_id, { ban_duration: snapshot.desired_active ? "none" : "876000h" }),
    timeout,
  ]).finally(() => clearTimeout(timer));
}

async function resumeSnapshot(admin: AdminClient, initial: AccountActiveSnapshot): Promise<AccountActiveTransitionResult> {
  let snapshot = initial;
  if (TERMINAL.has(snapshot.transition_status)) return accountActiveResultFromSnapshot(snapshot);
  if (snapshot.transition_status !== "provider_applied") {
    const workerToken = randomUUID();
    const acquired = await rpc(admin, "acquire_account_provider_work", {
      p_transition_id: snapshot.transition_id, p_worker_token: workerToken, p_lease_seconds: LEASE_SECONDS,
    });
    if (acquired.error || !parseAcquiredWork(acquired.data, snapshot)) {
      return authoritativeResult(admin, { transitionId: snapshot.transition_id, targetProfileId: snapshot.target_profile_id, desiredActive: snapshot.desired_active });
    }
    let providerSucceeded = false;
    let providerState: AccountProviderState = "unknown";
    let errorCode: ProviderErrorCode | null = "provider_response_unverified";
    try {
      const provider = await providerCallWithTimeout(admin, snapshot);
      const user = provider.data?.user;
      if (provider.error) ({ code: errorCode, state: providerState } = classifyProviderError(provider.error));
      else if (user?.id === snapshot.target_profile_id) {
        if (snapshot.desired_active && user.banned_until === null) { providerSucceeded = true; providerState = "unbanned"; errorCode = null; }
        else if (!snapshot.desired_active && typeof user.banned_until === "string" && Date.parse(user.banned_until) > Date.now()) {
          providerSucceeded = true; providerState = "banned"; errorCode = null;
        }
      }
    } catch (error) { ({ code: errorCode, state: providerState } = classifyProviderError(error)); }
    const recorded = await rpc(admin, "record_account_provider_result", {
      p_transition_id: snapshot.transition_id, p_worker_token: workerToken, p_succeeded: providerSucceeded,
      p_provider_state: providerState, p_error_code: errorCode,
    });
    if (recorded.error || !parseRecordedResult(recorded.data, snapshot, providerSucceeded, providerState)) {
      const result = await authoritativeResult(admin, { transitionId: snapshot.transition_id, targetProfileId: snapshot.target_profile_id, desiredActive: snapshot.desired_active });
      if (providerSucceeded && result.outcome !== "error") return { ...result,
        message: `Application access is ${result.profileActive ? "active" : "inactive"}; Auth access may have changed, but database confirmation is pending.` };
      return result;
    }
    snapshot = await readSnapshot(admin, snapshot.transition_id, { targetProfileId: snapshot.target_profile_id, desiredActive: snapshot.desired_active }) ?? snapshot;
    if (!providerSucceeded || snapshot.transition_status !== "provider_applied" || snapshot.provider_state !== providerState) {
      return accountActiveResultFromSnapshot(snapshot);
    }
  }
  await rpc(admin, "finalize_account_active_transition", { p_transition_id: snapshot.transition_id });
  return authoritativeResult(admin, { transitionId: snapshot.transition_id, targetProfileId: snapshot.target_profile_id, desiredActive: snapshot.desired_active });
}

export async function orchestrateAccountActiveTransition(input: OrchestrationInput): Promise<AccountActiveTransitionResult> {
  const admin = createAdminClient();
  const claimed = await rpc(admin, "claim_account_active_transition", {
    p_target_profile_id: input.targetProfileId, p_desired_active: input.desiredActive,
    p_idempotency_key: input.idempotencyKey, p_actor_id: input.actorId,
  });
  if (claimed.error) {
    if (!isConflictError(claimed.error)) return unavailable(input.desiredActive, null);
    const canonical = await readTargetSnapshot(admin, input.targetProfileId);
    if (!canonical) return unavailable(input.desiredActive, null);
    const result = accountActiveResultFromSnapshot(canonical);
    if (TERMINAL.has(canonical.transition_status)) return result;
    return { ...result, outcome: "conflict", retryable: true,
      message: "Another account transition is in progress. The authoritative transition was adopted; retry it safely." };
  }
  const claim = parseClaim(claimed.data, input.desiredActive);
  if (!claim) return unavailable(input.desiredActive, null);
  const snapshot = await readSnapshot(admin, claim.transition_id, { targetProfileId: input.targetProfileId, desiredActive: input.desiredActive });
  return snapshot ? resumeSnapshot(admin, snapshot) : unavailable(input.desiredActive, claim.transition_id);
}

export async function reconcileAccountActiveTransitions(options: { apply?: boolean; limit?: number; now?: Date } = {}): Promise<ReconciliationSummary> {
  const apply = options.apply === true;
  const limit = Math.max(1, Math.min(options.limit ?? MAX_BATCH, MAX_BATCH));
  const now = options.now ?? new Date();
  const admin = createAdminClient();
  const listed = await rpc(admin, "list_recoverable_account_active_transitions", { p_limit: limit });
  const candidates = Array.isArray(listed.data) ? listed.data.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object" && isUuid((row as Record<string, unknown>).transition_id))) : [];
  const summary: ReconciliationSummary = { apply, listed: candidates.length, processed: 0, completed: 0, pending: 0, skipped: 0, errors: listed.error ? 1 : 0, items: [] };
  for (const candidate of candidates) {
    const transitionId = candidate.transition_id as string;
    const priorStatus = typeof candidate.transition_status === "string" ? candidate.transition_status : "unknown";
    if (!apply) { summary.skipped += 1; summary.items.push({ transitionId, priorStatus, outcome: "dry-run" }); continue; }
    const snapshot = await readSnapshot(admin, transitionId);
    if (!snapshot) { summary.errors += 1; summary.items.push({ transitionId, priorStatus, outcome: "error" }); continue; }
    const updatedAt = typeof candidate.updated_at === "string" ? Date.parse(candidate.updated_at) : Number.NaN;
    const backoffMs = Math.min(60 * 60_000, 30_000 * 2 ** Math.max(0, snapshot.attempt_count - 1));
    if (snapshot.attempt_count >= MAX_RECOVERY_ATTEMPTS || (snapshot.transition_status === "provider_failed" && Number.isFinite(updatedAt) && now.getTime() - updatedAt < backoffMs)) {
      summary.skipped += 1; summary.items.push({ transitionId, priorStatus, outcome: "skipped" }); continue;
    }
    summary.processed += 1;
    const result = await resumeSnapshot(admin, snapshot);
    if (result.outcome === "completed") { summary.completed += 1; summary.items.push({ transitionId, priorStatus, outcome: "completed" }); }
    else if (result.outcome === "pending") { summary.pending += 1; summary.items.push({ transitionId, priorStatus, outcome: "pending" }); }
    else { summary.errors += 1; summary.items.push({ transitionId, priorStatus, outcome: "error" }); }
  }
  return summary;
}
