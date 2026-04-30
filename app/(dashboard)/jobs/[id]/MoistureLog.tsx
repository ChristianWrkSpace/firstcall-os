"use client";

import { useState, useTransition } from "react";
import {
  recordMoistureReading,
  deleteMoistureReading,
} from "@/app/actions/moisture";

interface Reading {
  id: string;
  reading_date: string;
  room: string;
  location_detail: string | null;
  material: string | null;
  moisture_pct: number | null;
  rh_pct: number | null;
  temp_f: number | null;
  gpp: number | null;
  is_dry_standard: boolean;
  notes: string | null;
  recorder?: { name: string } | null;
}

const MATERIALS = [
  "drywall",
  "wood_subfloor",
  "hardwood",
  "concrete",
  "carpet_pad",
  "plaster",
  "baseboard",
  "insulation",
  "tile",
  "other",
];

const INPUT =
  "w-full px-2.5 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-600";

export default function MoistureLog({
  jobId,
  readings,
}: {
  jobId: string;
  readings: Reading[];
}) {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await recordMoistureReading(jobId, formData);
      if (res.error) setError(res.error);
      else setAdding(false);
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this reading?")) return;
    startTransition(async () => {
      await deleteMoistureReading(id, jobId);
    });
  }

  // Group readings by date
  const byDate: Record<string, Reading[]> = {};
  for (const r of readings) {
    if (!byDate[r.reading_date]) byDate[r.reading_date] = [];
    byDate[r.reading_date].push(r);
  }
  const dates = Object.keys(byDate).sort().reverse();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-zinc-400 text-xs">
          {readings.length} {readings.length === 1 ? "reading" : "readings"} logged
          {dates.length > 0 && ` · last on ${new Date(dates[0]).toLocaleDateString()}`}
        </p>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-blue-400 hover:text-blue-300 text-xs font-medium"
          >
            + Log Reading
          </button>
        )}
      </div>

      {adding && (
        <form
          action={handleSubmit}
          className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-4 gap-2"
        >
          <div className="col-span-2 sm:col-span-2 flex flex-col gap-1">
            <label className="text-zinc-400 text-[10px] uppercase tracking-wide">Room *</label>
            <input
              name="room"
              required
              placeholder="Master bedroom"
              className={INPUT}
            />
          </div>
          <div className="col-span-2 sm:col-span-2 flex flex-col gap-1">
            <label className="text-zinc-400 text-[10px] uppercase tracking-wide">Location detail</label>
            <input
              name="location_detail"
              placeholder="Wall behind nightstand"
              className={INPUT}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-zinc-400 text-[10px] uppercase tracking-wide">Date</label>
            <input
              name="reading_date"
              type="date"
              defaultValue={new Date().toISOString().split("T")[0]}
              className={INPUT}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-zinc-400 text-[10px] uppercase tracking-wide">Material</label>
            <select name="material" className={INPUT}>
              <option value="">—</option>
              {MATERIALS.map((m) => (
                <option key={m} value={m}>
                  {m.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-zinc-400 text-[10px] uppercase tracking-wide">Moisture %</label>
            <input
              name="moisture_pct"
              type="number"
              step="0.1"
              placeholder="14.5"
              className={INPUT}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-zinc-400 text-[10px] uppercase tracking-wide">RH %</label>
            <input name="rh_pct" type="number" step="0.1" placeholder="55" className={INPUT} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-zinc-400 text-[10px] uppercase tracking-wide">Temp °F</label>
            <input name="temp_f" type="number" step="0.1" placeholder="72" className={INPUT} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-zinc-400 text-[10px] uppercase tracking-wide">GPP</label>
            <input name="gpp" type="number" step="0.1" placeholder="65" className={INPUT} />
          </div>
          <div className="col-span-2 sm:col-span-3 flex flex-col gap-1">
            <label className="text-zinc-400 text-[10px] uppercase tracking-wide">Notes</label>
            <input name="notes" placeholder="optional" className={INPUT} />
          </div>
          <label className="col-span-2 sm:col-span-1 flex items-center gap-2 text-xs text-zinc-300 mt-5">
            <input type="checkbox" name="is_dry_standard" />
            Dry standard met
          </label>
          {error && <p className="col-span-full text-red-400 text-xs">{error}</p>}
          <div className="col-span-full flex justify-end gap-2 mt-1">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="text-zinc-500 hover:text-zinc-300 text-xs"
            >
              cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs rounded-lg"
            >
              {pending ? "saving…" : "Log Reading"}
            </button>
          </div>
        </form>
      )}

      {readings.length === 0 ? (
        <p className="text-zinc-500 text-sm italic">
          No moisture readings yet. Log one daily during drying for IICRC S500 compliance.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {dates.map((date) => (
            <div key={date}>
              <p className="text-zinc-400 text-xs uppercase tracking-wide font-semibold mb-1.5">
                {new Date(date).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500 uppercase tracking-wide">
                      <th className="text-left py-1.5">Room</th>
                      <th className="text-left py-1.5">Material</th>
                      <th className="text-right py-1.5">Moisture %</th>
                      <th className="text-right py-1.5">RH</th>
                      <th className="text-right py-1.5">Temp</th>
                      <th className="text-right py-1.5">GPP</th>
                      <th className="text-center py-1.5">Dry?</th>
                      <th className="py-1.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {byDate[date].map((r) => (
                      <tr key={r.id} className="border-b border-zinc-800/40">
                        <td className="py-1.5 text-zinc-200">
                          {r.room}
                          {r.location_detail && (
                            <p className="text-zinc-500 text-[10px]">{r.location_detail}</p>
                          )}
                        </td>
                        <td className="py-1.5 text-zinc-400">
                          {r.material?.replace(/_/g, " ") ?? "—"}
                        </td>
                        <td className="py-1.5 text-right text-zinc-300 font-mono">
                          {r.moisture_pct !== null ? `${r.moisture_pct}%` : "—"}
                        </td>
                        <td className="py-1.5 text-right text-zinc-400 font-mono">
                          {r.rh_pct !== null ? `${r.rh_pct}%` : "—"}
                        </td>
                        <td className="py-1.5 text-right text-zinc-400 font-mono">
                          {r.temp_f !== null ? `${r.temp_f}°` : "—"}
                        </td>
                        <td className="py-1.5 text-right text-zinc-400 font-mono">
                          {r.gpp !== null ? r.gpp : "—"}
                        </td>
                        <td className="py-1.5 text-center">
                          {r.is_dry_standard ? (
                            <span className="text-green-400">✓</span>
                          ) : (
                            <span className="text-zinc-700">—</span>
                          )}
                        </td>
                        <td className="py-1.5 text-right">
                          <button
                            onClick={() => remove(r.id)}
                            className="text-red-400 hover:text-red-300 text-[10px]"
                          >
                            del
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
