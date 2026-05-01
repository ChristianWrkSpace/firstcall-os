"use client";

import { useState, useTransition } from "react";
import { sendCustomerNotification } from "@/app/actions/notifications";
import { EVENT_META, type NotificationEvent } from "@/lib/notifications";

interface SentNotification {
  id: string;
  event_type: string;
  sent_to: string;
  subject: string | null;
  sent_at: string;
}

const INPUT =
  "w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm";

export default function CustomerNotifications({
  jobId,
  customerEmail,
  history,
}: {
  jobId: string;
  customerEmail?: string | null;
  history: SentNotification[];
}) {
  const [event, setEvent] = useState<NotificationEvent>("dispatched");
  const [customMessage, setCustomMessage] = useState("");
  const [recipientOverride, setRecipientOverride] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function send() {
    setError(null);
    setInfo(null);
    if (event === "custom" && !customMessage.trim()) {
      return setError("Write a message before sending.");
    }
    startTransition(async () => {
      const res = await sendCustomerNotification(
        jobId,
        event,
        customMessage,
        recipientOverride
      );
      if (res.error) setError(res.error);
      else {
        setInfo("✓ Sent");
        setCustomMessage("");
        setRecipientOverride("");
      }
    });
  }

  const meta = EVENT_META[event];
  const recipient = recipientOverride.trim() || customerEmail || "(no email on file)";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <label className="text-zinc-400 text-xs uppercase tracking-wide">
          Event
        </label>
        <select
          value={event}
          onChange={(e) => setEvent(e.target.value as NotificationEvent)}
          className={INPUT}
        >
          {(Object.keys(EVENT_META) as NotificationEvent[]).map((k) => (
            <option key={k} value={k}>
              {EVENT_META[k].emoji} {EVENT_META[k].label}
            </option>
          ))}
        </select>
        <p className="text-zinc-500 text-xs">{meta.description}</p>
      </div>

      {event === "custom" && (
        <div className="flex flex-col gap-1.5">
          <label className="text-zinc-400 text-xs uppercase tracking-wide">
            Message
          </label>
          <textarea
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            rows={4}
            placeholder="Write your message to the customer…"
            className={`${INPUT} resize-none`}
          />
          <p className="text-zinc-500 text-[10px]">
            Will be wrapped in the standard branded email layout.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-zinc-400 text-xs uppercase tracking-wide">
          To
        </label>
        <input
          type="email"
          value={recipientOverride}
          onChange={(e) => setRecipientOverride(e.target.value)}
          placeholder={customerEmail ?? "no customer email on file"}
          className={INPUT}
        />
        <p className="text-zinc-500 text-[10px]">
          Defaults to customer's email. Override here for testing or alternate contact.
        </p>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}
      {info && <p className="text-green-400 text-xs">{info}</p>}

      <button
        onClick={send}
        disabled={pending || (!customerEmail && !recipientOverride.trim())}
        className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
      >
        {pending ? "Sending…" : `${meta.emoji} Send to ${recipient}`}
      </button>

      {history.length > 0 && (
        <div className="mt-3 pt-3 border-t border-zinc-800">
          <p className="text-zinc-500 text-[10px] uppercase tracking-wide mb-2">
            Sent History
          </p>
          <ul className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
            {history.map((h) => {
              const ev = EVENT_META[h.event_type as NotificationEvent];
              return (
                <li
                  key={h.id}
                  className="text-xs flex items-center justify-between gap-2 bg-white/[0.03] rounded px-2 py-1.5"
                >
                  <span className="text-zinc-300 truncate">
                    {ev?.emoji ?? "•"} {ev?.label ?? h.event_type}
                  </span>
                  <span className="text-zinc-500 whitespace-nowrap">
                    {new Date(h.sent_at).toLocaleDateString()}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
