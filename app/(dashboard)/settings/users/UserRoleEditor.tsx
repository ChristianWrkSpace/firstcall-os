"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeUserRole, setUserActive } from "@/app/actions/users";
import type { AccountActiveTransitionResult } from "@/lib/account-active-transitions";
import { ALL_ROLES, ROLE_META, type Role } from "@/lib/permissions";

type ActiveRequest = {
  idempotencyKey: string;
  desiredActive: boolean;
  transitionId: string | null;
};

type RequestState = {
  hydrated: boolean;
  request: ActiveRequest | null;
};

export default function UserRoleEditor({
  profileId,
  currentRole,
  canEdit,
  isActive,
  initialTransition = null,
}: {
  profileId: string;
  currentRole: string;
  canEdit: boolean;
  isActive: boolean;
  initialTransition?: AccountActiveTransitionResult | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AccountActiveTransitionResult | null>(initialTransition);
  const [requestState, setRequestState] = useState<RequestState>({
    hydrated: false,
    request: null,
  });
  const priorAuthoritativeActive = useRef(isActive);
  const requestStorageKey = `firstcall:account-transition:${profileId}`;
  const activeRequest = requestState.request;

  function persistRequest(request: ActiveRequest | null) {
    if (request) sessionStorage.setItem(requestStorageKey, JSON.stringify(request));
    else sessionStorage.removeItem(requestStorageKey);
    setRequestState({ hydrated: true, request });
  }

  useEffect(() => {
    let request: ActiveRequest | null = null;
    try {
      const stored = sessionStorage.getItem(requestStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<ActiveRequest>;
        if (
          typeof parsed.idempotencyKey === "string" &&
          typeof parsed.desiredActive === "boolean" &&
          (typeof parsed.transitionId === "string" || parsed.transitionId === null)
        ) {
          request = parsed as ActiveRequest;
        }
      }
    } catch {
      sessionStorage.removeItem(requestStorageKey);
    }
    if (!request && initialTransition?.retryable && initialTransition.transitionId) {
      request = {
        idempotencyKey: crypto.randomUUID(),
        desiredActive: initialTransition.desiredActive,
        transitionId: initialTransition.transitionId,
      };
    }
    setRequestState({ hydrated: true, request });
  }, [requestStorageKey, initialTransition]);

  useEffect(() => {
    if (!requestState.hydrated) return;
    if (activeRequest) {
      sessionStorage.setItem(requestStorageKey, JSON.stringify(activeRequest));
    } else {
      sessionStorage.removeItem(requestStorageKey);
    }
  }, [activeRequest, requestState.hydrated, requestStorageKey]);

  useEffect(() => {
    if (!activeRequest && priorAuthoritativeActive.current !== isActive) {
      priorAuthoritativeActive.current = isActive;
      setResult(null);
      setError(null);
    }
  }, [isActive, activeRequest]);

  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const newRole = event.target.value as Role;
    if (newRole === currentRole) return;
    setError(null);
    startTransition(async () => {
      const response = await changeUserRole(profileId, newRole);
      if (response.error) setError(response.error);
    });
  }

  function toggleActive() {
    setError(null);
    const request = activeRequest ?? {
      idempotencyKey: crypto.randomUUID(),
      desiredActive: !isActive,
      transitionId: null,
    };
    persistRequest(request);

    startTransition(async () => {
      try {
        const response = await setUserActive(
          profileId,
          request.desiredActive,
          request.idempotencyKey
        );
        setResult(response);

        if (response.outcome === "completed") {
          persistRequest(null);
        } else if (response.retryable) {
          persistRequest({
            ...request,
            desiredActive: response.desiredActive,
            transitionId: response.transitionId ?? request.transitionId,
          });
          if (response.outcome === "conflict" || response.outcome === "error") setError(response.message);
        } else {
          persistRequest(null);
          setError(response.message);
        }
      } catch {
        persistRequest(request);
        setError("Application and Auth access could not be confirmed. Retry this account change.");
      } finally {
        router.refresh();
      }
    });
  }

  if (!canEdit) {
    return (
      <span className="capitalize text-ink-2">
        {ROLE_META[currentRole as Role]?.label ?? currentRole}
      </span>
    );
  }

  const displayedActive = result?.profileActive ?? isActive;
  const desiredActive = activeRequest?.desiredActive ?? !isActive;
  const hasOpenTransition =
    activeRequest !== null || result?.outcome === "pending" || result?.outcome === "conflict";
  const authLabel = !result
    ? "Not confirmed"
    : result.providerState === "banned"
      ? "Blocked"
      : result.providerState === "unbanned"
        ? "Unblocked"
        : result.providerState === "missing"
          ? "Missing"
          : "Not confirmed";
  const transitionLabel = !result
    ? activeRequest
      ? "Retry required"
      : "No transition"
    : result.outcome === "completed"
      ? "Complete"
      : result.outcome === "conflict"
        ? "Conflict — refresh required"
        : result.transitionStatus === "provider_failed"
          ? "Retry required"
          : result.outcome === "pending"
            ? "Pending"
            : "Unavailable";
  const buttonLabel = hasOpenTransition || activeRequest
    ? desiredActive
      ? "retry activation"
      : "retry deactivation"
    : isActive
      ? "deactivate"
      : "activate";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`role-${profileId}`}>
          User role
        </label>
        <select
          id={`role-${profileId}`}
          value={currentRole}
          onChange={onChange}
          disabled={pending || hasOpenTransition}
          className="px-2 py-1 rounded bg-shade border border-edge2 text-ink text-xs capitalize cursor-pointer disabled:opacity-50"
        >
          {ALL_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_META[role].label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={toggleActive}
          disabled={pending || (result?.outcome === "conflict" && !result.retryable)}
          aria-busy={pending}
          className="text-ink-3 hover:text-ink-2 text-[10px] disabled:opacity-50"
        >
          {pending ? "working…" : buttonLabel}
        </button>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-ink-3">
        <span>Application: {displayedActive ? "Active" : "Inactive"}</span>
        <span>Auth: {authLabel}</span>
        <span>Transition: {transitionLabel}</span>
      </div>
      {error && <span role="alert" className="text-red-700 text-[10px]">{error}</span>}
      {result && result.outcome !== "error" && result.outcome !== "conflict" && (
        <span role="status" aria-live="polite" className="text-ink-3 text-[10px]">
          {result.message}
        </span>
      )}
    </div>
  );
}
