"use client";

import { useState, useTransition } from "react";
import {
  updateLineItem,
  deleteLineItem,
  addLineItem,
} from "@/app/actions/estimates";

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
  is_ai_drafted: boolean;
  pricing_source: "book" | "guessed" | null;
}

const UNITS = ["EA", "SF", "LF", "DA", "HR", "CY", "GAL"];
const CATEGORIES = [
  "Water Extraction",
  "Equipment Setup",
  "Daily Drying",
  "Demolition",
  "Cleaning & Antimicrobial",
  "Containment",
  "Other",
];

export default function LineItemsTable({
  estimateId,
  jobId,
  itemsByCategory,
  total,
  locked,
}: {
  estimateId: string;
  jobId: string;
  itemsByCategory: Record<string, LineItem[]>;
  total: number;
  locked: boolean;
}) {
  const [adding, setAdding] = useState(false);

  const categoryOrder = [
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
    <div>
      <table className="w-full text-sm">
        <thead className="bg-white/[0.03]">
          <tr className="text-zinc-500 text-xs uppercase tracking-wide">
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
              estimateId={estimateId}
              jobId={jobId}
              locked={locked}
            />
          ))}
          {/* Total row */}
          <tr className="border-t-2 border-zinc-700 bg-zinc-800/30">
            <td colSpan={5} className="px-4 py-3 text-right text-white font-semibold">
              Total
            </td>
            <td className="px-4 py-3 text-right text-white font-mono font-bold text-lg">
              ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
            {!locked && <td></td>}
          </tr>
        </tbody>
      </table>

      {!locked && (
        <div className="border-t border-zinc-800 px-4 py-3">
          {!adding ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="text-blue-400 hover:text-blue-300 text-xs font-medium"
            >
              + Add line item
            </button>
          ) : (
            <AddLineItemRow
              estimateId={estimateId}
              jobId={jobId}
              onClose={() => setAdding(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Category({
  name,
  items,
  estimateId,
  jobId,
  locked,
}: {
  name: string;
  items: LineItem[];
  estimateId: string;
  jobId: string;
  locked: boolean;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={locked ? 6 : 7}
          className="px-4 py-2 text-zinc-400 text-xs uppercase tracking-wide font-semibold bg-zinc-800/20"
        >
          {name}
        </td>
      </tr>
      {items.map((item) => (
        <LineRow
          key={item.id}
          item={item}
          estimateId={estimateId}
          jobId={jobId}
          locked={locked}
        />
      ))}
    </>
  );
}

function LineRow({
  item,
  estimateId,
  jobId,
  locked,
}: {
  item: LineItem;
  estimateId: string;
  jobId: string;
  locked: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  // Local edit state
  const [desc, setDesc] = useState(item.description);
  const [qty, setQty] = useState(item.quantity.toString());
  const [unit, setUnit] = useState(item.unit);
  const [price, setPrice] = useState(item.unit_price.toString());
  const [code, setCode] = useState(item.xactimate_code ?? "");

  function save() {
    startTransition(async () => {
      const res = await updateLineItem(
        item.id,
        {
          description: desc,
          quantity: Number(qty),
          unit,
          unit_price: Number(price),
          xactimate_code: code || undefined,
        },
        estimateId,
        jobId
      );
      if (!res.error) setEditing(false);
    });
  }

  function remove() {
    if (!confirm("Delete this line item?")) return;
    startTransition(async () => {
      await deleteLineItem(item.id, estimateId, jobId);
    });
  }

  if (editing) {
    return (
      <tr className="bg-blue-500/5">
        <td className="px-4 py-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={INPUT_INLINE}
            placeholder="WTR…"
          />
        </td>
        <td className="px-4 py-2">
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className={INPUT_INLINE}
          />
        </td>
        <td className="px-4 py-2">
          <input
            type="number"
            step="0.01"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className={`${INPUT_INLINE} text-right`}
          />
        </td>
        <td className="px-4 py-2">
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className={INPUT_INLINE}
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </td>
        <td className="px-4 py-2">
          <input
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={`${INPUT_INLINE} text-right`}
          />
        </td>
        <td className="px-4 py-2 text-right text-zinc-300 font-mono">
          ${(Number(qty) * Number(price)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
        <td className="px-2 py-2">
          <div className="flex flex-col gap-1">
            <button
              onClick={save}
              disabled={pending}
              className="text-green-400 hover:text-green-300 text-xs"
            >
              save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-zinc-500 hover:text-zinc-300 text-xs"
            >
              cancel
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-white/[0.06]/40 hover:bg-zinc-800/20 transition-colors group">
      <td className="px-4 py-2.5 text-zinc-400 text-xs font-mono">
        {item.xactimate_code ?? "—"}
      </td>
      <td className="px-4 py-2.5 text-zinc-200">
        {item.description}
        {item.notes && (
          <p className="text-zinc-500 text-xs italic mt-0.5">{item.notes}</p>
        )}
      </td>
      <td className="px-4 py-2.5 text-right text-zinc-300 font-mono text-xs">
        {Number(item.quantity).toFixed(2)}
      </td>
      <td className="px-4 py-2.5 text-zinc-400 text-xs uppercase">{item.unit}</td>
      <td className="px-4 py-2.5 text-right text-zinc-300 font-mono text-xs">
        <div className="flex items-center justify-end gap-1.5">
          <PricingSourceBadge source={item.pricing_source} />
          <span>${Number(item.unit_price).toFixed(2)}</span>
        </div>
      </td>
      <td className="px-4 py-2.5 text-right text-white font-mono text-xs font-semibold">
        ${Number(item.line_total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      {!locked && (
        <td className="px-2 py-2.5">
          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setEditing(true)}
              className="text-blue-400 hover:text-blue-300 text-xs"
            >
              edit
            </button>
            <button
              onClick={remove}
              disabled={pending}
              className="text-red-400 hover:text-red-300 text-xs"
            >
              del
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}

function AddLineItemRow({
  estimateId,
  jobId,
  onClose,
}: {
  estimateId: string;
  jobId: string;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await addLineItem(estimateId, jobId, formData);
      if (res.error) setError(res.error);
      else onClose();
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-2">
      <div className="grid grid-cols-12 gap-2">
        <select name="category" className={`${INPUT_INLINE} col-span-3`} defaultValue="Other">
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          name="xactimate_code"
          placeholder="Code"
          className={`${INPUT_INLINE} col-span-2`}
        />
        <input
          name="description"
          required
          placeholder="Description *"
          className={`${INPUT_INLINE} col-span-7`}
        />
        <input
          name="quantity"
          type="number"
          step="0.01"
          defaultValue="1"
          className={`${INPUT_INLINE} col-span-2 text-right`}
        />
        <select name="unit" defaultValue="EA" className={`${INPUT_INLINE} col-span-2`}>
          {UNITS.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
        <input
          name="unit_price"
          type="number"
          step="0.01"
          defaultValue="0"
          placeholder="0.00"
          className={`${INPUT_INLINE} col-span-3 text-right`}
        />
        <div className="col-span-5 flex justify-end items-center gap-2">
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xs">
            cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs rounded"
          >
            {pending ? "adding…" : "add"}
          </button>
        </div>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </form>
  );
}

const INPUT_INLINE =
  "w-full px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-600 text-xs";

// At-a-glance source of the unit_price. 'book' = anchored to reviewed price
// book → operator can scan past it. 'guessed' = LLM invented; needs review.
// null = human-authored line; trust the operator's own choice.
function PricingSourceBadge({ source }: { source: "book" | "guessed" | null }) {
  if (source === "book") {
    return (
      <span
        title="Anchored to reviewed price book"
        className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide bg-green-500/15 text-green-400 border border-green-500/20"
      >
        book
      </span>
    );
  }
  if (source === "guessed") {
    return (
      <span
        title="AI-invented price — code not in book. Verify before sending."
        className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide bg-yellow-500/15 text-yellow-400 border border-yellow-500/20"
      >
        guess
      </span>
    );
  }
  return null;
}
