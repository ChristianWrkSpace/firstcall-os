"use client";

import { useState, useTransition } from "react";
import { markSecretRotated } from "@/app/actions/secrets-rotation";

export default function MarkRotatedDialog({
  secretName,
}: {
  secretName: string;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    if (
      !confirm(
        `Confirm: ${secretName} has been rotated in the vendor dashboard AND updated in Vercel env vars AND the app has been redeployed?`
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await markSecretRotated(secretName, notes);
      if (!("ok" in res)) {
        setError(res.error);
        return;
      }
      setOpen(false);
      setNotes("");
      window.location.reload();
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-blue-400 hover:text-blue-300 text-xs"
      >
        Mark rotated →
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 mt-2 bg-white/[0.03] border border-zinc-700 rounded-lg p-3">
      <label className="text-zinc-400 text-[10px] uppercase tracking-wide">
        Notes (optional)
      </label>
      <input
        type="text"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="e.g. quarterly rotation, after laptop reset"
        className="px-2 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-white text-xs"
      />
      {error && <p className="text-red-400 text-[10px]">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={pending}
          className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded"
        >
          {pending ? "Saving…" : "Confirm Rotated"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="px-3 py-1.5 border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs rounded"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
