"use client";

import { useActionState } from "react";
import { createSub } from "@/app/actions/subs";

const INPUT =
  "px-3 py-2 rounded-lg bg-shade border border-edge2 text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-cta text-sm";

const TRADES = [
  "Reconstruction",
  "Plumber",
  "Electrician",
  "HVAC",
  "Asbestos abatement",
  "Lead remediation",
  "Roofer",
  "Drywall finisher",
  "Painter",
  "Flooring",
  "Cleaning crew",
  "Hauling",
  "Other",
];

export default function NewSubForm() {
  const [state, action, pending] = useActionState(createSub, undefined);

  return (
    <form action={action} className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-ink-2 text-xs uppercase tracking-wide">Name *</label>
        <input name="name" required placeholder="ABC Reconstruction LLC" className={INPUT} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-ink-2 text-xs uppercase tracking-wide">Trade</label>
        <input
          name="trade"
          list="sub-trades"
          autoComplete="off"
          placeholder="Reconstruction, Plumber…"
          className={INPUT}
        />
        <datalist id="sub-trades">
          {TRADES.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-ink-2 text-xs uppercase tracking-wide">Contact name</label>
        <input name="contact_name" placeholder="John Smith" className={INPUT} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-ink-2 text-xs uppercase tracking-wide">Phone</label>
        <input name="phone" placeholder="(512) 555-0123" className={INPUT} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-ink-2 text-xs uppercase tracking-wide">Email</label>
        <input name="email" type="email" placeholder="ops@abc.com" className={INPUT} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-ink-2 text-xs uppercase tracking-wide">EIN / SSN last 4</label>
        <input
          name="ein_or_ssn_last4"
          maxLength={4}
          placeholder="1234"
          className={`${INPUT} font-mono`}
        />
      </div>
      <div className="flex items-center gap-2 md:col-span-3">
        <input id="is_corp" name="is_corporation" type="checkbox" className="accent-blue-600" />
        <label htmlFor="is_corp" className="text-ink-2 text-sm">
          C-corp / S-corp (no 1099-NEC required)
        </label>
      </div>
      <div className="flex flex-col gap-1 md:col-span-3">
        <label className="text-ink-2 text-xs uppercase tracking-wide">Notes</label>
        <input name="notes" placeholder="Insurance certs on file, etc." className={INPUT} />
      </div>
      <div className="md:col-span-3">
        <button
          type="submit"
          disabled={pending}
          className="px-5 py-2 bg-cta hover:bg-cta-deep disabled:opacity-50 text-white text-sm font-medium rounded-lg"
        >
          {pending ? "Saving…" : "+ Add Sub"}
        </button>
        {state?.error && (
          <p className="text-red-700 text-xs mt-2">{state.error}</p>
        )}
        {state?.ok && (
          <p className="text-pine text-xs mt-2">✓ Added.</p>
        )}
      </div>
    </form>
  );
}
