"use client";

import { useState, useTransition } from "react";
import { updateEquipment, deleteEquipment } from "@/app/actions/equipment";
import { EQUIPMENT_MANUFACTURERS } from "@/lib/restoration-catalog";

const INPUT =
  "w-full px-3 py-2 rounded-lg bg-shade border border-edge2 text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-cta text-sm";
const LABEL = "text-ink-2 text-xs uppercase tracking-wide";

export default function EditForm({
  id,
  defaults,
  meta,
}: {
  id: string;
  defaults: {
    serial_number: string;
    model: string;
    manufacturer: string;
    location_notes: string;
    notes: string;
  };
  meta: { hours_logged: number; purchased_at: string | null; created_at: string };
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await updateEquipment(id, formData);
      if (res.error) setError(res.error);
      else setEditing(false);
    });
  }

  function handleDelete() {
    if (!confirm("Delete this equipment? This cannot be undone.")) return;
    startTransition(async () => {
      const res = await deleteEquipment(id);
      if (res?.error) setError(res.error);
    });
  }

  if (!editing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-ink font-semibold">Equipment Info</h2>
          <button
            onClick={() => setEditing(true)}
            className="text-info hover:text-info-deep text-xs font-medium"
          >
            Edit
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <Field label="Serial #" value={defaults.serial_number} mono />
          <Field label="Manufacturer" value={defaults.manufacturer || "—"} />
          <Field label="Model" value={defaults.model || "—"} />
          <Field
            label="Hours Logged"
            value={`${meta.hours_logged.toFixed(0)} hrs`}
          />
          <Field
            label="Purchased"
            value={
              meta.purchased_at
                ? new Date(meta.purchased_at).toLocaleDateString()
                : "—"
            }
          />
          <Field
            label="Added"
            value={new Date(meta.created_at).toLocaleDateString()}
          />
          {defaults.location_notes && (
            <div className="col-span-2">
              <Field label="Location Notes" value={defaults.location_notes} />
            </div>
          )}
          {defaults.notes && (
            <div className="col-span-2">
              <Field label="Notes" value={defaults.notes} />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-ink font-semibold">Edit Equipment</h2>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
          className="text-ink-3 hover:text-ink-2 text-xs"
        >
          Cancel
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className={LABEL}>Serial #</label>
          <input
            name="serial_number"
            defaultValue={defaults.serial_number}
            required
            className={INPUT}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={LABEL}>Manufacturer</label>
          <input
            name="manufacturer"
            list="equipment-manufacturers-edit"
            autoComplete="off"
            defaultValue={defaults.manufacturer}
            className={INPUT}
          />
          <datalist id="equipment-manufacturers-edit">
            {EQUIPMENT_MANUFACTURERS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-col gap-1">
          <label className={LABEL}>Model</label>
          <input name="model" defaultValue={defaults.model} className={INPUT} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={LABEL}>Location Notes</label>
          <input
            name="location_notes"
            defaultValue={defaults.location_notes}
            className={INPUT}
            placeholder="warehouse shelf B3"
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1">
          <label className={LABEL}>Notes</label>
          <textarea
            name="notes"
            rows={2}
            defaultValue={defaults.notes}
            className={`${INPUT} resize-none`}
          />
        </div>
      </div>

      {error && <p className="text-red-700 text-xs">{error}</p>}

      <div className="flex justify-between items-center">
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="text-red-700 hover:text-red-700 text-xs"
        >
          Delete
        </button>
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-1.5 bg-cta hover:bg-cta-deep disabled:opacity-50 text-white text-sm rounded-lg"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-ink-2 text-xs uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-ink ${mono ? "font-mono text-sm" : ""}`}>{value}</p>
    </div>
  );
}
