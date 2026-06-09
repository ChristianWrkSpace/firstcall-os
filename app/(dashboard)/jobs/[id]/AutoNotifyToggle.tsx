"use client";

import { useState, useTransition } from "react";
import { setCustomerAutoNotify } from "@/app/actions/customers";

export default function AutoNotifyToggle({
  customerId,
  jobId,
  initial,
}: {
  customerId: string;
  jobId: string;
  initial: boolean;
}) {
  const [enabled, setEnabled] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !enabled;
    setError(null);
    setEnabled(next); // optimistic
    startTransition(async () => {
      const res = await setCustomerAutoNotify(customerId, jobId, next);
      if (!("ok" in res)) {
        setEnabled(!next); // rollback
        setError(res.error);
      }
    });
  }

  return (
    <div className="flex items-start gap-2 mt-3 pt-3 border-t border-edge2">
      <button
        onClick={toggle}
        disabled={pending}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${
          enabled ? "bg-cta" : "bg-shade"
        } disabled:opacity-50`}
        aria-pressed={enabled}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            enabled ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-ink text-xs font-medium">
          Auto-email on status change
        </p>
        <p className="text-ink-3 text-[10px] leading-snug mt-0.5">
          {enabled
            ? "Customer gets an email when this job hits Mitigation, Drying, or Completed."
            : "OFF — only manual sends will reach this customer."}
        </p>
        {error && <p className="text-red-700 text-[10px] mt-1">{error}</p>}
      </div>
    </div>
  );
}
