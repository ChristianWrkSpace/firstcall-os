"use client";

import { useEffect, useRef } from "react";
import { useToast } from "./Toast";

/**
 * Bridge useActionState → toast. Pass the action state and a success label;
 * the hook fires success/error toasts when the state changes. De-duped via
 * a ref so re-renders don't double-fire.
 *
 * Usage:
 *   const [state, action, pending] = useActionState(myAction, undefined);
 *   useToastForState(state, "Saved");
 */
export function useToastForState(
  state: { ok?: boolean; error?: string } | undefined,
  successMessage: string
) {
  const toast = useToast();
  const lastSeen = useRef<unknown>(null);

  useEffect(() => {
    if (!state || state === lastSeen.current) return;
    lastSeen.current = state;
    if (state.ok) toast.success(successMessage);
    else if (state.error) toast.error(state.error);
  }, [state, successMessage, toast]);
}
