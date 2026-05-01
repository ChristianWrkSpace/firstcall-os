"use client";

import { useActionState } from "react";
import { logExpense } from "@/app/actions/expenses";

const INPUT =
  "px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm";

const CATEGORIES = [
  { v: "fuel", label: "⛽ Fuel" },
  { v: "maintenance", label: "🔧 Maintenance" },
  { v: "insurance", label: "🛡 Insurance" },
  { v: "lease", label: "📄 Lease / Loan" },
  { v: "registration", label: "📋 Registration" },
  { v: "tolls", label: "🛣 Tolls" },
  { v: "parking", label: "🅿 Parking" },
  { v: "other", label: "📦 Other" },
];

export default function ExpenseForm() {
  const [state, action, pending] = useActionState(logExpense, undefined);

  return (
    <form action={action} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
      <div className="flex flex-col gap-1.5">
        <label className="text-zinc-400 text-xs uppercase tracking-wide">Date</label>
        <input
          name="expense_date"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          required
          className={INPUT}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-zinc-400 text-xs uppercase tracking-wide">Category</label>
        <select name="category" required defaultValue="fuel" className={INPUT}>
          {CATEGORIES.map((c) => (
            <option key={c.v} value={c.v}>{c.label}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-zinc-400 text-xs uppercase tracking-wide">Amount</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            required
            className={`${INPUT} pl-7 w-full`}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-zinc-400 text-xs uppercase tracking-wide">Vehicle (opt)</label>
        <input
          name="vehicle_id"
          type="text"
          placeholder="Van 1, Truck"
          className={INPUT}
        />
      </div>
      <div className="flex flex-col gap-1.5 md:col-span-1">
        <label className="text-zinc-400 text-xs uppercase tracking-wide">Notes</label>
        <input
          name="notes"
          type="text"
          placeholder="Shell on Manchaca"
          className={INPUT}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
      >
        {pending ? "Saving…" : "Add"}
      </button>
      {state?.error && (
        <p className="md:col-span-6 text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded px-2 py-1">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="md:col-span-6 text-green-400 text-xs">✓ Logged.</p>
      )}
    </form>
  );
}
