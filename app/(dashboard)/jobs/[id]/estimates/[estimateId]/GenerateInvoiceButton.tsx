"use client";

import { useTransition, useState } from "react";
import { createInvoiceFromEstimate } from "@/app/actions/invoices";

export default function GenerateInvoiceButton({
  estimateId,
  jobId,
}: {
  estimateId: string;
  jobId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    startTransition(async () => {
      const res = await createInvoiceFromEstimate(estimateId, jobId);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        onClick={onClick}
        disabled={pending}
        className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-ink text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {pending ? "Creating…" : "💰 Generate Invoice"}
      </button>
      {error && <p className="text-red-700 text-xs">{error}</p>}
    </div>
  );
}
