"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  logTechLabor,
  logConsumable,
  deleteTechLabor,
  deleteConsumable,
} from "@/app/actions/job-costs";

const INPUT =
  "px-2.5 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-600 text-xs";

interface Tech {
  id: string;
  name: string;
}

interface LaborEntry {
  id: string;
  work_date: string;
  hours: number;
  hourly_rate: number;
  profile_id: string | null;
  profiles?: { name: string } | null;
}

interface ConsumableEntry {
  id: string;
  item: string;
  quantity: number;
  unit_cost: number;
}

const fmt = (n: number) => `$${n.toFixed(2)}`;

export default function JobCostEntries({
  jobId,
  defaultHourlyRate,
  techs,
  laborEntries,
  consumableEntries,
}: {
  jobId: string;
  defaultHourlyRate: number;
  techs: Tech[];
  laborEntries: LaborEntry[];
  consumableEntries: ConsumableEntry[];
}) {
  const laborTotal = laborEntries.reduce(
    (s, e) => s + Number(e.hours) * Number(e.hourly_rate),
    0
  );
  const consumablesTotal = consumableEntries.reduce(
    (s, e) => s + Number(e.quantity) * Number(e.unit_cost),
    0
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <LaborSection
        jobId={jobId}
        defaultHourlyRate={defaultHourlyRate}
        techs={techs}
        entries={laborEntries}
        total={laborTotal}
      />
      <ConsumablesSection
        jobId={jobId}
        entries={consumableEntries}
        total={consumablesTotal}
      />
    </div>
  );
}

function LaborSection({
  jobId,
  defaultHourlyRate,
  techs,
  entries,
  total,
}: {
  jobId: string;
  defaultHourlyRate: number;
  techs: Tech[];
  entries: LaborEntry[];
  total: number;
}) {
  const [state, action, pending] = useActionState(logTechLabor, undefined);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pendingDelete, startDelete] = useTransition();

  function onDelete(id: string) {
    if (!confirm("Delete this labor entry?")) return;
    startDelete(async () => {
      await deleteTechLabor(id, jobId);
      router.refresh();
    });
  }

  return (
    <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div>
          <p className="text-white text-sm font-semibold">👷 Tech Labor</p>
          <p className="text-zinc-500 text-[10px]">{entries.length} entries · {fmt(total)} total</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-blue-400 hover:text-blue-300 text-xs"
        >
          {open ? "× Cancel" : "+ Log hours"}
        </button>
      </div>

      {open && (
        <form action={action} className="flex flex-wrap gap-1.5 mb-3 items-end">
          <input type="hidden" name="job_id" value={jobId} />
          <select
            name="profile_id"
            className={`${INPUT} flex-1 min-w-[120px]`}
            defaultValue={techs[0]?.id ?? ""}
          >
            {techs.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <input
            name="hours"
            type="number"
            step="0.25"
            min="0.25"
            placeholder="hrs"
            required
            className={`${INPUT} w-16`}
          />
          <input
            name="hourly_rate"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaultHourlyRate}
            className={`${INPUT} w-20`}
          />
          <input
            name="work_date"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className={`${INPUT} w-32`}
          />
          <button
            type="submit"
            disabled={pending}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded-md"
          >
            {pending ? "…" : "Add"}
          </button>
          {state?.error && (
            <p className="text-red-400 text-[11px] basis-full">{state.error}</p>
          )}
        </form>
      )}

      {entries.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {entries.map((e) => {
            const cost = Number(e.hours) * Number(e.hourly_rate);
            return (
              <li
                key={e.id}
                className="flex items-center justify-between gap-2 text-xs px-2 py-1 rounded hover:bg-zinc-800"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-zinc-300">
                    {e.profiles?.name ?? "Tech"}
                  </span>
                  <span className="text-zinc-500"> · {e.work_date}</span>
                </div>
                <span className="text-zinc-400 font-mono">
                  {Number(e.hours).toFixed(2)}h × ${Number(e.hourly_rate).toFixed(2)}
                </span>
                <span className="text-white font-mono w-16 text-right">
                  {fmt(cost)}
                </span>
                <button
                  type="button"
                  onClick={() => onDelete(e.id)}
                  disabled={pendingDelete}
                  className="text-zinc-500 hover:text-red-400 text-xs disabled:opacity-50"
                  aria-label="Delete entry"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-zinc-500 text-xs italic">No labor logged yet.</p>
      )}
    </div>
  );
}

function ConsumablesSection({
  jobId,
  entries,
  total,
}: {
  jobId: string;
  entries: ConsumableEntry[];
  total: number;
}) {
  const [state, action, pending] = useActionState(logConsumable, undefined);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pendingDelete, startDelete] = useTransition();

  function onDelete(id: string) {
    if (!confirm("Delete this consumable entry?")) return;
    startDelete(async () => {
      await deleteConsumable(id, jobId);
      router.refresh();
    });
  }

  return (
    <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div>
          <p className="text-white text-sm font-semibold">🧪 Consumables</p>
          <p className="text-zinc-500 text-[10px]">{entries.length} items · {fmt(total)} total</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-blue-400 hover:text-blue-300 text-xs"
        >
          {open ? "× Cancel" : "+ Log item"}
        </button>
      </div>

      {open && (
        <form action={action} className="flex flex-wrap gap-1.5 mb-3 items-end">
          <input type="hidden" name="job_id" value={jobId} />
          <input
            name="item"
            type="text"
            placeholder="e.g. Antimicrobial gal"
            required
            className={`${INPUT} flex-1 min-w-[140px]`}
          />
          <input
            name="quantity"
            type="number"
            step="0.5"
            min="0.5"
            placeholder="qty"
            required
            className={`${INPUT} w-16`}
          />
          <input
            name="unit_cost"
            type="number"
            step="0.01"
            min="0"
            placeholder="$/unit"
            required
            className={`${INPUT} w-20`}
          />
          <button
            type="submit"
            disabled={pending}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded-md"
          >
            {pending ? "…" : "Add"}
          </button>
          {state?.error && (
            <p className="text-red-400 text-[11px] basis-full">{state.error}</p>
          )}
        </form>
      )}

      {entries.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {entries.map((e) => {
            const cost = Number(e.quantity) * Number(e.unit_cost);
            return (
              <li
                key={e.id}
                className="flex items-center justify-between gap-2 text-xs px-2 py-1 rounded hover:bg-zinc-800"
              >
                <span className="text-zinc-300 flex-1 min-w-0 truncate">{e.item}</span>
                <span className="text-zinc-400 font-mono">
                  {Number(e.quantity)} × ${Number(e.unit_cost).toFixed(2)}
                </span>
                <span className="text-white font-mono w-16 text-right">
                  {fmt(cost)}
                </span>
                <button
                  type="button"
                  onClick={() => onDelete(e.id)}
                  disabled={pendingDelete}
                  className="text-zinc-500 hover:text-red-400 text-xs disabled:opacity-50"
                  aria-label="Delete entry"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-zinc-500 text-xs italic">No consumables logged yet.</p>
      )}
    </div>
  );
}
