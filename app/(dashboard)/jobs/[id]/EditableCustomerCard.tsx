"use client";

import { useState, useTransition } from "react";
import { updateCustomerInfo, type CustomerIntake } from "@/app/actions/customers";
import { INSURANCE_CARRIERS } from "@/lib/restoration-catalog";

const INPUT =
  "w-full px-3 py-2 rounded-lg bg-card border border-edge2 text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-cta text-sm";
const LABEL = "text-ink-2 text-xs uppercase tracking-wide mb-0.5";

export interface EditableCustomer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  insurance_company: string | null;
  insurance_policy_number: string | null;
  insurance_claim_number: string | null;
}

export default function EditableCustomerCard({
  jobId,
  customer,
  showInsurance,
}: {
  jobId: string;
  customer: EditableCustomer;
  showInsurance: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<CustomerIntake>({
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    insurance_company: customer.insurance_company,
    insurance_policy_number: customer.insurance_policy_number,
    insurance_claim_number: customer.insurance_claim_number,
  });

  function update<K extends keyof CustomerIntake>(key: K, value: CustomerIntake[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await updateCustomerInfo(customer.id, jobId, draft);
      if (res.error) setError(res.error);
      else setEditing(false);
    });
  }

  function cancel() {
    setDraft({
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      insurance_company: customer.insurance_company,
      insurance_policy_number: customer.insurance_policy_number,
      insurance_claim_number: customer.insurance_claim_number,
    });
    setError(null);
    setEditing(false);
  }

  if (!editing) {
    return (
      <>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-ink font-semibold">Customer</h2>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-info hover:text-info-deep text-xs font-medium"
          >
            Edit
          </button>
        </div>
        <div className="flex flex-col gap-3 text-sm">
          <div>
            <p className={LABEL}>Name</p>
            <p className="text-ink font-medium">{customer.name}</p>
          </div>
          {customer.phone && (
            <div>
              <p className={LABEL}>Phone</p>
              <a href={`tel:${customer.phone}`} className="text-info hover:underline">
                {customer.phone}
              </a>
            </div>
          )}
          {customer.email && (
            <div>
              <p className={LABEL}>Email</p>
              <a
                href={`mailto:${customer.email}`}
                className="text-info hover:underline truncate block"
              >
                {customer.email}
              </a>
            </div>
          )}
          {(customer.insurance_company ||
            customer.insurance_policy_number ||
            customer.insurance_claim_number) && (
            <div>
              <p className={LABEL}>Insurance</p>
              {customer.insurance_company && (
                <p className="text-ink">{customer.insurance_company}</p>
              )}
              {customer.insurance_policy_number && (
                <p className="text-ink-3 text-xs mt-0.5 font-mono">
                  Policy: {customer.insurance_policy_number}
                </p>
              )}
              {customer.insurance_claim_number && (
                <p className="text-ink-3 text-xs mt-0.5 font-mono">
                  Claim: {customer.insurance_claim_number}
                </p>
              )}
            </div>
          )}
          {showInsurance &&
            !customer.insurance_company &&
            !customer.insurance_policy_number &&
            !customer.insurance_claim_number && (
              <p className="text-honey/80 text-xs italic">
                No insurance info yet — click Edit to add it once you have the policy/claim #.
              </p>
            )}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-ink font-semibold">Edit Customer</h2>
        <button
          type="button"
          onClick={cancel}
          disabled={pending}
          className="text-ink-3 hover:text-ink text-xs font-medium"
        >
          Cancel
        </button>
      </div>
      <div className="flex flex-col gap-3">
        <Field label="Name *">
          <input
            value={draft.name ?? ""}
            onChange={(e) => update("name", e.target.value)}
            className={INPUT}
            placeholder="John Smith"
          />
        </Field>
        <Field label="Phone">
          <input
            value={draft.phone ?? ""}
            onChange={(e) => update("phone", e.target.value)}
            className={INPUT}
            placeholder="(512) 555-0100"
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            value={draft.email ?? ""}
            onChange={(e) => update("email", e.target.value)}
            className={INPUT}
            placeholder="john@email.com"
          />
        </Field>

        {showInsurance && (
          <>
            <div className="mt-2 pt-3 border-t border-edge2">
              <p className="text-ink-2 text-[10px] uppercase tracking-wide font-semibold mb-2">
                Insurance
              </p>
            </div>
            <Field label="Insurance Company">
              <input
                value={draft.insurance_company ?? ""}
                onChange={(e) => update("insurance_company", e.target.value)}
                list="edit-insurance-carriers"
                autoComplete="off"
                className={INPUT}
                placeholder="State Farm"
              />
              <datalist id="edit-insurance-carriers">
                {INSURANCE_CARRIERS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="Policy #">
              <input
                value={draft.insurance_policy_number ?? ""}
                onChange={(e) => update("insurance_policy_number", e.target.value)}
                className={INPUT}
                placeholder="POL-98765"
              />
            </Field>
            <Field label="Claim #">
              <input
                value={draft.insurance_claim_number ?? ""}
                onChange={(e) => update("insurance_claim_number", e.target.value)}
                className={INPUT}
                placeholder="CLM-12345"
              />
            </Field>
          </>
        )}

        {error && (
          <p className="text-red-700 text-xs bg-red-400/10 border border-red-400/20 rounded px-2 py-1">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 mt-1">
          <button
            type="button"
            onClick={save}
            disabled={pending || !draft.name?.trim()}
            className="px-4 py-2 bg-cta hover:bg-cta-deep disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className={LABEL}>{label}</label>
      {children}
    </div>
  );
}
