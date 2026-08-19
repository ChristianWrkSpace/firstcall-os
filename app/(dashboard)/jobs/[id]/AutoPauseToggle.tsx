"use client";

import { useState, useTransition } from "react";
import { setJobAutoPaused } from "@/app/actions/approvals";

export default function AutoPauseToggle({
  jobId,
  initial,
  isTest,
}: {
  jobId: string;
  initial: boolean;
  isTest: boolean;
}) {
  const [paused, setPaused] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !paused;
    if (next && !confirm("Pause auto-actions on this job? Agents will stop drafting documents, demand letters, and status changes for this job until you unpause.")) {
      return;
    }
    setError(null);
    setPaused(next);
    startTransition(async () => {
      const res = await setJobAutoPaused(jobId, next);
      if (!("ok" in res)) {
        setPaused(!next);
        setError(res.error);
      }
    });
  }

  return (
    <div className="flex items-start gap-2">
      <button
        onClick={toggle}
        disabled={pending || isTest}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${
          paused ? "bg-amber-500" : "bg-shade"
        } disabled:opacity-50`}
        aria-pressed={paused}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            paused ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium ${paused ? "text-honey" : "text-ink-2"}`}>
          {isTest ? "Test job — automation locked off" : paused ? "Auto-actions PAUSED" : "Auto-actions enabled"}
        </p>
        <p className="text-ink-3 text-[10px] leading-snug mt-0.5">
          {isTest
            ? "Test jobs cannot send automated emails or create automated drafts."
            : paused
            ? "Litigated / sensitive case — agents won't draft anything for this job."
            : "Agents may draft legal documents and suggest status changes as conditions are met."}
        </p>
        {error && <p className="text-red-700 text-[10px] mt-1">{error}</p>}
      </div>
    </div>
  );
}
