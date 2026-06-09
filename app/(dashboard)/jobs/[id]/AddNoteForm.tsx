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
        className="w-full px-3 py-2 rounded-lg bg-shade border border-edge2 text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-cta focus:border-transparent text-sm resize-none"
      />
      {state?.error && (
        <p className="text-red-700 text-xs">{state.error}</p>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-1.5 bg-shade hover:bg-edge2 disabled:opacity-50 text-ink text-sm rounded-lg transition-colors"
        >
          {pending ? "Adding…" : "Add Note"}
        </button>
      </div>
    </form>
  );
}
