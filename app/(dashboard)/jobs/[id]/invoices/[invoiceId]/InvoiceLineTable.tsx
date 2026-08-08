"use client";

import { useState, useTransition } from "react";
import {
  updateInvoiceLine,
  deleteInvoiceLine,
  addInvoiceLine,
} from "@/app/actions/invoices";

interface LineItem {
  id: string;
  sort_order: number;
  category: string | null;
  xactimate_code: string | null;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
  notes: string | null;
}

const UNITS = ["EA", "SF", "LF", "DA", "HR", "CY", "GAL"];
const CATEGORIES = [
  "Services",
  "Water Extraction",
  "Equipment Setup",
  "Daily Drying",
  "Demolition",
  "Cleaning & Antimicrobial",
  "Containment",
  "Other",
];

export default function InvoiceLineTable({
  invoiceId,
  jobId,
  itemsByCategory,
  total,
  locked,
}: {
  invoiceId: string;
  jobId: string;
  itemsByCategory: Record<string, LineItem[]>;
  total: number;
  locked: boolean;
}) {
  const [adding, setAdding] = useState(false);

  const categoryOrder = [
    "Services",
    "Water Extraction",
    "Equipment Setup",
    "Daily Drying",
    "Demolition",
    "Cleaning & Antimicrobial",
    "Containment",
    "Other",
  ];
  const categories = categoryOrder.filter((c) => itemsByCategory[c]?.length > 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[52rem] text-sm">
        <thead className="bg-tint">
          <tr className="text-ink-3 text-xs uppercase tracking-wide">
            <th className="px-4 py-2 text-left">Code</th>
            <th className="px-4 py-2 text-left">Description</th>
            <th className="px-4 py-2 text-right w-20">Qty</th>
            <th className="px-4 py-2 text-left w-16">Unit</th>
            <th className="px-4 py-2 text-right w-28">Unit Price</th>
            <th className="px-4 py-2 text-right w-32">Line Total</th>
            {!locked && <th className="px-2 py-2 w-8"></th>}
          </tr>
        </thead>
        <tbody>
          {categories.map((cat) => (
            <Category
              key={cat}
              name={cat}
              items={itemsByCategory[cat]}
              invoiceId={invoiceId}
              jobId={jobId}
              locked={locked}
            />
          ))}
          <tr className="border-t-2 border-edge2 bg-shade">
            <td colSpan={5} className="px-4 py-3 text-right text-ink font-semibold">
              Total
            </td>
            <td className="px-4 py-3 text-right text-ink font-mono font-bold text-lg">
              ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
            {!locked && <td></td>}
          </tr>
        </tbody>
      </table>

      {!locked && (
        <div className="border-t border-edge2 px-4 py-3">
          {!adding ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="text-info hover:text-info-deep text-xs font-medium"
            >
              + Add line item
            </button>
          ) : (
            <AddLineRow
              invoiceId={invoiceId}
              jobId={jobId}
              onClose={() => setAdding(false)}
            />
          )}
        </div>
      )}

      {locked && (
        <div className="border-t border-edge2 px-4 py-3 text-ink-3 text-xs italic">
          Invoice is no longer in draft — line items locked.
        </div>
      )}
    </div>
  );
}

function Category({
  name,
  items,
  invoiceId,
  jobId,
  locked,
}: {
  name: string;
  items: LineItem[];
  invoiceId: string;
  jobId: string;
  locked: boolean;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={locked ? 6 : 7}
          className="px-4 py-2 text-ink-2 text-xs uppercase tracking-wide font-semibold bg-shade"
        >
          {name}
        </td>
      </tr>
      {items.map((item) => (
        <Row
          key={item.id}
          item={item}
          invoiceId={invoiceId}
          jobId={jobId}
          locked={locked}
        />
      ))}
    </>
  );
}

function Row({
  item,
  invoiceId,
  jobId,
  locked,
}: {
  item: LineItem;
  invoiceId: string;
  jobId: string;
  locked: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const [desc, setDesc] = useState(item.description);
  const [qty, setQty] = useState(item.quantity.toString());
  const [unit, setUnit] = useState(item.unit);
  const [price, setPrice] = useState(item.unit_price.toString());
  const [code, setCode] = useState(item.xactimate_code ?? "");

  function save() {
    startTransition(async () => {
      const res = await updateInvoiceLine(
        item.id,
        {
          description: desc,
          quantity: Number(qty),
          unit,
          unit_price: Number(price),
          xactimate_code: code || undefined,
        },
        invoiceId,
        jobId
      );
      if (!res.error) setEditing(false);
    });
  }

  function remove() {
    if (!confirm("Delete this line item?")) return;
    startTransition(async () => {
      await deleteInvoiceLine(item.id, invoiceId, jobId);
    });
  }

  if (editing) {
    return (
      <tr className="bg-blue-500/5">
        <td className="px-4 py-2"><input value={code} onChange={(e) => setCode(e.target.value)} className={INPUT} placeholder="WTR…" /></td>
        <td className="px-4 py-2"><input value={desc} onChange={(e) => setDesc(e.target.value)} className={INPUT} /></td>
        <td className="px-4 py-2"><input type="number" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} className={`${INPUT} text-right`} /></td>
        <td className="px-4 py-2"><select value={unit} onChange={(e) => setUnit(e.target.value)} className={INPUT}>{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select></td>
        <td className="px-4 py-2"><input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={`${INPUT} text-right`} /></td>
        <td className="px-4 py-2 text-right text-ink-2 font-mono">${(Number(qty) * Number(price)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td className="px-2 py-2">
          <div className="flex flex-col gap-1">
            <button onClick={save} disabled={pending} className="text-pine hover:text-pine text-xs">save</button>
            <button onClick={() => setEditing(false)} className="text-ink-3 hover:text-ink-2 text-xs">cancel</button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-edge2/40 hover:bg-shade/20 transition-colors group">
      <td className="px-4 py-2.5 text-ink-2 text-xs font-mono">{item.xactimate_code ?? "—"}</td>
      <td className="px-4 py-2.5 text-ink">
        {item.description}
        {item.notes && <p className="text-ink-3 text-xs italic mt-0.5">{item.notes}</p>}
      </td>
      <td className="px-4 py-2.5 text-right text-ink-2 font-mono text-xs">{Number(item.quantity).toFixed(2)}</td>
      <td className="px-4 py-2.5 text-ink-2 text-xs uppercase">{item.unit}</td>
      <td className="px-4 py-2.5 text-right text-ink-2 font-mono text-xs">${Number(item.unit_price).toFixed(2)}</td>
      <td className="px-4 py-2.5 text-right text-ink font-mono text-xs font-semibold">${Number(item.line_total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      {!locked && (
        <td className="px-2 py-2.5">
          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setEditing(true)} className="text-info hover:text-info-deep text-xs">edit</button>
            <button onClick={remove} disabled={pending} className="text-red-700 hover:text-red-700 text-xs">del</button>
          </div>
        </td>
      )}
    </tr>
  );
}

function AddLineRow({
  invoiceId,
  jobId,
  onClose,
}: {
  invoiceId: string;
  jobId: string;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await addInvoiceLine(invoiceId, jobId, formData);
      if (res.error) setError(res.error);
      else onClose();
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-2">
      <div className="grid grid-cols-12 gap-2">
        <select name="category" className={`${INPUT} col-span-3`} defaultValue="Other">
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input name="xactimate_code" placeholder="Code" className={`${INPUT} col-span-2`} />
        <input name="description" required placeholder="Description *" className={`${INPUT} col-span-7`} />
        <input name="quantity" type="number" step="0.01" defaultValue="1" className={`${INPUT} col-span-2 text-right`} />
        <select name="unit" defaultValue="EA" className={`${INPUT} col-span-2`}>
          {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <input name="unit_price" type="number" step="0.01" defaultValue="0" placeholder="0.00" className={`${INPUT} col-span-3 text-right`} />
        <div className="col-span-5 flex justify-end items-center gap-2">
          <button type="button" onClick={onClose} className="text-ink-3 hover:text-ink-2 text-xs">cancel</button>
          <button type="submit" disabled={pending} className="px-3 py-1 bg-cta hover:bg-cta-deep disabled:opacity-50 text-white text-xs rounded">{pending ? "adding…" : "add"}</button>
        </div>
      </div>
      {error && <p className="text-red-700 text-xs">{error}</p>}
    </form>
  );
}

const INPUT = "w-full px-2 py-1 rounded bg-shade border border-edge2 text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-cta text-xs";
