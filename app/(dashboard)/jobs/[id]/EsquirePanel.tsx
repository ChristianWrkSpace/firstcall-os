"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { generateLegalDoc } from "@/app/actions/esquire";
import {
  LEGAL_DOC_TYPES,
  LEGAL_STATUS_BADGE,
  type LegalDocType,
} from "@/lib/esquire-types";

type ExistingDoc = {
  id: string;
  doc_type: LegalDocType;
  subject: string | null;
  status: string;
  created_at: string;
  sent_at: string | null;
  signed_at: string | null;
};

type Invoice = {
  id: string;
  invoice_number: string;
  status: string;
};

export default function EsquirePanel({
  jobId,
  existingDocs,
  invoices,
}: {
  jobId: string;
  existingDocs: ExistingDoc[];
  invoices: Invoice[];
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [chosen, setChosen] = useState<LegalDocType | null>(null);
  const [invoiceId, setInvoiceId] = useState<string>("");
  const [disputeSummary, setDisputeSummary] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const overdueInvoices = invoices.filter(
    (i) => i.status === "sent" || i.status === "partial" || i.status === "overdue"
  );

  function handleGenerate() {
    if (!chosen) return;
    setError(null);
    startTransition(async () => {
      const res = await generateLegalDoc({
        jobId,
        docType: chosen,
        invoiceId: chosen === "demand_letter" ? invoiceId || undefined : undefined,
        disputeSummary:
          chosen === "notice_of_appraisal" ? disputeSummary : undefined,
      });
      if (res.error || !res.ok) {
        setError(res.error ?? "Generation failed.");
        return;
      }
      // Navigate to the new doc
      window.location.href = `/jobs/${jobId}/legal/${res.docId}`;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {existingDocs.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {existingDocs.map((d) => {
            const meta = LEGAL_DOC_TYPES.find((t) => t.value === d.doc_type);
            return (
              <li key={d.id}>
                <Link
                  href={`/jobs/${jobId}/legal/${d.id}`}
                  className="flex items-center justify-between gap-2 px-3 py-2 bg-white/[0.03] hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-zinc-200 text-xs font-medium truncate">
                      {meta?.short ?? d.doc_type}
                    </p>
                    <p className="text-zinc-500 text-[10px] truncate">
                      {new Date(d.created_at).toLocaleDateString()}
                      {d.sent_at && ` · sent`}
                      {d.signed_at && ` · signed`}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase ${LEGAL_STATUS_BADGE[d.status as keyof typeof LEGAL_STATUS_BADGE] ?? ""}`}
                  >
                    {d.status}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {!pickerOpen ? (
        <button
          onClick={() => setPickerOpen(true)}
          className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg"
        >
          ⚖️ Generate Legal Document
        </button>
      ) : (
        <div className="flex flex-col gap-2 bg-zinc-800/30 rounded-lg p-3">
          <p className="text-zinc-400 text-[10px] uppercase tracking-wide">
            Pick a template
          </p>
          {LEGAL_DOC_TYPES.map((t) => (
            <label
              key={t.value}
              className={`flex gap-2 px-2.5 py-2 rounded border cursor-pointer transition-colors ${
                chosen === t.value
                  ? "border-blue-500 bg-blue-500/5"
                  : "border-zinc-700 hover:border-zinc-600"
              }`}
            >
              <input
                type="radio"
                name="doc_type"
                checked={chosen === t.value}
                onChange={() => setChosen(t.value)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-medium">{t.short}</p>
                <p className="text-zinc-500 text-[10px] mt-0.5 leading-tight">
                  {t.whenToUse}
                </p>
              </div>
            </label>
          ))}

          {chosen === "demand_letter" && (
            <div className="flex flex-col gap-1 mt-1">
              <label className="text-zinc-400 text-[10px]">Overdue invoice</label>
              {overdueInvoices.length === 0 ? (
                <p className="text-amber-300 text-[10px]">
                  No sent/partial invoices on this job. Send an invoice first.
                </p>
              ) : (
                <select
                  value={invoiceId}
                  onChange={(e) => setInvoiceId(e.target.value)}
                  className="px-2 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-white text-xs"
                >
                  <option value="">Pick one…</option>
                  {overdueInvoices.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.invoice_number} · {i.status}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {chosen === "notice_of_appraisal" && (
            <div className="flex flex-col gap-1 mt-1">
              <label className="text-zinc-400 text-[10px]">
                Dispute summary (optional — what's the carrier's position?)
              </label>
              <textarea
                value={disputeSummary}
                onChange={(e) => setDisputeSummary(e.target.value)}
                rows={2}
                placeholder="Carrier offered $X; documented scope is $Y; gap is for…"
                className="px-2 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-white text-xs resize-none"
              />
            </div>
          )}

          {error && <p className="text-red-400 text-[10px]">{error}</p>}

          <div className="flex gap-2 mt-1">
            <button
              onClick={handleGenerate}
              disabled={
                pending ||
                !chosen ||
                (chosen === "demand_letter" && !invoiceId)
              }
              className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded"
            >
              {pending ? "Drafting…" : "Generate Draft"}
            </button>
            <button
              onClick={() => {
                setPickerOpen(false);
                setChosen(null);
                setError(null);
              }}
              className="px-3 py-1.5 border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
