"use client";

import { useState, useTransition } from "react";
import { dismissApproval, applySuggestion } from "@/app/actions/approvals";

export function DismissButton({
  approvalId,
  hasUnderlying,
}: {
  approvalId: string;
  hasUnderlying: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function dismiss(deleteUnderlying: boolean) {
    if (
      deleteUnderlying &&
      !confirm(
        "Delete the underlying draft too? This cannot be undone."
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await dismissApproval(approvalId, deleteUnderlying);
      if (!("ok" in res)) {
        setError(res.error);
        return;
      }
      window.location.reload();
    });
  }

  return (
    <div className="flex flex-col gap-1 items-end">
      <div className="flex gap-2">
        <button
          onClick={() => dismiss(false)}
          disabled={pending}
          className="text-zinc-500 hover:text-zinc-300 text-xs"
        >
          Dismiss
        </button>
        {hasUnderlying && (
          <>
            <span className="text-zinc-700 text-xs">·</span>
            <button
              onClick={() => dismiss(true)}
              disabled={pending}
              className="text-red-400 hover:text-red-300 text-xs"
            >
              Discard draft
            </button>
          </>
        )}
      </div>
      {error && <p className="text-red-400 text-[10px]">{error}</p>}
    </div>
  );
}

export function ApplySuggestionButton({ approvalId }: { approvalId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function apply() {
    setError(null);
    startTransition(async () => {
      const res = await applySuggestion(approvalId);
      if (!("ok" in res)) {
        setError(res.error);
        return;
      }
      window.location.reload();
    });
  }

  return (
    <div className="flex flex-col gap-1 items-end">
      <button
        onClick={apply}
        disabled={pending}
        className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded"
      >
        {pending ? "Applying…" : "Apply"}
      </button>
      {error && <p className="text-red-400 text-[10px]">{error}</p>}
    </div>
  );
}
