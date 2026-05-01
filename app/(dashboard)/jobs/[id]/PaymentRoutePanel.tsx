"use client";

import { useActionState, useEffect, useState } from "react";
import { updatePaymentRoute } from "@/app/actions/jobs";
import {
  PAYMENT_ROUTES,
  PAYMENT_ROUTE_BY_VALUE,
  type PaymentRoute,
} from "@/lib/constants";

export default function PaymentRoutePanel({
  jobId,
  currentRoute,
  currentDeductible,
}: {
  jobId: string;
  currentRoute: PaymentRoute;
  currentDeductible: number | null;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updatePaymentRoute, undefined);
  const [route, setRoute] = useState<PaymentRoute>(currentRoute);

  const meta = PAYMENT_ROUTE_BY_VALUE[currentRoute];

  useEffect(() => {
    if (state?.ok) setEditing(false);
  }, [state]);

  if (!editing) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${meta.badge}`}
          >
            {meta.short}
          </span>
          {currentRoute === "insurance_with_deductible" && currentDeductible != null && (
            <span className="text-zinc-300 font-mono text-xs">
              ${Number(currentDeductible).toFixed(2)} deductible
            </span>
          )}
        </div>
        <p className="text-zinc-500 text-xs">{meta.description}</p>
        <button
          onClick={() => {
            setRoute(currentRoute);
            setEditing(true);
          }}
          className="self-start mt-1 text-blue-400 hover:text-blue-300 text-xs"
        >
          Change route →
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="job_id" value={jobId} />
      <div className="flex flex-col gap-2">
        {PAYMENT_ROUTES.map((r) => (
          <label
            key={r.value}
            className={`flex gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
              route === r.value
                ? "border-blue-500 bg-blue-500/5"
                : "border-zinc-700 hover:border-zinc-600"
            }`}
          >
            <input
              type="radio"
              name="payment_route"
              value={r.value}
              checked={route === r.value}
              onChange={() => setRoute(r.value)}
              className="mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium">{r.label}</p>
              <p className="text-zinc-500 text-[10px] mt-0.5 leading-tight">
                {r.description}
              </p>
            </div>
          </label>
        ))}
      </div>

      {route === "insurance_with_deductible" && (
        <div className="flex flex-col gap-1">
          <label className="text-zinc-400 text-xs">Deductible</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">
              $
            </span>
            <input
              name="deductible_amount"
              type="number"
              min="0"
              step="0.01"
              required
              defaultValue={currentDeductible ?? ""}
              className="w-full pl-7 pr-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="1000.00"
            />
          </div>
        </div>
      )}

      {state?.error && <p className="text-red-400 text-xs">{state.error}</p>}

      <div className="flex gap-2 mt-1">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="px-3 py-1.5 border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs rounded-lg"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
