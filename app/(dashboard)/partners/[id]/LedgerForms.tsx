"use client";

import { useState, useTransition } from "react";
import {
  logPartnerPayout,
  logPartnerInvestment,
  deletePartnerLedgerEntry,
} from "@/app/actions/partners";
import {
  INVESTMENT_CATEGORIES,
  PAYOUT_METHODS,
  type InvestmentCategory,
  type PayoutMethod,
} from "@/lib/partner-types";

const today = () => new Date().toISOString().split("T")[0];

export function PayoutForm({ partnerId }: { partnerId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PayoutMethod>("check");
  const [date, setDate] = useState(today());
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  function submit() {
    setError(null);
    const amt = Number(amount);
    if (!amt || amt <= 0) return setError("Enter a valid amount.");
    startTransition(async () => {
      const res = await logPartnerPayout(partnerId, {
        amount: amt,
        occurred_on: date,
        method,
        reference: reference || undefined,
        notes: notes || undefined,
      });
      if (!("ok" in res)) {
        setError(res.error);
        return;
      }
      setOpen(false);
      setAmount("");
      setReference("");
      setNotes("");
      window.location.reload();
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-lg"
      >
        + Log Cash Payout
      </button>
    );
  }
  return (
    <div className="bg-white/[0.03] border border-zinc-700 rounded-lg p-4 flex flex-col gap-2">
      <p className="text-zinc-300 text-xs font-medium">New cash payout (1099-tracked)</p>
      <div className="grid grid-cols-2 gap-2">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          type="number"
          min="0"
          step="0.01"
          placeholder="Amount $"
          className="px-2 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-white text-xs"
        />
        <input
          value={date}
          onChange={(e) => setDate(e.target.value)}
          type="date"
          className="px-2 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-white text-xs"
        />
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as PayoutMethod)}
          className="px-2 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-white text-xs"
        >
          {PAYOUT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Reference / check #"
          className="px-2 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-white text-xs"
        />
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes — which job, why, etc."
        rows={2}
        className="px-2 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-white text-xs resize-none"
      />
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={pending}
          className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded"
        >
          {pending ? "Saving…" : "Save Payout"}
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

export function InvestmentForm({ partnerId }: { partnerId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<InvestmentCategory>("meal");
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState("");

  function submit() {
    setError(null);
    const amt = Number(amount);
    if (Number.isNaN(amt) || amt < 0) return setError("Enter a valid amount.");
    startTransition(async () => {
      const res = await logPartnerInvestment(partnerId, {
        amount: amt,
        occurred_on: date,
        category,
        notes: notes || undefined,
      });
      if (!("ok" in res)) {
        setError(res.error);
        return;
      }
      setOpen(false);
      setAmount("");
      setNotes("");
      window.location.reload();
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-lg"
      >
        + Log Soft Investment
      </button>
    );
  }
  return (
    <div className="bg-white/[0.03] border border-zinc-700 rounded-lg p-4 flex flex-col gap-2">
      <p className="text-zinc-300 text-xs font-medium">New soft investment (relationship)</p>
      <div className="grid grid-cols-2 gap-2">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          type="number"
          min="0"
          step="0.01"
          placeholder="Amount $"
          className="px-2 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-white text-xs"
        />
        <input
          value={date}
          onChange={(e) => setDate(e.target.value)}
          type="date"
          className="px-2 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-white text-xs"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as InvestmentCategory)}
          className="col-span-2 px-2 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-white text-xs"
        >
          {INVESTMENT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="What was it (lunch at X, gift basket, holiday card box, etc.)"
        rows={2}
        className="px-2 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-white text-xs resize-none"
      />
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={pending}
          className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded"
        >
          {pending ? "Saving…" : "Save Investment"}
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

export function DeleteEntryButton({
  kind,
  entryId,
  partnerId,
}: {
  kind: "payout" | "investment";
  entryId: string;
  partnerId: string;
}) {
  const [pending, startTransition] = useTransition();
  function go() {
    if (!confirm(`Delete this ${kind}? This cannot be undone.`)) return;
    startTransition(async () => {
      await deletePartnerLedgerEntry(kind, entryId, partnerId);
      window.location.reload();
    });
  }
  return (
    <button
      onClick={go}
      disabled={pending}
      className="text-red-400 hover:text-red-300 text-xs disabled:opacity-50"
    >
      {pending ? "..." : "delete"}
    </button>
  );
}
