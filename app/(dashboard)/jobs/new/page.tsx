"use client";

import { useActionState } from "react";
import { createJob } from "@/app/actions/jobs";
import { JOB_TYPES } from "@/lib/constants";
import Link from "next/link";

const INPUT = "w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm";
const LABEL = "text-zinc-300 text-sm font-medium";

export default function NewJobPage() {
  const [state, action, pending] = useActionState(createJob, undefined);

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <Link href="/jobs" className="text-zinc-500 hover:text-white text-sm transition-colors">
          ← Jobs
        </Link>
        <h1 className="text-2xl font-bold text-white mt-2">New Job</h1>
      </div>

      <form action={action} className="flex flex-col gap-5">
        {/* Customer */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-4">Customer</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 flex flex-col gap-1.5">
              <label className={LABEL}>Name *</label>
              <input name="customer_name" required className={INPUT} placeholder="John Smith" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={LABEL}>Phone</label>
              <input name="customer_phone" className={INPUT} placeholder="(512) 555-0100" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={LABEL}>Email</label>
              <input name="customer_email" type="email" className={INPUT} placeholder="john@email.com" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={LABEL}>Insurance Company</label>
              <input name="insurance_company" className={INPUT} placeholder="State Farm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={LABEL}>Claim #</label>
              <input name="insurance_claim_number" className={INPUT} placeholder="CLM-12345" />
            </div>
          </div>
        </section>

        {/* Job Details */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-4">Job Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className={LABEL}>Type *</label>
              <select name="type" required className={INPUT}>
                {JOB_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <label className={LABEL}>Description</label>
              <textarea
                name="description"
                rows={3}
                className={`${INPUT} resize-none`}
                placeholder="Brief description of the damage..."
              />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <label className={LABEL}>Site Address *</label>
              <input name="site_address" required className={INPUT} placeholder="1234 Oak Street" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={LABEL}>City</label>
              <input name="site_city" className={INPUT} placeholder="Austin" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className={LABEL}>State</label>
                <input name="site_state" className={INPUT} defaultValue="TX" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={LABEL}>Zip</label>
                <input name="site_zip" className={INPUT} placeholder="78701" />
              </div>
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
            href="/jobs"
            className="px-4 py-2 border border-zinc-700 text-zinc-300 rounded-lg text-sm hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {pending ? "Creating…" : "Create Job"}
          </button>
        </div>
      </form>
    </div>
  );
}
