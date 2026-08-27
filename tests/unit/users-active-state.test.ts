import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

const TARGET_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR_ID = "22222222-2222-4222-8222-222222222222";
const KEY = "33333333-3333-4333-8333-333333333333";
const TRANSITION_ID = "44444444-4444-4444-8444-444444444444";
const WORKER_ID = "55555555-5555-4555-8555-555555555555";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  updateUserById: vi.fn(),
  randomUUID: vi.fn(() => "55555555-5555-4555-8555-555555555555"),
  requirePermission: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("node:crypto", () => ({ randomUUID: mocks.randomUUID }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth-helpers", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({
    rpc: mocks.rpc,
    auth: { admin: { updateUserById: mocks.updateUserById } },
  }),
}));

import {
  orchestrateAccountActiveTransition,
  reconcileAccountActiveTransitions,
} from "@/lib/account-active-transitions";
import { setUserActive } from "@/app/actions/users";

function transitionRow(
  desiredActive: boolean,
  transitionStatus: string,
  profileActive = !desiredActive,
  providerState = "unknown",
  retryable = true
) {
  return {
    transition_id: TRANSITION_ID,
    target_profile_id: TARGET_ID,
    desired_active: desiredActive,
    transition_status: transitionStatus,
    profile_active: profileActive,
    provider_state: providerState,
    attempt_count: transitionStatus === "provider_pending" ? 0 : 1,
    retryable: retryable,
    provider_observed_at: null,
    last_error_code: null,
  };
}

function rpcSequence(...steps: Array<{ name: string; data?: unknown; error?: unknown }>) {
  mocks.rpc.mockImplementation(async (name: string) => {
    const step = steps.shift();
    expect(name).toBe(step?.name);
    return { data: step?.data ?? null, error: step?.error ?? null };
  });
}

describe("account active transition orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    null,
    [],
    [transitionRow(false, "provider_pending"), transitionRow(false, "provider_pending")],
    [{ ...transitionRow(false, "provider_pending"), transition_id: "not-a-uuid" }],
    [transitionRow(true, "provider_pending")],
  ])("fails closed on an unbound claim response without calling Auth", async (claimData) => {
    mocks.rpc.mockResolvedValue({ data: claimData, error: null });

    const result = await orchestrateAccountActiveTransition({
      targetProfileId: TARGET_ID,
      desiredActive: false,
      idempotencyKey: KEY,
      actorId: ACTOR_ID,
    });

    expect(result).toMatchObject({ outcome: "error", profileActive: null, providerState: "unknown" });
    expect(mocks.updateUserById).not.toHaveBeenCalled();
  });

  it("binds a valid claim to exactly one authoritative target snapshot before acquiring work", async () => {
    rpcSequence(
      { name: "claim_account_active_transition", data: [transitionRow(false, "provider_pending", false)] },
      { name: "get_account_active_transition", data: [{ ...transitionRow(false, "provider_pending", false), target_profile_id: ACTOR_ID }] },
    );

    const result = await orchestrateAccountActiveTransition({ targetProfileId: TARGET_ID, desiredActive: false, idempotencyKey: KEY, actorId: ACTOR_ID });

    expect(result).toMatchObject({ outcome: "error", profileActive: null, providerState: "unknown" });
    expect(mocks.updateUserById).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });

  it.each([
    [[]],
    [[{ transition_id: TRANSITION_ID, target_profile_id: TARGET_ID, desired_active: false, attempt_number: 0, transition_status: "provider_in_progress" }]],
    [[{ transition_id: TRANSITION_ID, target_profile_id: ACTOR_ID, desired_active: false, attempt_number: 1, transition_status: "provider_in_progress" }]],
  ])("does not call Auth when acquired work is not one exact bound row", async (acquireData) => {
    rpcSequence(
      { name: "claim_account_active_transition", data: [transitionRow(false, "provider_pending", false)] },
      { name: "get_account_active_transition", data: [transitionRow(false, "provider_pending", false)] },
      { name: "acquire_account_provider_work", data: acquireData },
      { name: "get_account_active_transition", data: [transitionRow(false, "provider_pending", false)] },
    );

    const result = await orchestrateAccountActiveTransition({ targetProfileId: TARGET_ID, desiredActive: false, idempotencyKey: KEY, actorId: ACTOR_ID });

    expect(result).toMatchObject({ outcome: "pending", transitionStatus: "provider_pending" });
    expect(mocks.updateUserById).not.toHaveBeenCalled();
  });

  it("requires the recorded provider result and authoritative snapshot to match before finalizing", async () => {
    rpcSequence(
      { name: "claim_account_active_transition", data: [transitionRow(false, "provider_pending", false)] },
      { name: "get_account_active_transition", data: [transitionRow(false, "provider_pending", false)] },
      { name: "acquire_account_provider_work", data: [{ transition_id: TRANSITION_ID, target_profile_id: TARGET_ID, desired_active: false, attempt_number: 1, transition_status: "provider_in_progress" }] },
      { name: "record_account_provider_result", data: [{ transition_id: ACTOR_ID, transition_status: "provider_applied", profile_active: false, provider_state: "banned", retryable: false }] },
      { name: "get_account_active_transition", data: [transitionRow(false, "provider_in_progress", false)] },
    );
    mocks.updateUserById.mockResolvedValue({ data: { user: { id: TARGET_ID, banned_until: "2126-01-01T00:00:00Z" } }, error: null });

    const result = await orchestrateAccountActiveTransition({ targetProfileId: TARGET_ID, desiredActive: false, idempotencyKey: KEY, actorId: ACTOR_ID });

    expect(result.outcome).toBe("pending");
    expect(mocks.rpc.mock.calls.map(([name]) => name)).not.toContain("finalize_account_active_transition");
  });

  it("does not expose another transition or opposite desired state from an authoritative read", async () => {
    rpcSequence(
      { name: "claim_account_active_transition", data: [transitionRow(false, "succeeded", false, "banned", false)] },
      { name: "get_account_active_transition", data: [{ ...transitionRow(true, "succeeded", true, "unbanned", false), transition_id: ACTOR_ID }] },
    );

    const result = await orchestrateAccountActiveTransition({ targetProfileId: TARGET_ID, desiredActive: false, idempotencyKey: KEY, actorId: ACTOR_ID });

    expect(result).toMatchObject({ outcome: "error", transitionId: TRANSITION_ID, desiredActive: false, profileActive: null });
  });

  it("reports state-specific uncertainty when Auth succeeded but recording failed", async () => {
    rpcSequence(
      { name: "claim_account_active_transition", data: [transitionRow(false, "provider_pending", false)] },
      { name: "get_account_active_transition", data: [transitionRow(false, "provider_pending", false)] },
      { name: "acquire_account_provider_work", data: [{ transition_id: TRANSITION_ID, target_profile_id: TARGET_ID, desired_active: false, attempt_number: 1, transition_status: "provider_in_progress" }] },
      { name: "record_account_provider_result", error: { message: "private db failure" } },
      { name: "get_account_active_transition", data: [transitionRow(false, "provider_in_progress", false)] },
    );
    mocks.updateUserById.mockResolvedValue({ data: { user: { id: TARGET_ID, banned_until: "2126-01-01T00:00:00Z" } }, error: null });

    const result = await orchestrateAccountActiveTransition({ targetProfileId: TARGET_ID, desiredActive: false, idempotencyKey: KEY, actorId: ACTOR_ID });

    expect(result.message).toContain("Application access is inactive");
    expect(result.message).toContain("Auth access may have changed");
    expect(result.message).toContain("database confirmation is pending");
  });

  it("does not treat unrelated substrings as a machine conflict token", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "P0001", message: "prefix account_transition_conflict suffix" } });

    const result = await orchestrateAccountActiveTransition({ targetProfileId: TARGET_ID, desiredActive: true, idempotencyKey: KEY, actorId: ACTOR_ID });

    expect(result.outcome).toBe("error");
  });

  it("bounds the provider call below the lease and records a sanitized timeout", async () => {
    vi.useFakeTimers();
    rpcSequence(
      { name: "claim_account_active_transition", data: [transitionRow(false, "provider_pending", false)] },
      { name: "get_account_active_transition", data: [transitionRow(false, "provider_pending", false)] },
      { name: "acquire_account_provider_work", data: [{ transition_id: TRANSITION_ID, target_profile_id: TARGET_ID, desired_active: false, attempt_number: 1, transition_status: "provider_in_progress" }] },
      { name: "record_account_provider_result", data: [transitionRow(false, "provider_failed", false)] },
      { name: "get_account_active_transition", data: [transitionRow(false, "provider_failed", false)] },
    );
    mocks.updateUserById.mockReturnValue(new Promise(() => {}));

    const pendingResult = orchestrateAccountActiveTransition({ targetProfileId: TARGET_ID, desiredActive: false, idempotencyKey: KEY, actorId: ACTOR_ID });
    await vi.advanceTimersByTimeAsync(45_000);
    const result = await pendingResult;

    expect(mocks.rpc).toHaveBeenNthCalledWith(4, "record_account_provider_result", expect.objectContaining({
      p_succeeded: false,
      p_error_code: "provider_timeout",
    }));
    expect(result).toMatchObject({ outcome: "pending", transitionStatus: "provider_failed" });
  });

  it.each([
    [{ status: "503" }, "provider_unavailable"],
    [new TypeError("network private detail"), "provider_unavailable"],
  ])("classifies unavailable provider failures fail-closed", async (providerError, expectedCode) => {
    rpcSequence(
      { name: "claim_account_active_transition", data: [transitionRow(true, "provider_pending", false)] },
      { name: "get_account_active_transition", data: [transitionRow(true, "provider_pending", false)] },
      { name: "acquire_account_provider_work", data: [{ transition_id: TRANSITION_ID, target_profile_id: TARGET_ID, desired_active: true, attempt_number: 1, transition_status: "provider_in_progress" }] },
      { name: "record_account_provider_result", data: [transitionRow(true, "provider_failed", false)] },
      { name: "get_account_active_transition", data: [transitionRow(true, "provider_failed", false)] },
    );
    mocks.updateUserById.mockRejectedValue(providerError);

    await orchestrateAccountActiveTransition({ targetProfileId: TARGET_ID, desiredActive: true, idempotencyKey: KEY, actorId: ACTOR_ID });

    expect(mocks.rpc).toHaveBeenNthCalledWith(4, "record_account_provider_result", expect.objectContaining({ p_error_code: expectedCode }));
  });

  it("deactivates only after observing the provider ban and finalizes from the authoritative snapshot", async () => {
    const calls: string[] = [];
    let authoritativeRead = 0;
    mocks.rpc.mockImplementation(async (name: string, args: unknown) => {
      calls.push(name);
      if (name === "claim_account_active_transition") {
        expect(args).toEqual({
          p_target_profile_id: TARGET_ID,
          p_desired_active: false,
          p_idempotency_key: KEY,
          p_actor_id: ACTOR_ID,
        });
        return {
          data: [{
            transition_id: TRANSITION_ID,
            desired_active: false,
            transition_status: "provider_pending",
            profile_active: false,
            provider_state: "unknown",
            attempt_count: 0,
            retryable: true,
          }],
          error: null,
        };
      }
      if (name === "acquire_account_provider_work") {
        expect(args).toEqual({
          p_transition_id: TRANSITION_ID,
          p_worker_token: WORKER_ID,
          p_lease_seconds: 60,
        });
        return { data: [{ transition_id: TRANSITION_ID, target_profile_id: TARGET_ID, desired_active: false, attempt_number: 1, transition_status: "provider_in_progress" }], error: null };
      }
      if (name === "record_account_provider_result") {
        expect(args).toEqual({
          p_transition_id: TRANSITION_ID,
          p_worker_token: WORKER_ID,
          p_succeeded: true,
          p_provider_state: "banned",
          p_error_code: null,
        });
        return { data: [{ transition_id: TRANSITION_ID, transition_status: "provider_applied", profile_active: false, provider_state: "banned", retryable: false }], error: null };
      }
      if (name === "finalize_account_active_transition") {
        return { data: [{ transition_id: TRANSITION_ID, desired_active: false, transition_status: "succeeded", profile_active: false, provider_state: "banned", retryable: false }], error: null };
      }
      if (name === "get_account_active_transition") {
        authoritativeRead += 1;
        const transitionStatus = authoritativeRead === 1 ? "provider_pending" : authoritativeRead === 2 ? "provider_applied" : "succeeded";
        return { data: [{ transition_id: TRANSITION_ID, target_profile_id: TARGET_ID, desired_active: false, transition_status: transitionStatus, profile_active: false, provider_state: authoritativeRead === 1 ? "unknown" : "banned", provider_observed_at: "2026-08-24T12:00:00Z", attempt_count: authoritativeRead === 1 ? 0 : 1, last_error_code: null, retryable: authoritativeRead === 1 }], error: null };
      }
      throw new Error(`unexpected rpc ${name}`);
    });
    mocks.updateUserById.mockImplementation(async (id: string, attrs: unknown) => {
      calls.push("provider");
      expect(id).toBe(TARGET_ID);
      expect(attrs).toEqual({ ban_duration: "876000h" });
      return { data: { user: { id: TARGET_ID, banned_until: "2126-08-24T12:00:00Z" } }, error: null };
    });

    await expect(orchestrateAccountActiveTransition({
      targetProfileId: TARGET_ID,
      desiredActive: false,
      idempotencyKey: KEY,
      actorId: ACTOR_ID,
    })).resolves.toEqual({
      outcome: "completed",
      transitionId: TRANSITION_ID,
      desiredActive: false,
      profileActive: false,
      providerState: "banned",
      transitionStatus: "succeeded",
      retryable: false,
      message: "Application access is inactive; Auth sign-in is blocked.",
    });
    expect(calls).toEqual([
      "claim_account_active_transition",
      "get_account_active_transition",
      "acquire_account_provider_work",
      "provider",
      "record_account_provider_result",
      "get_account_active_transition",
      "finalize_account_active_transition",
      "get_account_active_transition",
    ]);
  });

  it("adopts the authoritative opposite in-flight transition without calling the provider", async () => {
    mocks.rpc
      .mockResolvedValueOnce({
        data: null,
        error: { code: "P0001", message: "account_transition_conflict: private@example.com" },
      })
      .mockResolvedValueOnce({ data: [transitionRow(false, "provider_failed", false)], error: null });

    const result = await orchestrateAccountActiveTransition({
      targetProfileId: TARGET_ID,
      desiredActive: true,
      idempotencyKey: KEY,
      actorId: ACTOR_ID,
    });

    expect(result).toEqual({
      outcome: "conflict",
      transitionId: TRANSITION_ID,
      desiredActive: false,
      profileActive: false,
      providerState: "unknown",
      transitionStatus: "provider_failed",
      retryable: true,
      message: "Another account transition is in progress. The authoritative transition was adopted; retry it safely.",
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "get_account_active_transition_for_target", { p_target_profile_id: TARGET_ID });
    expect(mocks.updateUserById).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("private@example.com");
  });

  it("adopts the latest completed transition when a stale historical key is replayed", async () => {
    mocks.rpc
      .mockResolvedValueOnce({
        data: null,
        error: { code: "P0001", message: "account_transition_stale_replay" },
      })
      .mockResolvedValueOnce({ data: [transitionRow(true, "succeeded", true, "unbanned", false)], error: null });

    const result = await orchestrateAccountActiveTransition({
      targetProfileId: TARGET_ID,
      desiredActive: false,
      idempotencyKey: KEY,
      actorId: ACTOR_ID,
    });

    expect(result).toMatchObject({
      outcome: "completed",
      desiredActive: true,
      profileActive: true,
      providerState: "unbanned",
      transitionStatus: "succeeded",
      retryable: false,
    });
    expect(result.message).toContain("Application access is active");
    expect(mocks.updateUserById).not.toHaveBeenCalled();
  });

  it("activates with ban_duration none after observing an unbanned provider user", async () => {
    rpcSequence(
      { name: "claim_account_active_transition", data: [transitionRow(true, "provider_pending", false)] },
      { name: "get_account_active_transition", data: [transitionRow(true, "provider_pending", false)] },
      { name: "acquire_account_provider_work", data: [{ transition_id: TRANSITION_ID, target_profile_id: TARGET_ID, desired_active: true, attempt_number: 1, transition_status: "provider_in_progress" }] },
      { name: "record_account_provider_result", data: [transitionRow(true, "provider_applied", false, "unbanned", false)] },
      { name: "get_account_active_transition", data: [transitionRow(true, "provider_applied", false, "unbanned", false)] },
      { name: "finalize_account_active_transition", data: [transitionRow(true, "succeeded", true, "unbanned", false)] },
      { name: "get_account_active_transition", data: [transitionRow(true, "succeeded", true, "unbanned", false)] },
    );
    mocks.updateUserById.mockResolvedValue({ data: { user: { id: TARGET_ID, banned_until: null } }, error: null });

    const result = await orchestrateAccountActiveTransition({ targetProfileId: TARGET_ID, desiredActive: true, idempotencyKey: KEY, actorId: ACTOR_ID });

    expect(mocks.updateUserById).toHaveBeenCalledWith(TARGET_ID, { ban_duration: "none" });
    expect(result).toMatchObject({ outcome: "completed", profileActive: true, providerState: "unbanned", transitionStatus: "succeeded" });
  });

  it("resumes the same key from provider_failed by acquiring fresh work", async () => {
    rpcSequence(
      { name: "claim_account_active_transition", data: [transitionRow(false, "provider_failed", false)] },
      { name: "get_account_active_transition", data: [transitionRow(false, "provider_failed", false)] },
      { name: "acquire_account_provider_work", data: [{ transition_id: TRANSITION_ID, target_profile_id: TARGET_ID, desired_active: false, attempt_number: 2, transition_status: "provider_in_progress" }] },
      { name: "record_account_provider_result", data: [transitionRow(false, "provider_applied", false, "banned", false)] },
      { name: "get_account_active_transition", data: [transitionRow(false, "provider_applied", false, "banned", false)] },
      { name: "finalize_account_active_transition", data: [transitionRow(false, "succeeded", false, "banned", false)] },
      { name: "get_account_active_transition", data: [transitionRow(false, "succeeded", false, "banned", false)] },
    );
    mocks.updateUserById.mockResolvedValue({ data: { user: { id: TARGET_ID, banned_until: "2126-01-01T00:00:00Z" } }, error: null });

    await orchestrateAccountActiveTransition({ targetProfileId: TARGET_ID, desiredActive: false, idempotencyKey: KEY, actorId: ACTOR_ID });

    expect(mocks.randomUUID).toHaveBeenCalledOnce();
    expect(mocks.updateUserById).toHaveBeenCalledOnce();
  });

  it("returns pending from the snapshot when another worker owns an active lease", async () => {
    rpcSequence(
      { name: "claim_account_active_transition", data: [transitionRow(false, "provider_in_progress", false)] },
      { name: "get_account_active_transition", data: [transitionRow(false, "provider_in_progress", false)] },
      { name: "acquire_account_provider_work", error: { code: "55P03", message: "account_transition_lease_active" } },
      { name: "get_account_active_transition", data: [transitionRow(false, "provider_in_progress", false)] },
    );

    const result = await orchestrateAccountActiveTransition({ targetProfileId: TARGET_ID, desiredActive: false, idempotencyKey: KEY, actorId: ACTOR_ID });

    expect(result).toMatchObject({ outcome: "pending", transitionStatus: "provider_in_progress", profileActive: false });
    expect(mocks.updateUserById).not.toHaveBeenCalled();
  });

  it.each([
    [{ status: 429, message: "email private@example.com" }, "provider_rate_limited"],
    [{ status: 404, code: "user_not_found", message: "private@example.com" }, "provider_user_missing"],
  ])("records sanitized provider failures", async (providerError, expectedCode) => {
    rpcSequence(
      { name: "claim_account_active_transition", data: [transitionRow(false, "provider_pending", false)] },
      { name: "get_account_active_transition", data: [transitionRow(false, "provider_pending", false)] },
      { name: "acquire_account_provider_work", data: [{ transition_id: TRANSITION_ID, target_profile_id: TARGET_ID, desired_active: false, attempt_number: 1, transition_status: "provider_in_progress" }] },
      { name: "record_account_provider_result", data: [transitionRow(false, "provider_failed", false, expectedCode === "provider_user_missing" ? "missing" : "unknown")] },
      { name: "get_account_active_transition", data: [transitionRow(false, "provider_failed", false, expectedCode === "provider_user_missing" ? "missing" : "unknown")] },
    );
    mocks.updateUserById.mockResolvedValue({ data: { user: null }, error: providerError });

    const result = await orchestrateAccountActiveTransition({ targetProfileId: TARGET_ID, desiredActive: false, idempotencyKey: KEY, actorId: ACTOR_ID });

    expect(mocks.rpc).toHaveBeenNthCalledWith(4, "record_account_provider_result", expect.objectContaining({
      p_succeeded: false,
      p_provider_state: expectedCode === "provider_user_missing" ? "missing" : "unknown",
      p_error_code: expectedCode,
    }));
    expect(result).toMatchObject({ outcome: "pending", transitionStatus: "provider_failed" });
    expect(JSON.stringify(result)).not.toContain("private@example.com");
  });

  it.each([
    [{ id: TARGET_ID }],
    [{ id: ACTOR_ID, banned_until: null }],
  ])("records an unverified response when provider identity or ban semantics are malformed", async (providerUser) => {
    rpcSequence(
      { name: "claim_account_active_transition", data: [transitionRow(true, "provider_pending", false)] },
      { name: "get_account_active_transition", data: [transitionRow(true, "provider_pending", false)] },
      { name: "acquire_account_provider_work", data: [{ transition_id: TRANSITION_ID, target_profile_id: TARGET_ID, desired_active: true, attempt_number: 1, transition_status: "provider_in_progress" }] },
      { name: "record_account_provider_result", data: [transitionRow(true, "provider_failed", false)] },
      { name: "get_account_active_transition", data: [transitionRow(true, "provider_failed", false)] },
    );
    mocks.updateUserById.mockResolvedValue({ data: { user: providerUser }, error: null });

    await orchestrateAccountActiveTransition({ targetProfileId: TARGET_ID, desiredActive: true, idempotencyKey: KEY, actorId: ACTOR_ID });

    expect(mocks.rpc).toHaveBeenNthCalledWith(4, "record_account_provider_result", expect.objectContaining({ p_succeeded: false, p_error_code: "provider_response_unverified" }));
  });

  it("never claims completion when provider success cannot be recorded", async () => {
    rpcSequence(
      { name: "claim_account_active_transition", data: [transitionRow(false, "provider_pending", false)] },
      { name: "get_account_active_transition", data: [transitionRow(false, "provider_pending", false)] },
      { name: "acquire_account_provider_work", data: [{ transition_id: TRANSITION_ID, target_profile_id: TARGET_ID, desired_active: false, attempt_number: 1, transition_status: "provider_in_progress" }] },
      { name: "record_account_provider_result", error: { message: "db failed private@example.com" } },
      { name: "get_account_active_transition", data: [transitionRow(false, "provider_in_progress", false)] },
    );
    mocks.updateUserById.mockResolvedValue({ data: { user: { id: TARGET_ID, banned_until: "2126-01-01T00:00:00Z" } }, error: null });

    const result = await orchestrateAccountActiveTransition({ targetProfileId: TARGET_ID, desiredActive: false, idempotencyKey: KEY, actorId: ACTOR_ID });

    expect(result).toMatchObject({ outcome: "pending", providerState: "unknown", transitionStatus: "provider_in_progress" });
  });

  it("finalizes provider_applied without another provider call", async () => {
    rpcSequence(
      { name: "claim_account_active_transition", data: [transitionRow(true, "provider_applied", false, "unbanned")] },
      { name: "get_account_active_transition", data: [transitionRow(true, "provider_applied", false, "unbanned")] },
      { name: "finalize_account_active_transition", data: [transitionRow(true, "succeeded", true, "unbanned", false)] },
      { name: "get_account_active_transition", data: [transitionRow(true, "succeeded", true, "unbanned", false)] },
    );

    const result = await orchestrateAccountActiveTransition({ targetProfileId: TARGET_ID, desiredActive: true, idempotencyKey: KEY, actorId: ACTOR_ID });

    expect(result.outcome).toBe("completed");
    expect(mocks.updateUserById).not.toHaveBeenCalled();
  });

  it("uses the authoritative provider_applied snapshot when finalize fails", async () => {
    rpcSequence(
      { name: "claim_account_active_transition", data: [transitionRow(false, "provider_applied", false, "banned")] },
      { name: "get_account_active_transition", data: [transitionRow(false, "provider_applied", false, "banned")] },
      { name: "finalize_account_active_transition", error: { message: "private db text" } },
      { name: "get_account_active_transition", data: [transitionRow(false, "provider_applied", false, "banned")] },
    );

    const result = await orchestrateAccountActiveTransition({ targetProfileId: TARGET_ID, desiredActive: false, idempotencyKey: KEY, actorId: ACTOR_ID });

    expect(result).toMatchObject({ outcome: "pending", transitionStatus: "provider_applied", providerState: "banned", profileActive: false });
  });

  it("returns unknown active state when the authoritative snapshot cannot be read", async () => {
    rpcSequence(
      { name: "claim_account_active_transition", data: [transitionRow(false, "succeeded", false, "banned", false)] },
      { name: "get_account_active_transition", error: { message: "private db text" } },
    );

    const result = await orchestrateAccountActiveTransition({ targetProfileId: TARGET_ID, desiredActive: false, idempotencyKey: KEY, actorId: ACTOR_ID });

    expect(result).toMatchObject({ outcome: "error", profileActive: null, providerState: "unknown", transitionStatus: "unavailable" });
    expect(JSON.stringify(result)).not.toContain("private db text");
  });
});

describe("account active transition recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is dry-run by default and does not claim provider work", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [{ transition_id: TRANSITION_ID, transition_status: "provider_pending", updated_at: "2026-08-24T12:00:00Z" }],
      error: null,
    });

    const summary = await reconcileAccountActiveTransitions();

    expect(summary).toMatchObject({ apply: false, listed: 1, processed: 0, skipped: 1, errors: 0 });
    expect(summary.items).toEqual([{ transitionId: TRANSITION_ID, priorStatus: "provider_pending", outcome: "dry-run" }]);
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.updateUserById).not.toHaveBeenCalled();
  });

  it("finalizes provider_applied work without another Auth call", async () => {
    rpcSequence(
      { name: "list_recoverable_account_active_transitions", data: [{ transition_id: TRANSITION_ID, transition_status: "provider_applied", updated_at: "2026-08-24T12:00:00Z" }] },
      { name: "get_account_active_transition", data: [transitionRow(true, "provider_applied", false, "unbanned", false)] },
      { name: "finalize_account_active_transition", data: [transitionRow(true, "succeeded", true, "unbanned", false)] },
      { name: "get_account_active_transition", data: [transitionRow(true, "succeeded", true, "unbanned", false)] },
    );

    const summary = await reconcileAccountActiveTransitions({ apply: true, limit: 25 });

    expect(summary).toMatchObject({ apply: true, listed: 1, processed: 1, completed: 1, errors: 0 });
    expect(mocks.updateUserById).not.toHaveBeenCalled();
  });

  it("uses bounded exponential scheduling for provider_failed work", async () => {
    rpcSequence(
      { name: "list_recoverable_account_active_transitions", data: [{ transition_id: TRANSITION_ID, transition_status: "provider_failed", updated_at: "2026-08-24T12:00:00Z" }] },
      { name: "get_account_active_transition", data: [{ ...transitionRow(false, "provider_failed", false), attempt_count: 2 }] },
    );

    const summary = await reconcileAccountActiveTransitions({
      apply: true,
      limit: 999,
      now: new Date("2026-08-24T12:00:59Z"),
    });

    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "list_recoverable_account_active_transitions", { p_limit: 25 });
    expect(summary).toMatchObject({ processed: 0, skipped: 1, errors: 0 });
    expect(mocks.updateUserById).not.toHaveBeenCalled();
  });

  it("leaves threshold-exhausted work inactive for manual retry", async () => {
    rpcSequence(
      { name: "list_recoverable_account_active_transitions", data: [{ transition_id: TRANSITION_ID, transition_status: "provider_failed", updated_at: "2026-08-24T10:00:00Z" }] },
      { name: "get_account_active_transition", data: [{ ...transitionRow(false, "provider_failed", false), attempt_count: 5 }] },
    );

    const summary = await reconcileAccountActiveTransitions({
      apply: true,
      now: new Date("2026-08-24T12:00:00Z"),
    });

    expect(summary).toMatchObject({ processed: 0, skipped: 1, completed: 0 });
    expect(mocks.updateUserById).not.toHaveBeenCalled();
  });
});

describe("setUserActive server action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({
      user: { id: ACTOR_ID, email: null, name: "Owner", role: "owner" },
    });
  });

  it("requires an idempotency key in the public function signature", () => {
    expectTypeOf(setUserActive).parameters.toEqualTypeOf<[string, boolean, string]>();
    // @ts-expect-error the legacy two-argument call must not compile
    if (false) void setUserActive(TARGET_ID, true);
  });

  it("fails closed on malformed inputs and revalidates both security views", async () => {
    const result = await setUserActive("not-a-uuid", false, "bad-key");

    expect(result).toMatchObject({
      outcome: "error",
      transitionId: null,
      desiredActive: false,
      profileActive: null,
      providerState: "unknown",
      transitionStatus: "unavailable",
      retryable: false,
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.revalidatePath.mock.calls).toEqual([
      ["/settings/users"],
      ["/settings/security"],
    ]);
  });

  it("rejects denied permission before any admin RPC", async () => {
    mocks.requirePermission.mockResolvedValue({ error: "raw role details" });
    const result = await setUserActive(TARGET_ID, true, KEY);
    expect(result).toMatchObject({ outcome: "error", retryable: false, profileActive: null });
    expect(result.message).toBe("You do not have permission to manage users.");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects self-deactivation before any admin RPC", async () => {
    const result = await setUserActive(ACTOR_ID, false, KEY);
    expect(result).toMatchObject({ outcome: "error", retryable: false, profileActive: null });
    expect(result.message).toBe("You can't deactivate yourself.");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects a non-boolean desired state", async () => {
    const result = await setUserActive(TARGET_ID, "false" as never, KEY);
    expect(result).toMatchObject({ outcome: "error", retryable: false, profileActive: null });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("marks unexpected infrastructure uncertainty retryable without extending the result contract", async () => {
    mocks.requirePermission.mockRejectedValue(new Error("database unavailable"));

    const result = await setUserActive(TARGET_ID, true, KEY);

    expect(result).toMatchObject({ outcome: "error", retryable: true, transitionId: null });
    expect(result).not.toHaveProperty("error");
  });

  it("delegates a valid request with the authorized actor and revalidates both views", async () => {
    rpcSequence(
      { name: "claim_account_active_transition", data: [transitionRow(true, "provider_applied", false, "unbanned")] },
      { name: "get_account_active_transition", data: [transitionRow(true, "provider_applied", false, "unbanned")] },
      { name: "finalize_account_active_transition", data: [transitionRow(true, "succeeded", true, "unbanned", false)] },
      { name: "get_account_active_transition", data: [transitionRow(true, "succeeded", true, "unbanned", false)] },
    );
    const result = await setUserActive(TARGET_ID, true, KEY);
    expect(mocks.requirePermission).toHaveBeenCalledWith("users.manage");
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "claim_account_active_transition", {
      p_target_profile_id: TARGET_ID,
      p_desired_active: true,
      p_idempotency_key: KEY,
      p_actor_id: ACTOR_ID,
    });
    expect(result.outcome).toBe("completed");
    expect(mocks.revalidatePath.mock.calls).toEqual([
      ["/settings/users"],
      ["/settings/security"],
    ]);
  });

  it("preserves the authoritative result when either path revalidation throws", async () => {
    rpcSequence(
      { name: "claim_account_active_transition", data: [transitionRow(true, "succeeded", true, "unbanned", false)] },
      { name: "get_account_active_transition", data: [transitionRow(true, "succeeded", true, "unbanned", false)] },
    );
    mocks.revalidatePath.mockImplementationOnce(() => { throw new Error("users cache failed"); });

    const result = await setUserActive(TARGET_ID, true, KEY);

    expect(result).toMatchObject({ outcome: "completed", profileActive: true, providerState: "unbanned" });
    expect(mocks.revalidatePath).toHaveBeenNthCalledWith(2, "/settings/security");
  });
});
