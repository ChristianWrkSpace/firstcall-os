"use client";

import { useActionState } from "react";
import { createEquipment } from "@/app/actions/equipment";
import { EQUIPMENT_TYPES } from "@/lib/equipment-types";
import { EQUIPMENT_MANUFACTURERS } from "@/lib/restoration-catalog";
import Link from "next/link";

const INPUT =
  "w-full px-3 py-2 rounded-lg bg-shade border border-edge2 text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-cta focus:border-transparent text-sm";
const LABEL = "text-ink-2 text-sm font-medium";

export default function NewEquipmentPage() {
  const [state, action, pending] = useActionState(createEquipment, undefined);

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="mb-6">
        <Link href="/equipment" className="text-ink-3 hover:text-ink text-sm transition-colors">
          ← Equipment
        </Link>
        <h1 className="text-2xl font-bold text-ink mt-2">Add Equipment</h1>
      </div>

      <form action={action} className="flex flex-col gap-5">
        <section className="glass-card p-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className={LABEL}>Type *</label>
              <select name="type" required className={INPUT}>
                {EQUIPMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={LABEL}>Serial Number *</label>
              <input
                name="serial_number"
                required
                className={INPUT}
                placeholder="e.g. DRZ-A1B2C3"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={LABEL}>Manufacturer</label>
              <input
                name="manufacturer"
                list="equipment-manufacturers"
                autoComplete="off"
                className={INPUT}
                placeholder="Pick or type — e.g. Phoenix"
              />
              <datalist id="equipment-manufacturers">
                {EQUIPMENT_MANUFACTURERS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={LABEL}>Model</label>
              <input
                name="model"
                className={INPUT}
                placeholder="LGR 7000XLi"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={LABEL}>Purchase Date</label>
              <input
                name="purchased_at"
                type="date"
                className={INPUT}
              />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <label className={LABEL}>Notes</label>
              <textarea
                name="notes"
                rows={2}
                className={`${INPUT} resize-none`}
                placeholder="Anything tech needs to know about this unit"
              />
            </div>
          </div>
        </section>

        {state?.error && (
          <p className="text-red-700 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {state.error}
          </p>
        )}

        <div className="flex gap-3">
          <Link
            href="/equipment"
            className="px-4 py-2 border border-edge2 text-ink-2 rounded-lg text-sm hover:bg-shade transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="px-6 py-2 bg-cta hover:bg-cta-deep disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {pending ? "Adding…" : "Add Equipment"}
          </button>
        </div>
      </form>
    </div>
  );
}
