"use client";

import { useActionState, useEffect, useRef } from "react";
import { addJobNote } from "@/app/actions/jobs";

export default function AddNoteForm({ jobId }: { jobId: string }) {
  const [state, action, pending] = useActionState(addJobNote, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2">
      <input type="hidden" name="job_id" value={jobId} />
      <textarea
        name="content"
        rows={3}
        placeholder="Add a note…"
        className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm resize-none"
      />
      {state?.error && (
        <p className="text-red-400 text-xs">{state.error}</p>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-1.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
        >
          {pending ? "Adding…" : "Add Note"}
        </button>
      </div>
    </form>
  );
}
