"use client";

import { useState } from "react";

type Customer = {
  insurance_company?: string | null;
  insurance_policy_number?: string | null;
  insurance_claim_number?: string | null;
};

export default function AdjusterContactCard({
  jobNumber,
  customer,
  adjusterToken,
  siteAddress,
}: {
  jobNumber: string;
  customer: Customer;
  adjusterToken: string | null;
  siteAddress: string | null;
}) {
  const [copied, setCopied] = useState(false);

  const carrier = customer.insurance_company ?? "(not set)";
  const policy = customer.insurance_policy_number ?? "(not set)";
  const claim = customer.insurance_claim_number ?? "(not set)";

  const adjusterUrl =
    adjusterToken && typeof window !== "undefined"
      ? `${window.location.origin}/adjuster/${adjusterToken}`
      : null;

  const subject = `Claim ${claim} — Mitigation Documentation Available`;
  const body = [
    `Hi,`,
    ``,
    `First Call Mitigation is handling the loss at ${siteAddress ?? "the insured property"} (Job ${jobNumber}).`,
    ``,
    `Carrier: ${carrier}`,
    `Policy #: ${policy}`,
    `Claim #: ${claim}`,
    ``,
    adjusterUrl
      ? `You can review the full claim packet — scope, photos, moisture readings, signed AOB, and drying certificates — here:\n${adjusterUrl}`
      : `(Generate the adjuster portal link below to include a packet URL in this email.)`,
    ``,
    `Please reply with confirmation of coverage and approval to proceed.`,
    ``,
    `Thank you,`,
    `First Call Mitigation`,
    `Austin, TX`,
  ].join("\n");

  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  async function copyClaimInfo() {
    const text = [
      `Carrier: ${carrier}`,
      `Policy #: ${policy}`,
      `Claim #: ${claim}`,
      adjusterUrl ? `Packet: ${adjusterUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-tint rounded-lg p-3 flex flex-col gap-1.5 text-xs">
        <div className="flex justify-between gap-2">
          <span className="text-ink-3">Carrier</span>
          <span className="text-ink font-medium">{carrier}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-ink-3">Policy #</span>
          <span className="text-ink font-mono">{policy}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-ink-3">Claim #</span>
          <span className="text-ink font-mono">{claim}</span>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <a
          href={mailto}
          className="flex-1 px-3 py-1.5 bg-cta hover:bg-cta-deep text-white text-xs font-medium rounded-lg text-center"
        >
          📧 Draft email to adjuster
        </a>
        <button
          onClick={copyClaimInfo}
          className="px-3 py-1.5 bg-shade hover:bg-shade text-ink-2 text-xs rounded-lg"
        >
          {copied ? "✓ Copied" : "📋 Copy info"}
        </button>
      </div>
      <p className="text-ink-3 text-[10px]">
        Opens your default mail client with carrier, policy, claim, and the
        adjuster-portal link pre-filled.
      </p>
    </div>
  );
}
