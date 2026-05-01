"use client";

import { useState, useTransition } from "react";
import {
  assignToJob,
  retrieveFromJob,
  setStatus,
} from "@/app/actions/equipment";

interface ActiveJob {
  id: string;
  job_number: string;
  customer_name: string;
}

const INPUT =
  "w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm";

type Mode = null | "deploy" | "retrieve";

export default function StatusActions({
  equipmentId,
  status,
  activeJobs,
}: {
  equipmentId: string;
  status: string;
  activeJobs: ActiveJob[];
}) {
  const [mode, setMode] = useState<Mode>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [jobId, setJobId] = useState("");
  const [retrieveNotes, setRetrieveNotes] = useState("");

  function handleDeploy() {
    setError(null);
    if (!jobId) return setError("Pick a job.");
    startTransition(async () => {
      const res = await assignToJob(equipmentId, jobId);
      if (res.error) setError(res.error);
      else {
        setMode(null);
        setJobId("");
      }
    });
  }

  function handleRetrieve() {
    setError(null);
    startTransition(async () => {
      const res = await retrieveFromJob(equipmentId, null, retrieveNotes);
      if (res.error) setError(res.error);
      else {
        setMode(null);
        setRetrieveNotes("");
      }
    });
  }

  function handleSetStatus(newStatus: "available" | "maintenance" | "retired") {
    setError(null);
    if (
      newStatus === "retired" &&
      !confirm("Mark this equipment as retired? It won't appear for deployment.")
    )
      return;
    startTransition(async () => {
      const res = await setStatus(equipmentId, newStatus);
      if (res.error) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Deploy action — available only */}
      {status === "available" && mode !== "deploy" && (
        <button
          onClick={() => setMode("deploy")}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          🚚 Deploy to Job
        </button>
      )}

      {mode === "deploy" && (
        <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-3 flex flex-col gap-3">
          <p className="text-white text-sm font-semibold">Deploy to Job</p>
          <div className="flex flex-col gap-1">
            <label className="text-zinc-400 text-xs uppercase tracking-wide">Job</label>
            <select
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              className={INPUT}
            >
              <option value="">Select a job…</option>
              {activeJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.job_number} — {j.customer_name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setMode(null)}
              className="px-3 py-1.5 text-zinc-400 hover:text-white text-xs"
            >
              Cancel
            </button>
            <button
              onClick={handleDeploy}
              disabled={pending}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg"
            >
              {pending ? "Deploying…" : "Confirm Deploy"}
            </button>
          </div>
        </div>
      )}

      {/* Retrieve action — deployed only */}
      {status === "deployed" && mode !== "retrieve" && (
        <button
          onClick={() => setMode("retrieve")}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          📥 Retrieve from Job
        </button>
      )}

      {mode === "retrieve" && (
        <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-3 flex flex-col gap-3">
          <p className="text-white text-sm font-semibold">Retrieve from Job</p>
          <div className="flex flex-col gap-1">
            <label className="text-zinc-400 text-xs uppercase tracking-wide">
              Notes (optional)
            </label>
            <input
              type="text"
              value={retrieveNotes}
              onChange={(e) => setRetrieveNotes(e.target.value)}
              className={INPUT}
              placeholder="condition, repairs needed…"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setMode(null)}
              className="px-3 py-1.5 text-zinc-400 hover:text-white text-xs"
            >
              Cancel
            </button>
            <button
              onClick={handleRetrieve}
              disabled={pending}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg"
            >
              {pending ? "Retrieving…" : "Confirm Retrieve"}
            </button>
          </div>
        </div>
      )}

      {/* Status flips */}
      <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-zinc-800">
        {status !== "available" && status !== "deployed" && (
          <button
            onClick={() => handleSetStatus("available")}
            disabled={pending}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 text-xs rounded-lg"
          >
            Mark Available
          </button>
        )}
        {status !== "maintenance" && status !== "deployed" && (
          <button
            onClick={() => handleSetStatus("maintenance")}
            disabled={pending}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 text-xs rounded-lg"
          >
            🔧 Mark Maintenance
          </button>
        )}
        {status !== "retired" && status !== "deployed" && (
          <button
            onClick={() => handleSetStatus("retired")}
            disabled={pending}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-400 text-xs rounded-lg"
          >
            Mark Retired
          </button>
        )}
        {status === "deployed" && (
          <p className="text-zinc-500 text-xs italic">
            Retrieve from job before changing status.
          </p>
        )}
      </div>

      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  );
}
