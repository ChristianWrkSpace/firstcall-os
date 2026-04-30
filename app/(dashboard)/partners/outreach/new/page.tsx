"use client";

import { useActionState } from "react";
import { createLead } from "@/app/actions/outreach";
import { BUSINESS_TYPES } from "@/lib/hunter";
import Link from "next/link";

const INPUT =
  "w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm";
const LABEL = "text-zinc-300 text-sm font-medium";

export default function NewLeadPage() {
  const [state, action, pending] = useActionState(createLead, undefined);

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="mb-6">
        <Link
          href="/partners/outreach"
          className="text-zinc-500 hover:text-white text-sm transition-colors"
        >
          ← Outreach Pipeline
        </Link>
        <h1 className="text-2xl font-bold text-white mt-2">Add Lead</h1>
      </div>

      <form action={action} className="flex flex-col gap-5">
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-4">Company</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <label className={LABEL}>Company Name *</label>
              <input
                name="company_name"
                required
                className={INPUT}
                placeholder="Hilton Austin Downtown"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={LABEL}>Business Type *</label>
              <select name="business_type" required defaultValue="hotel" className={INPUT}>
                {(Object.entries(BUSINESS_TYPES) as [string, any][]).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={LABEL}>City</label>
              <input name="city" defaultValue="Austin" className={INPUT} />
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <label className={LABEL}>Website</label>
              <input
                name="website"
                className={INPUT}
                placeholder="hilton.com/austin"
              />
            </div>
          </div>
        </section>

        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-4">Contact</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className={LABEL}>Contact Name</label>
              <input name="contact_name" className={INPUT} placeholder="Jane Smith" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={LABEL}>Title</label>
              <input
                name="contact_title"
                className={INPUT}
                placeholder="Facilities Manager"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={LABEL}>Email</label>
              <input
                name="contact_email"
                type="email"
                className={INPUT}
                placeholder="jane@hilton.com"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={LABEL}>Phone</label>
              <input
                name="contact_phone"
                className={INPUT}
                placeholder="(512) 555-0100"
              />
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <label className={LABEL}>Source</label>
              <input
                name="source"
                className={INPUT}
                placeholder="LinkedIn / referral / cold list"
              />
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <label className={LABEL}>Notes</label>
              <textarea
                name="notes"
                rows={3}
                className={`${INPUT} resize-none`}
                placeholder="Anything Hunter should know when drafting outreach"
              />
            </div>
          </div>
        </section>

        {state?.error && (
          <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {state.error}
          </p>
        )}

        <div className="flex gap-3">
          <Link
            href="/partners/outreach"
            className="px-4 py-2 border border-zinc-700 text-zinc-300 rounded-lg text-sm hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {pending ? "Adding…" : "Add Lead"}
          </button>
        </div>
      </form>
    </div>
  );
}
