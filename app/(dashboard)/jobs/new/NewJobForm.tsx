"use client";

import { useActionState, useState } from "react";
import { createJob } from "@/app/actions/jobs";
import { JOB_TYPES, PAYMENT_ROUTES, type PaymentRoute } from "@/lib/constants";
import Link from "next/link";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { INSURANCE_CARRIERS } from "@/lib/restoration-catalog";

const INPUT = "w-full px-3 py-2 rounded-lg bg-shade border border-edge2 text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-cta focus:border-transparent text-sm";
const LABEL = "text-ink-2 text-sm font-medium";

export interface PartnerOption {
  id: string;
  name: string;
  company: string | null;
  partner_type: string | null;
}

export default function NewJobForm({ partners }: { partners: PartnerOption[] }) {
  const [state, action, pending] = useActionState(createJob, undefined);
  const [route, setRoute] = useState<PaymentRoute>("customer_pay");
  const showInsurance = route !== "customer_pay";
  const showDeductible = route === "insurance_with_deductible";

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="mb-6">
        <Link href="/jobs" className="text-ink-3 hover:text-ink text-sm transition-colors">
          ← Jobs
        </Link>
        <h1 className="text-2xl font-bold text-ink mt-2">New Job</h1>
      </div>

      <form action={action} className="flex flex-col gap-5">
        {/* Customer */}
        <section className="glass-card p-6">
          <h2 className="text-ink font-semibold mb-4">Customer</h2>
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
          </div>
        </section>

        {/* Referral source */}
        <section className="glass-card p-6">
          <h2 className="text-ink font-semibold mb-1">Referred by</h2>
          <p className="text-ink-3 text-xs mb-3">
            Did a partner send this lead our way? Pick them so revenue rolls into their ROI.
          </p>
          <select
            name="referred_by_id"
            defaultValue=""
            className={INPUT}
          >
            <option value="">Direct / not referred</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.company ? ` — ${p.company}` : ""}
              </option>
            ))}
          </select>
          {partners.length === 0 && (
            <p className="text-ink-3 text-[10px] mt-2 italic">
              No partners yet. Add them via{" "}
              <Link href="/partners/outreach" className="text-info hover:underline">
                Outreach Pipeline
              </Link>{" "}
              and convert leads when they refer.
            </p>
          )}
        </section>

        {/* Payment Route */}
        <section className="glass-card p-6">
          <h2 className="text-ink font-semibold mb-1">Payment Route</h2>
          <p className="text-ink-3 text-xs mb-4">
            How is this job being paid? Drives what the customer sees on their portal.
          </p>
          <div className="flex flex-col gap-2">
            {PAYMENT_ROUTES.map((r) => (
              <label
                key={r.value}
                className={`flex gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                  route === r.value
                    ? "border-info bg-blue-500/5"
                    : "border-edge2 hover:border-edge2"
                }`}
              >
                <input
                  type="radio"
                  name="payment_route"
                  value={r.value}
                  checked={route === r.value}
                  onChange={() => setRoute(r.value)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-ink text-sm font-medium">{r.label}</p>
                  <p className="text-ink-3 text-xs mt-0.5">{r.description}</p>
                </div>
              </label>
            ))}
          </div>

          {showDeductible && (
            <div className="mt-4 flex flex-col gap-1.5">
              <label className={LABEL}>Deductible Amount *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 text-sm">
                  $
                </span>
                <input
                  name="deductible_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  required={showDeductible}
                  className={`${INPUT} pl-7`}
                  placeholder="1000.00"
                />
              </div>
              <p className="text-ink-3 text-xs">
                The customer's portal will charge this amount only.
              </p>
            </div>
          )}
        </section>

        {/* Insurance — only when relevant */}
        {showInsurance && (
          <section className="glass-card p-6">
            <h2 className="text-ink font-semibold mb-4">Insurance</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className={LABEL}>Insurance Company</label>
                <input
                  name="insurance_company"
                  list="insurance-carriers"
                  autoComplete="off"
                  className={INPUT}
                  placeholder="Pick or type — e.g. State Farm"
                />
                <datalist id="insurance-carriers">
                  {INSURANCE_CARRIERS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={LABEL}>Policy #</label>
                <input name="insurance_policy_number" className={INPUT} placeholder="POL-98765" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={LABEL}>Claim #</label>
                <input name="insurance_claim_number" className={INPUT} placeholder="CLM-12345" />
              </div>
            </div>
          </section>
        )}

        {/* Job Details */}
        <section className="glass-card p-6">
          <h2 className="text-ink font-semibold mb-4">Job Details</h2>
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
            <AddressAutocomplete />
          </div>
        </section>

        {state?.error && (
          <p className="text-red-700 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {state.error}
          </p>
        )}

        <div className="flex gap-3">
          <Link
            href="/jobs"
            className="px-4 py-2 border border-edge2 text-ink-2 rounded-lg text-sm hover:bg-shade transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="px-6 py-2 bg-cta hover:bg-cta-deep disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {pending ? "Creating…" : "Create Job"}
          </button>
        </div>
      </form>
    </div>
  );
}
