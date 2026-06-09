"use client";

import { useState, useRef, useEffect, useActionState } from "react";
import { createJobFromCall } from "@/app/actions/calls";
import Link from "next/link";
import { useRouter } from "next/navigation";

type RecordingState = "idle" | "recording" | "processing" | "review" | "submitting";

const CARD = "rounded-2xl bg-white/[0.03] border border-white/[0.06]";

interface Extraction {
  caller_type: "customer" | "partner";
  partner?: {
    name: string;
    company?: string;
    phone?: string;
    relationship_notes?: string;
  };
  customer: {
    name: string;
    phone?: string;
    email?: string;
    insurance_company?: string;
    insurance_claim_number?: string;
  };
  job: {
    site_address?: string;
    site_city?: string;
    site_state?: string;
    site_zip?: string;
    type: string;
    description?: string;
    urgency?: string;
  };
  summary: string;
}

export default function NewCallPage() {
  const router = useRouter();
  const [state, setRecordingState] = useState<RecordingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [extraction, setExtraction] = useState<Extraction | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [submitState, submitAction, submitting] = useActionState(createJobFromCall, undefined);

  useEffect(() => {
    if (submitState?.ok) {
      router.push(`/jobs/${submitState.jobId}`);
    }
  }, [submitState, router]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
      };

      mr.start(250);
      mediaRecorderRef.current = mr;
      setRecordingState("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch (err: any) {
      setError("Microphone access denied. Please allow microphone access.");
    }
  }

  async function stopRecording() {
    if (!mediaRecorderRef.current) return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setRecordingState("processing");

    await new Promise<void>((resolve) => {
      mediaRecorderRef.current!.addEventListener("stop", () => resolve(), { once: true });
      mediaRecorderRef.current!.stop();
    });

    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const fd = new FormData();
    fd.append("audio", blob, "call.webm");

    try {
      const res = await fetch("/api/calls/process", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Processing failed.");

      setTranscript(data.transcript);
      setExtraction(data.extraction);
      setRecordingState("review");
    } catch (err: any) {
      setError(err.message);
      setRecordingState("idle");
    }
  }

  function formatTime(s: number) {
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }

  const urgencyColor = {
    emergency: "text-red-300",
    urgent: "text-amber-300",
    standard: "text-emerald-300",
  }[extraction?.job.urgency ?? "standard"] ?? "text-white/45";

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/calls" className="text-white/40 hover:text-white text-sm transition-colors">
          ← Calls
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-white/95 mt-2">New Call</h1>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-400/10 border border-red-400/20 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Recording UI */}
      {(state === "idle" || state === "recording") && (
        <div className={`${CARD} p-8 flex flex-col items-center gap-5`}>
          <div
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
              state === "recording"
                ? "bg-red-600 shadow-[0_0_30px_rgba(220,38,38,0.5)] animate-pulse"
                : "bg-white/[0.06] hover:bg-white/[0.1]"
            }`}
          >
            <MicIcon className="w-10 h-10 text-white" />
          </div>

          {state === "recording" && (
            <p className="font-mono text-2xl text-red-300">{formatTime(elapsed)}</p>
          )}

          {state === "idle" ? (
            <button
              onClick={startRecording}
              className="px-6 py-2.5 bg-gradient-to-br from-[#6B8AD9] to-[#5FBDB0] text-white text-sm font-medium rounded-lg shadow-[0_0_18px_rgba(95,189,176,0.25)] hover:opacity-95 transition-opacity"
            >
              Start Recording
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              End Call & Process
            </button>
          )}

          <p className="text-white/40 text-xs text-center">
            {state === "idle"
              ? "Record your intake call. AI will extract job details automatically."
              : "Recording… click End Call when finished."}
          </p>
        </div>
      )}

      {/* Processing spinner */}
      {state === "processing" && (
        <div className={`${CARD} p-8 flex flex-col items-center gap-4`}>
          <SpinnerIcon className="w-10 h-10 text-[#A6B8E7] animate-spin" />
          <p className="text-white/90 font-medium">Transcribing & extracting…</p>
          <p className="text-white/40 text-xs text-center">
            Deepgram is transcribing the audio, then Claude is extracting the job details.
          </p>
        </div>
      )}

      {/* Review & Confirm */}
      {state === "review" && extraction && (
        <div className="flex flex-col gap-5">
          {/* Urgency banner */}
          {extraction.job.urgency && extraction.job.urgency !== "standard" && (
            <div
              className={`px-4 py-3 rounded-lg border text-sm font-medium ${
                extraction.job.urgency === "emergency"
                  ? "bg-red-400/10 border-red-400/30 text-red-300"
                  : "bg-amber-400/10 border-amber-400/30 text-amber-300"
              }`}
            >
              ⚠️ {extraction.job.urgency.toUpperCase()} — {extraction.summary}
            </div>
          )}

          {/* Caller type */}
          <div className={`${CARD} p-5`}>
            <h2 className="text-white/90 font-semibold mb-3">Call Type</h2>
            <span
              className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                extraction.caller_type === "partner"
                  ? "bg-purple-400/15 text-purple-300"
                  : "bg-[#6B8AD9]/15 text-[#A6B8E7]"
              }`}
            >
              {extraction.caller_type === "partner" ? "Partner Referral" : "Direct Customer"}
            </span>
          </div>

          {/* Partner info */}
          {extraction.caller_type === "partner" && extraction.partner && (
            <div className={`${CARD} p-5`}>
              <h2 className="text-white/90 font-semibold mb-3">Partner / Referral</h2>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <ReviewField label="Name" value={extraction.partner.name} />
                <ReviewField label="Company" value={extraction.partner.company} />
                <ReviewField label="Phone" value={extraction.partner.phone} />
                {extraction.partner.relationship_notes && (
                  <div className="col-span-2">
                    <ReviewField label="Notes" value={extraction.partner.relationship_notes} />
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Customer */}
          <div className={`${CARD} p-5`}>
            <h2 className="text-white/90 font-semibold mb-3">Customer</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <ReviewField label="Name" value={extraction.customer.name} />
              <ReviewField label="Phone" value={extraction.customer.phone} />
              <ReviewField label="Email" value={extraction.customer.email} />
              <ReviewField label="Insurance" value={extraction.customer.insurance_company} />
              <ReviewField label="Claim #" value={extraction.customer.insurance_claim_number} />
            </dl>
          </div>

          {/* Job */}
          <div className={`${CARD} p-5`}>
            <h2 className="text-white/90 font-semibold mb-3">Job Details</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <ReviewField label="Type" value={extraction.job.type} capitalize />
              <ReviewField
                label="Urgency"
                value={extraction.job.urgency ?? "standard"}
                capitalize
                className={urgencyColor}
              />
              <div className="col-span-2">
                <ReviewField
                  label="Address"
                  value={
                    [
                      extraction.job.site_address,
                      extraction.job.site_city,
                      extraction.job.site_state,
                      extraction.job.site_zip,
                    ]
                      .filter(Boolean)
                      .join(", ") || undefined
                  }
                />
              </div>
              {extraction.job.description && (
                <div className="col-span-2">
                  <ReviewField label="Description" value={extraction.job.description} />
                </div>
              )}
            </dl>
          </div>

          {/* Transcript */}
          <details className={`${CARD} p-5`}>
            <summary className="text-white/45 text-sm cursor-pointer hover:text-white transition-colors">
              View transcript
            </summary>
            <p className="mt-3 text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{transcript}</p>
          </details>

          {/* Submit */}
          {submitState?.error && (
            <p className="text-red-300 text-sm">{submitState.error}</p>
          )}

          <form action={submitAction} className="flex gap-3">
            <input type="hidden" name="extraction" value={JSON.stringify(extraction)} />
            <input type="hidden" name="transcript" value={transcript} />
            <button
              type="button"
              onClick={() => setRecordingState("idle")}
              className="px-4 py-2 border border-white/[0.08] text-white/70 rounded-lg text-sm hover:bg-white/[0.05] transition-colors"
            >
              Re-record
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 bg-gradient-to-br from-[#6B8AD9] to-[#5FBDB0] disabled:opacity-50 text-white text-sm font-medium rounded-lg shadow-[0_0_18px_rgba(95,189,176,0.25)] hover:opacity-95 transition-opacity"
            >
              {submitting ? "Creating Job…" : "Confirm & Create Job"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function ReviewField({
  label,
  value,
  capitalize,
  className,
}: {
  label: string;
  value?: string | null;
  capitalize?: boolean;
  className?: string;
}) {
  return (
    <div>
      <dt className="text-white/40 text-xs uppercase tracking-wide mb-0.5">{label}</dt>
      <dd className={`text-white/80 ${capitalize ? "capitalize" : ""} ${className ?? ""}`}>
        {value || <span className="text-white/30">—</span>}
      </dd>
    </div>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
