"use client";

import { useState, useTransition } from "react";
import {
  updateMessageDraft,
  markMessageSent,
  recordReply,
} from "@/app/actions/outreach";

interface Msg {
  id: string;
  channel: string;
  subject: string | null;
  draft_content: string;
  status: string;
  sent_at: string | null;
  reply_received: boolean;
  reply_notes: string | null;
  created_at: string;
}

const CHANNEL_EMOJI: Record<string, string> = {
  email: "✉",
  voicemail: "📞",
  sms: "💬",
  linkedin: "💼",
};

export default function MessageView({
  message,
  leadId,
}: {
  message: Msg;
  leadId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(message.draft_content);
  const [subject, setSubject] = useState(message.subject ?? "");
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [replyNotes, setReplyNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function save() {
    startTransition(async () => {
      const res = await updateMessageDraft(message.id, leadId, content, subject);
      if (!res.error) setEditing(false);
    });
  }

  function markSent() {
    startTransition(async () => {
      await markMessageSent(message.id, leadId);
    });
  }

  async function copyAll() {
    const text = message.subject
      ? `Subject: ${subject}\n\n${content}`
      : content;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  function logReply() {
    if (!replyNotes.trim()) return setError("Add a note about the reply.");
    startTransition(async () => {
      const res = await recordReply(message.id, leadId, replyNotes);
      if (!res.error) {
        setShowReply(false);
        setReplyNotes("");
      }
    });
  }

  return (
    <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-base">{CHANNEL_EMOJI[message.channel] ?? "📬"}</span>
          <span className="text-zinc-400 text-xs uppercase tracking-wide">
            {message.channel}
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
              message.status === "sent"
                ? "bg-blue-500/15 text-blue-400"
                : message.status === "approved"
                  ? "bg-green-500/15 text-green-400"
                  : "bg-zinc-700 text-zinc-300"
            }`}
          >
            {message.status}
          </span>
          {message.reply_received && (
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-green-500/15 text-green-400">
              ✓ Replied
            </span>
          )}
        </div>
        <p className="text-zinc-500 text-xs">
          {new Date(message.sent_at ?? message.created_at).toLocaleString()}
        </p>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2 mt-2">
          {message.channel === "email" && (
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          )}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setEditing(false)}
              className="text-zinc-500 hover:text-zinc-300 text-xs"
            >
              cancel
            </button>
            <button
              onClick={save}
              disabled={pending}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs rounded"
            >
              save
            </button>
          </div>
        </div>
      ) : (
        <>
          {message.subject && (
            <p className="text-white font-semibold text-sm mt-2">
              {message.subject}
            </p>
          )}
          <pre className="mt-2 text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap font-sans">
            {content}
          </pre>

          <div className="mt-3 pt-3 border-t border-zinc-700/40 flex items-center gap-2 flex-wrap">
            {message.status === "draft" && (
              <button
                onClick={() => setEditing(true)}
                className="text-blue-400 hover:text-blue-300 text-xs"
              >
                edit
              </button>
            )}
            <button
              onClick={copyAll}
              className="text-blue-400 hover:text-blue-300 text-xs"
            >
              {copied ? "✓ copied" : "📋 copy"}
            </button>
            {message.status !== "sent" && (
              <button
                onClick={markSent}
                disabled={pending}
                className="text-green-400 hover:text-green-300 text-xs"
              >
                ✓ mark sent
              </button>
            )}
            {message.status === "sent" && !message.reply_received && (
              <button
                onClick={() => setShowReply(true)}
                className="text-yellow-400 hover:text-yellow-300 text-xs"
              >
                💬 record reply
              </button>
            )}
          </div>

          {message.reply_received && message.reply_notes && (
            <div className="mt-3 pt-3 border-t border-zinc-700/40">
              <p className="text-zinc-500 text-[10px] uppercase tracking-wide mb-1">
                Reply received
              </p>
              <p className="text-zinc-300 text-sm">{message.reply_notes}</p>
            </div>
          )}

          {showReply && (
            <div className="mt-3 pt-3 border-t border-zinc-700/40 flex flex-col gap-2">
              <input
                value={replyNotes}
                onChange={(e) => setReplyNotes(e.target.value)}
                placeholder="What did they say?"
                className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowReply(false)}
                  className="text-zinc-500 hover:text-zinc-300 text-xs"
                >
                  cancel
                </button>
                <button
                  onClick={logReply}
                  disabled={pending}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs rounded"
                >
                  save
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
