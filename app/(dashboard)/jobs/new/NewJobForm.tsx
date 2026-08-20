"use client";

import { useActionState, useState } from "react";
import { createJob } from "@/app/actions/jobs";
import { JOB_TYPES, PAYMENT_ROUTES, type PaymentRoute } from "@/lib/constants";
import Link from "next/link";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { INSURANCE_CARRIERS } from "@/lib/restoration-catalog";

const INPUT = "w-full px-3 py-2.5 rounded-lg bg-shade border border-edge2 text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-cta focus:border-transparent text-sm";
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
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/jobs" className="text-ink-3 hover:text-ink text-sm transition-colors">
          ← Jobs
        </Link>
        <h1 className="text-2xl font-bold text-ink mt-2">Start a job</h1>
        <p className="text-sm text-ink-2 mt-1">
          Start with the customer and loss. Add billing and referral details only when you have them.
        </p>
      </div>

      <form action={action} className="flex flex-col gap-4">
        <section className="glass-card p-4 md:p-6">
          <div className="mb-5">
            <h2 className="text-ink font-semibold">Customer and loss</h2>
            <p className="text-ink-3 text-xs mt-1">Enough information to call back, find the property, and open the job.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 [&>.col-span-2]:!col-span-1 sm:[&>.col-span-2]:!col-span-2">
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <label className={LABEL}>Customer name *</label>
              <input name="customer_name" required autoComplete="name" className={INPUT} placeholder="John Smith" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={LABEL}>Phone</label>
              <input name="customer_phone" type="tel" autoComplete="tel" className={INPUT} placeholder="(512) 555-0100" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={LABEL}>Email</label>
              <input name="customer_email" type="email" autoComplete="email" className={INPUT} placeholder="john@email.com" />
            </div>
            <p className="sm:col-span-2 text-ink-3 text-xs -mt-1">Phone or email is required so the customer can be reached.</p>

            <AddressAutocomplete />

            <div className="flex flex-col gap-1.5">
              <label className={LABEL}>Damage type *</label>
              <select name="type" required className={INPUT}>
                {JOB_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <label className={LABEL}>What happened?</label>
              <textarea
                name="description"
                rows={3}
                className={`${INPUT} resize-none`}
                placeholder="Active leak, affected rooms, hazards, or anything the technician should know..."
              />
            </div>
          </div>
        </section>

        <details className="glass-card overflow-hidden group">
          <summary className="cursor-pointer list-none select-none flex items-center gap-3 px-4 md:px-6 py-4 min-h-[52px] [&::-webkit-details-marker]:hidden">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">Payment, insurance & referral</p>
              <p className="text-xs text-ink-3 mt-0.5">Optional now. Complete it when the information is available.</p>
            </div>
            <span className="text-xs text-ink-3 transition-transform group-open:rotate-90">▸</span>
          </summary>

          <div className="border-t border-edge2 px-4 md:px-6 py-5 space-y-6">
            <div>
              <h3 className="text-sm font-medium text-ink">How will this job be paid?</h3>
              <div className="flex flex-col gap-2 mt-3">
                {PAYMENT_ROUTES.map((paymentRoute) => (
                  <label
                    key={paymentRoute.value}
                    className={`flex gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                      route === paymentRoute.value ? "border-info bg-blue-500/5" : "border-edge2 hover:bg-shade"
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment_route"
                      value={paymentRoute.value}
                      checked={route === paymentRoute.value}
                      onChange={() => setRoute(paymentRoute.value)}
                      className="mt-1"
                    />
                    <span className="min-w-0">
                      <span className="block text-ink text-sm font-medium">{paymentRoute.label}</span>
                      <span className="block text-ink-3 text-xs mt-0.5">{paymentRoute.description}</span>
                    </span>
                  </label>
                ))}
              </div>

              {showDeductible && (
                <div className="mt-4 flex flex-col gap-1.5">
                  <label className={LABEL}>Customer deductible *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 text-sm">$</span>
                    <input
                      name="deductible_amount"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      className={`${INPUT} pl-7`}
                      placeholder="1000.00"
                    />
                  </div>
                </div>
              )}
            </div>

            {showInsurance && (
              <div className="border-t border-edge2 pt-5">
                <h3 className="text-sm font-medium text-ink mb-3">Insurance information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 flex flex-col gap-1.5">
                    <label className={LABEL}>Insurance company</label>
                    <input
                      name="insurance_company"
                      list="insurance-carriers"
                      autoComplete="off"
                      className={INPUT}
                      placeholder="Pick or type — e.g. State Farm"
                    />
                    <datalist id="insurance-carriers">
                      {INSURANCE_CARRIERS.map((carrier) => <option key={carrier} value={carrier} />)}
                    </datalist>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={LABEL}>Policy number</label>
                    <input name="insurance_policy_number" className={INPUT} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={LABEL}>Claim number</label>
                    <input name="insurance_claim_number" className={INPUT} />
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-edge2 pt-5">
              <label className={LABEL}>Referral source</label>
              <select name="referred_by_id" defaultValue="" className={`${INPUT} mt-1.5`}>
                <option value="">Direct / not referred</option>
                {partners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.name}{partner.company ? ` — ${partner.company}` : ""}
                  </option>
                ))}
              </select>
              {partners.length === 0 && (
                <p className="text-ink-3 text-xs mt-2">
                  No referral partners yet. <Link href="/partners/outreach" className="text-info hover:underline">Open Partners</Link>
                </p>
              )}
            </div>

            <label className="border-t border-edge2 pt-5 flex items-start gap-3 cursor-pointer">
              <input name="is_test" type="checkbox" className="mt-1" />
              <span>
                <span className="block text-sm font-medium text-ink">Training / test job</span>
                <span className="block text-xs text-ink-3 mt-0.5">Keeps this job out of normal operations and disables automated actions.</span>
              </span>
            </label>
          </div>
        </details>

        {state?.error && (
          <p role="alert" className="text-red-700 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {state.error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          <Link href="/jobs" className="px-4 py-2.5 border border-edge2 text-ink-2 rounded-lg text-sm hover:bg-shade transition-colors">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 px-6 py-2.5 bg-cta hover:bg-cta-deep disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {pending ? "Creating…" : "Create job"}
          </button>
        </div>
      </form>
    </div>
  );
}
