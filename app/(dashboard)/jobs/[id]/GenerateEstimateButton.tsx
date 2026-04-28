"use client";

import { useState, useTransition } from "react";
import { generateEstimateForJob } from "@/app/actions/estimates";

export default function GenerateEstimateButton({
  jobId,
  hasScope,
}: {
  jobId: string;
  hasScope: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    startTransition(async () => {
      const res = await generateEstimateForJob(jobId);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        onClick={onClick}
        disabled={pending || !hasScope}
        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
        title={!hasScope ? "Run Argus scope analysis first" : undefined}
      >
        {pending ? (
          <>
            <Spinner /> Ledger is drafting…
          </>
        ) : (
          <>💰 Generate Estimate</>
        )}
      </button>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
