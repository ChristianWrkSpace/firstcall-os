"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { dismissApproval, applySuggestion } from "@/app/actions/approvals";

export function DismissButton({
  approvalId,
  hasUnderlying,
}: {
  approvalId: string;
  hasUnderlying: boolean;
}) {
  const router = useRouter();
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
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1 items-end">
      <div className="flex gap-2">
        <button
          onClick={() => dismiss(false)}
          disabled={pending}
          className="text-ink-3 hover:text-ink-2 text-xs"
        >
          Dismiss
        </button>
        {hasUnderlying && (
          <>
            <span className="text-ink-3 text-xs">·</span>
            <button
              onClick={() => dismiss(true)}
              disabled={pending}
              className="text-red-700 hover:text-red-700 text-xs"
            >
              Discard draft
            </button>
          </>
        )}
      </div>
      {error && <p className="text-red-700 text-[10px]">{error}</p>}
    </div>
  );
}

export function ApplySuggestionButton({ approvalId }: { approvalId: string }) {
  const router = useRouter();
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
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1 items-end">
      <button
        onClick={apply}
        disabled={pending}
        className="px-3 py-1 bg-cta hover:bg-cta-deep disabled:opacity-50 text-white text-xs font-medium rounded"
      >
        {pending ? "Applying…" : "Apply"}
      </button>
      {error && <p className="text-red-700 text-[10px]">{error}</p>}
    </div>
  );
}
