"use client";

import { useActionState } from "react";
import { updateJobStatus } from "@/app/actions/jobs";
import { JOB_STATUSES } from "@/lib/constants";

export default function StatusSelector({
  jobId,
  currentStatus,
}: {
  jobId: string;
  currentStatus: string;
}) {
  const [, action, pending] = useActionState(updateJobStatus, undefined);

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="job_id" value={jobId} />
      <select
        name="status"
        defaultValue={currentStatus}
        onChange={(e) => e.target.form?.requestSubmit()}
        disabled={pending}
        className="px-4 py-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent capitalize disabled:opacity-50 cursor-pointer min-h-[44px]"
      >
        {JOB_STATUSES.map((s) => (
          <option key={s} value={s} className="capitalize">
            {s}
          </option>
        ))}
      </select>
      {pending && <span className="text-zinc-500 text-xs">Saving…</span>}
    </form>
  );
}
