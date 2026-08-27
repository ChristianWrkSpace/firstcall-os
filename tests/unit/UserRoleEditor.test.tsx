/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const KEY = "33333333-3333-4333-8333-333333333333";
const TRANSITION_ID = "44444444-4444-4444-8444-444444444444";

const mocks = vi.hoisted(() => ({
  setUserActive: vi.fn(),
  changeUserRole: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("@/app/actions/users", () => ({
  setUserActive: mocks.setUserActive,
  changeUserRole: mocks.changeUserRole,
}));

import UserRoleEditor from "@/app/(dashboard)/settings/users/UserRoleEditor";

function pendingResult() {
  return {
    outcome: "pending" as const,
    transitionId: TRANSITION_ID,
    desiredActive: false,
    profileActive: false,
    providerState: "unknown" as const,
    transitionStatus: "provider_failed" as const,
    retryable: true,
    message: "Application access is inactive; Auth sign-in blocking is not confirmed. Retry this transition.",
  };
}

describe("UserRoleEditor account transition state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(KEY);
    mocks.changeUserRole.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders application, Auth, and transition state independently", () => {
    render(
      <UserRoleEditor profileId={PROFILE_ID} currentRole="technician" canEdit isActive />
    );

    expect(screen.getByText("Application: Active")).toBeVisible();
    expect(screen.getByText("Auth: Not confirmed")).toBeVisible();
    expect(screen.getByText("Transition: No transition")).toBeVisible();
    expect(screen.getByRole("button", { name: "deactivate" })).toHaveAttribute(
      "aria-busy",
      "false"
    );
  });

  it("keeps the same deactivation identity and direction across a pending refresh/remount", async () => {
    mocks.setUserActive.mockResolvedValue(pendingResult());
    const first = render(
      <UserRoleEditor profileId={PROFILE_ID} currentRole="technician" canEdit isActive />
    );

    await userEvent.click(screen.getByRole("button", { name: "deactivate" }));

    await waitFor(() => {
      expect(mocks.setUserActive).toHaveBeenCalledWith(PROFILE_ID, false, KEY);
      expect(screen.getByText("Application: Inactive")).toBeVisible();
      expect(screen.getByText("Auth: Not confirmed")).toBeVisible();
      expect(screen.getByText("Transition: Retry required")).toBeVisible();
      expect(screen.getByRole("button", { name: "retry deactivation" })).toBeVisible();
    });
    expect(mocks.refresh).toHaveBeenCalled();
    expect(JSON.parse(sessionStorage.getItem(`firstcall:account-transition:${PROFILE_ID}`)!)).toEqual({
      idempotencyKey: KEY,
      desiredActive: false,
      transitionId: TRANSITION_ID,
    });

    first.unmount();
    mocks.setUserActive.mockClear();
    render(
      <UserRoleEditor profileId={PROFILE_ID} currentRole="technician" canEdit isActive={false} />
    );

    const retry = await screen.findByRole("button", { name: "retry deactivation" });
    await userEvent.click(retry);
    await waitFor(() =>
      expect(mocks.setUserActive).toHaveBeenCalledWith(PROFILE_ID, false, KEY)
    );
  });

  it("disables the opposite control and announces conflicts assertively", async () => {
    mocks.setUserActive.mockResolvedValue({
      outcome: "conflict",
      transitionId: null,
      desiredActive: false,
      profileActive: null,
      providerState: "unknown",
      transitionStatus: "unavailable",
      retryable: false,
      message: "Another account transition is in progress. Refresh and retry that transition.",
    });
    render(
      <UserRoleEditor profileId={PROFILE_ID} currentRole="technician" canEdit isActive />
    );

    await userEvent.click(screen.getByRole("button", { name: "deactivate" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Another account transition is in progress");
    expect(screen.getByText("Transition: Conflict — refresh required")).toBeVisible();
    expect(screen.getByRole("button", { name: "retry deactivation" })).toBeDisabled();
  });

  it("keeps partial activation visibly inactive and never optimistically flips requested state", async () => {
    let resolveAction!: (value: ReturnType<typeof pendingResult>) => void;
    mocks.setUserActive.mockReturnValue(new Promise((resolve) => { resolveAction = resolve; }));
    render(
      <UserRoleEditor profileId={PROFILE_ID} currentRole="technician" canEdit isActive={false} />
    );

    await userEvent.click(screen.getByRole("button", { name: "activate" }));
    expect(screen.getByText("Application: Inactive")).toBeVisible();

    resolveAction({ ...pendingResult(), desiredActive: true });
    await waitFor(() => {
      expect(screen.getByText("Application: Inactive")).toBeVisible();
      expect(screen.getByText("Auth: Not confirmed")).toBeVisible();
      expect(screen.getByRole("button", { name: "retry activation" })).toBeVisible();
    });
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("refreshes and retains a retryable request when the action throws", async () => {
    mocks.setUserActive.mockRejectedValue(new Error("private transport detail"));
    render(
      <UserRoleEditor profileId={PROFILE_ID} currentRole="technician" canEdit isActive />
    );

    await userEvent.click(screen.getByRole("button", { name: "deactivate" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("could not be confirmed");
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(JSON.parse(sessionStorage.getItem(`firstcall:account-transition:${PROFILE_ID}`)!)).toEqual({
      idempotencyKey: KEY,
      desiredActive: false,
      transitionId: null,
    });
  });

  it("hydrates retry state from the authoritative server transition", async () => {
    render(
      <UserRoleEditor
        profileId={PROFILE_ID}
        currentRole="technician"
        canEdit
        isActive={false}
        initialTransition={{ ...pendingResult(), desiredActive: true }}
      />
    );

    expect(await screen.findByRole("button", { name: "retry activation" })).toBeVisible();
    expect(screen.getByText("Application: Inactive")).toBeVisible();
    await waitFor(() => {
      expect(JSON.parse(sessionStorage.getItem(`firstcall:account-transition:${PROFILE_ID}`)!)).toEqual({
        idempotencyKey: KEY,
        desiredActive: true,
        transitionId: TRANSITION_ID,
      });
    });
  });

  it("adopts and persists a canonical conflicting transition", async () => {
    mocks.setUserActive.mockResolvedValue({
      outcome: "conflict",
      transitionId: TRANSITION_ID,
      desiredActive: false,
      profileActive: false,
      providerState: "unknown",
      transitionStatus: "provider_failed",
      retryable: true,
      message: "Another account transition is in progress. The authoritative transition was adopted; retry it safely.",
    });
    render(
      <UserRoleEditor profileId={PROFILE_ID} currentRole="technician" canEdit isActive={false} />
    );

    await userEvent.click(screen.getByRole("button", { name: "activate" }));

    expect(await screen.findByRole("button", { name: "retry deactivation" })).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("authoritative transition was adopted");
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(JSON.parse(sessionStorage.getItem(`firstcall:account-transition:${PROFILE_ID}`)!)).toEqual({
      idempotencyKey: KEY,
      desiredActive: false,
      transitionId: TRANSITION_ID,
    });
  });

  it("clears the persisted request only after authoritative completion", async () => {
    mocks.setUserActive.mockResolvedValue({
      outcome: "completed",
      transitionId: TRANSITION_ID,
      desiredActive: false,
      profileActive: false,
      providerState: "banned",
      transitionStatus: "succeeded",
      retryable: false,
      message: "Application access is inactive; Auth sign-in is blocked.",
    });
    render(
      <UserRoleEditor profileId={PROFILE_ID} currentRole="technician" canEdit isActive />
    );

    await userEvent.click(screen.getByRole("button", { name: "deactivate" }));

    const status = await screen.findByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Auth sign-in is blocked");
    await waitFor(() =>
      expect(sessionStorage.getItem(`firstcall:account-transition:${PROFILE_ID}`)).toBeNull()
    );
  });
});
