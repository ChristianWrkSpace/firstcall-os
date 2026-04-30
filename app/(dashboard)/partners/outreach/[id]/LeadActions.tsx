"use client";

import { useState, useTransition } from "react";
import {
  generateMessage,
  setLeadStatus,
  convertLeadToPartner,
  deleteLead,
} from "@/app/actions/outreach";

export default function LeadActions({
  leadId,
  status,
  hasSentMessages,
}: {
  leadId: string;
  status: string;
  hasSentMessages: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function generate(channel: "email" | "voicemail" | "follow_up") {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const res = await generateMessage(leadId, channel);
      if (res.error) setError(res.error);
      else setInfo(`✓ Hunter drafted a ${channel === "follow_up" ? "follow-up email" : channel}`);
    });
  }

  function changeStatus(newStatus: string) {
    setError(null);
    startTransition(async () => {
      const res = await setLeadStatus(leadId, newStatus);
      if (res.error) setError(res.error);
    });
  }

  function convert() {
    if (!confirm("Convert this lead to a partner?")) return;
    startTransition(async () => {
      const res = await convertLeadToPartner(leadId);
      if (res.error) setError(res.error);
    });
  }

  function remove() {
    if (!confirm("Delete this lead and all its messages?")) return;
    startTransition(async () => {
      await deleteLead(leadId);
    });
  }

  const isFinal = status === "converted" || status === "disqualified";

  return (
    <div className="flex flex-col gap-2">
      <p className="text-zinc-500 text-[10px] uppercase tracking-wide font-semibold">
        Hunter (AI Draft)
      </p>
      <button
        onClick={() => generate("email")}
        disabled={pending}
        className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg text-left flex items-center gap-2"
      >
        ✉ Cold Email
      </button>
      <button
        onClick={() => generate("voicemail")}
        disabled={pending}
        className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 text-sm rounded-lg text-left flex items-center gap-2"
      >
        📞 Voicemail Script
      </button>
      {hasSentMessages && (
        <button
          onClick={() => generate("follow_up")}
          disabled={pending}
          className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 text-sm rounded-lg text-left flex items-center gap-2"
        >
          🔁 Follow-Up Email
        </button>
      )}

      <div className="border-t border-zinc-800 pt-2 mt-2 flex flex-col gap-1.5">
        <p className="text-zinc-500 text-[10px] uppercase tracking-wide font-semibold mb-1">
          Status
        </p>
        {!isFinal && (
          <>
            <button
              onClick={() => changeStatus("followed_up")}
              disabled={pending}
              className="text-yellow-400 hover:text-yellow-300 text-xs text-left"
            >
              Mark followed up
            </button>
            <button
              onClick={convert}
              disabled={pending}
              className="text-green-400 hover:text-green-300 text-xs text-left"
            >
              ✓ Convert to Partner
            </button>
            <button
              onClick={() => changeStatus("no_response")}
              disabled={pending}
              className="text-zinc-500 hover:text-zinc-300 text-xs text-left"
            >
              Mark no response
            </button>
            <button
              onClick={() => changeStatus("disqualified")}
              disabled={pending}
              className="text-red-400 hover:text-red-300 text-xs text-left"
            >
              Disqualify
            </button>
          </>
        )}
        <button
          onClick={remove}
          disabled={pending}
          className="text-red-400 hover:text-red-300 text-xs text-left mt-2"
        >
          Delete Lead
        </button>
      </div>

      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
      {info && <p className="text-green-400 text-xs mt-1">{info}</p>}
    </div>
  );
}
