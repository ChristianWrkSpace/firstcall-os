"use client";

import { useState, useTransition } from "react";
import {
  approveEstimate,
  markEstimateSent,
  rejectEstimate,
  deleteEstimate,
} from "@/app/actions/estimates";
import { exportEstimateAsXactimateCsv } from "@/app/actions/xactimate";

export default function EstimateActions({
  estimateId,
  jobId,
  status,
  total,
}: {
  estimateId: string;
  jobId: string;
  status: string;
  total: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showSendForm, setShowSendForm] = useState(false);
  const [sentTo, setSentTo] = useState("");

  function handleApprove() {
    if (
      !confirm(
        `Approve this estimate at $${total.toFixed(2)}? Once approved, line items become read-only.`
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await approveEstimate(estimateId, jobId);
      if (res.error) setError(res.error);
    });
  }

  function handleReject() {
    if (!confirm("Mark this estimate as rejected?")) return;
    setError(null);
    startTransition(async () => {
      const res = await rejectEstimate(estimateId, jobId);
      if (res.error) setError(res.error);
    });
  }

  function handleSend() {
    if (!sentTo.trim()) return setError("Enter who you sent it to.");
    setError(null);
    startTransition(async () => {
      const res = await markEstimateSent(estimateId, jobId, sentTo.trim());
      if (res.error) setError(res.error);
      else setShowSendForm(false);
    });
  }

  function handleDelete() {
    if (!confirm("Delete this estimate version? This cannot be undone.")) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteEstimate(estimateId, jobId);
      if (res?.error) setError(res.error);
    });
  }

  function handleXactimateExport() {
    setError(null);
    startTransition(async () => {
      const res = await exportEstimateAsXactimateCsv(estimateId);
      if (!("ok" in res)) {
        setError(res.error);
        return;
      }
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {status === "draft" && (
        <>
          <button
            onClick={handleApprove}
            disabled={pending}
            className="px-3 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            ✓ Approve Estimate
          </button>
          <button
            onClick={handleReject}
            disabled={pending}
            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 text-sm rounded-lg transition-colors"
          >
            Reject
          </button>
        </>
      )}

      {status === "approved" && !showSendForm && (
        <button
          onClick={() => setShowSendForm(true)}
          disabled={pending}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          ✉ Mark as Sent
        </button>
      )}

      {showSendForm && (
        <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-3 flex flex-col gap-2">
          <label className="text-zinc-400 text-xs uppercase tracking-wide">Sent to</label>
          <input
            type="text"
            value={sentTo}
            onChange={(e) => setSentTo(e.target.value)}
            placeholder="adjuster@statefarm.com"
            className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowSendForm(false)}
              className="px-3 py-1.5 text-zinc-400 hover:text-white text-xs"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={pending}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg"
            >
              {pending ? "Saving…" : "Mark Sent"}
            </button>
          </div>
        </div>
      )}

      {(status === "approved" || status === "sent") && (
        <a
          href={`/jobs/${jobId}/estimates/${estimateId}/print`}
          target="_blank"
          rel="noopener"
          className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-lg transition-colors text-center"
        >
          🖨 Print / Export
        </a>
      )}

      <button
        onClick={handleXactimateExport}
        disabled={pending}
        className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 text-sm rounded-lg transition-colors"
        title="CSV with Xactimate-style columns for adjuster review or manual re-key. Direct .esx import requires a Verisk vendor relationship."
      >
        📊 Xactimate CSV
      </button>


      {status !== "sent" && (
        <button
          onClick={handleDelete}
          disabled={pending}
          className="px-3 py-2 bg-zinc-800 hover:bg-red-600/20 text-red-400 text-sm rounded-lg transition-colors mt-2"
        >
          Delete Estimate
        </button>
      )}

      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  );
}
