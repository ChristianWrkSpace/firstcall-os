"use client";

import { useTransition } from "react";
import { markSubInvoicePaid } from "@/app/actions/subs";

export default function MarkPaidButton({ invoiceId }: { invoiceId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => start(async () => { await markSubInvoicePaid(invoiceId); })}
      className="text-xs px-2.5 py-1 rounded-lg bg-shade hover:bg-edge2 text-ink-2 disabled:opacity-50"
    >
      {pending ? "…" : "Mark paid"}
    </button>
  );
}
