"use client";

import { useTransition, useState } from "react";
import { createInvoiceCheckout } from "@/app/actions/stripe-checkout";

export default function PayInvoiceButton({
  invoiceId,
  customerToken,
  amount,
}: {
  invoiceId: string;
  customerToken: string;
  amount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pay() {
    setError(null);
    startTransition(async () => {
      const res = await createInvoiceCheckout(invoiceId, customerToken);
      if (res.error || !res.url) {
        setError(res.error ?? "Could not start payment.");
        return;
      }
      window.location.href = res.url;
    });
  }

  return (
    <div>
      <button
        onClick={pay}
        disabled={pending}
        className="w-full px-4 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
      >
        {pending
          ? "Opening Stripe…"
          : `💳 Pay $${amount.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} Online`}
      </button>
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      <p className="text-zinc-500 text-[11px] mt-2 text-center">
        Secure payment via Stripe — we never see your card details.
      </p>
    </div>
  );
}
