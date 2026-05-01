"use client";

import { useState, useTransition } from "react";
import { exportQuickbooksCsv, type QbExportKind } from "@/app/actions/quickbooks";

const today = () => new Date().toISOString().split("T")[0];
const monthAgo = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().split("T")[0];
};

export default function QuickBooksExporter() {
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyKind, setBusyKind] = useState<QbExportKind | null>(null);

  function downloadCsv(filename: string, csv: string) {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportKind(kind: QbExportKind) {
    setError(null);
    setBusyKind(kind);
    startTransition(async () => {
      const res = await exportQuickbooksCsv(kind, from, to);
      setBusyKind(null);
      if (!("ok" in res)) {
        setError(res.error);
        return;
      }
      if (res.rowCount === 0) {
        setError(`No ${kind} found in that date range.`);
        return;
      }
      downloadCsv(res.filename, res.csv);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-zinc-400 text-xs">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-zinc-400 text-xs">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm"
          />
        </div>
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ExportCard
          title="Customers"
          description="One row per customer with name, contact, billing address."
          file="qbo-customers-*.csv"
          target="QBO → Add Customer → Import"
          busy={pending && busyKind === "customers"}
          onClick={() => exportKind("customers")}
        />
        <ExportCard
          title="Invoices"
          description="One row per line item — invoice #, customer, date, description, qty, amount."
          file="qbo-invoices-*.csv"
          target="QBO → Sales → Invoices → Import"
          busy={pending && busyKind === "invoices"}
          onClick={() => exportKind("invoices")}
        />
        <ExportCard
          title="Payments"
          description="One row per payment received — customer, invoice, date, amount, method, ref."
          file="qbo-payments-*.csv"
          target="QBO → Banking → Bank Deposit → Import"
          busy={pending && busyKind === "payments"}
          onClick={() => exportKind("payments")}
        />
      </div>
    </div>
  );
}

function ExportCard({
  title,
  description,
  file,
  target,
  busy,
  onClick,
}: {
  title: string;
  description: string;
  file: string;
  target: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4 flex flex-col">
      <p className="text-white font-semibold">{title}</p>
      <p className="text-zinc-400 text-xs mt-1 leading-snug">{description}</p>
      <p className="text-zinc-600 text-[10px] mt-3 font-mono">{file}</p>
      <p className="text-zinc-600 text-[10px] mt-0.5">→ {target}</p>
      <button
        onClick={onClick}
        disabled={busy}
        className="mt-3 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg"
      >
        {busy ? "Exporting…" : "⬇ Download CSV"}
      </button>
    </div>
  );
}
