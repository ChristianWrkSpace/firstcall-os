"use client";

import { useState, useTransition } from "react";
import { createInvoiceFromManualAmount } from "@/app/actions/invoices";

export default function CreateManualInvoiceButton({ jobId }: { jobId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function createInvoice() {
    setError(null);
    startTransition(async () => {
      const result = await createInvoiceFromManualAmount(jobId);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={createInvoice}
        disabled={pending}
        className="rounded-lg border border-cta px-4 py-2 text-sm font-semibold text-cta hover:bg-cta/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Creating invoice…" : "Create draft invoice"}
      </button>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
