"use client";

import { useState, useTransition } from "react";
import { searchCustomerForPii, deleteCustomerPii } from "@/app/actions/pii";

interface SearchHit {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export default function DeletionRequestForm({
  isOwner,
}: {
  isOwner: boolean;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [picked, setPicked] = useState<SearchHit | null>(null);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function search() {
    setError(null);
    setSuccess(null);
    setPicked(null);
    startTransition(async () => {
      const res = await searchCustomerForPii(query);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setHits(res.results);
    });
  }

  function performDelete() {
    if (!picked || !isOwner) return;
    if (
      !confirm(
        `IRREVERSIBLE: Redact PII for "${picked.name}"? Financial records will be kept for tax compliance, but all identifying fields will be replaced with [REDACTED]. This is logged.`
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await deleteCustomerPii(picked.id, reason);
      if (!("ok" in res)) {
        setError(res.error);
        return;
      }
      setSuccess(`✓ Redacted as ${res.redactionId}. Logged in audit trail.`);
      setPicked(null);
      setHits([]);
      setQuery("");
      setReason("");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Search by name, email, or phone…"
          className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm"
        />
        <button
          onClick={search}
          disabled={pending}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
        >
          {pending ? "..." : "Search"}
        </button>
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      {success && (
        <p className="text-green-400 text-sm bg-green-400/10 border border-green-400/20 rounded-lg px-3 py-2">
          {success}
        </p>
      )}

      {hits.length > 0 && (
        <div className="flex flex-col gap-1">
          {hits.map((h) => (
            <button
              key={h.id}
              onClick={() => setPicked(h)}
              className={`text-left px-3 py-2 rounded-lg border transition-colors ${
                picked?.id === h.id
                  ? "border-blue-500 bg-blue-500/5"
                  : "border-zinc-700 hover:border-zinc-600 bg-zinc-800/40"
              }`}
            >
              <p className="text-white text-sm font-medium">{h.name}</p>
              <p className="text-zinc-500 text-xs">
                {[h.email, h.phone].filter(Boolean).join(" · ") || "(no contact)"}
              </p>
            </button>
          ))}
        </div>
      )}

      {picked && (
        <div className="bg-zinc-800/40 border border-zinc-700 rounded-lg p-4 flex flex-col gap-3">
          <div>
            <p className="text-zinc-400 text-xs uppercase tracking-wide">
              Selected
            </p>
            <p className="text-white font-medium">{picked.name}</p>
          </div>

          {!isOwner && (
            <p className="text-amber-300 text-xs">
              Redaction is Owner-only. Manager can search but not delete.
            </p>
          )}

          {isOwner && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-zinc-400 text-xs">
                  Reason / ticket reference (logged)
                </label>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Customer email request 2026-04-30"
                  className="px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-white text-sm"
                />
              </div>
              <button
                onClick={performDelete}
                disabled={pending || !reason.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
              >
                {pending ? "Redacting…" : "🗑 Redact PII"}
              </button>
              <p className="text-zinc-500 text-[10px] leading-snug">
                Note: financial records (invoices, payments) are kept for tax
                compliance with all identifying fields blanked. Full row delete
                would break double-entry bookkeeping and IRS retention rules.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
