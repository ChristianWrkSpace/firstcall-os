"use client";

import { useState, useTransition } from "react";
import { runSolomonReport } from "@/app/actions/solomon";

export default function RunAnalysisButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState(90);

  function run() {
    setError(null);
    startTransition(async () => {
      const res = await runSolomonReport(windowDays);
      if (res.error || !res.ok) {
        setError(res.error ?? "Analysis failed.");
        return;
      }
      // Reload to surface the new report
      window.location.reload();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 items-center">
        <label className="text-zinc-400 text-xs">Window</label>
        <select
          value={windowDays}
          onChange={(e) => setWindowDays(Number(e.target.value))}
          disabled={pending}
          className="px-2 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-white text-xs"
        >
          <option value={30}>Last 30 days</option>
          <option value={60}>Last 60 days</option>
          <option value={90}>Last 90 days</option>
          <option value={180}>Last 6 months</option>
          <option value={365}>Last year</option>
        </select>
        <button
          onClick={run}
          disabled={pending}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg"
        >
          {pending ? "Analyzing… (~30s)" : "🧠 Run Analysis"}
        </button>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
