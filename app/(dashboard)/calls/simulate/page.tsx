"use client";

import { useState, useRef, useEffect, useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createJobFromCall } from "@/app/actions/calls";

type Phase = "idle" | "in_call" | "ending" | "review" | "done";

interface Turn {
  role: "user" | "assistant";
  content: string;
}

interface Extraction {
  caller_type: "customer" | "partner";
  partner?: { name: string; company?: string; phone?: string; relationship_notes?: string };
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

export default function SimulateCallPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [history, setHistory] = useState<Turn[]>([]);
  const [holding, setHolding] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [transcript, setTranscript] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const historyRef = useRef<Turn[]>([]);

  const [stability, setStability] = useState(0.55);
  const [similarity, setSimilarity] = useState(0.85);
  const [style, setStyle] = useState(0.25);
  const settingsRef = useRef({ stability, similarity, style });
  useEffect(() => {
    settingsRef.current = { stability, similarity, style };
  }, [stability, similarity, style]);

  const [submitState, submitAction, submitting] = useActionState(createJobFromCall, undefined);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    if (submitState?.ok) router.push(`/jobs/${submitState.jobId}`);
  }, [submitState, router]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function playAudio(base64: string) {
    const blob = new Blob(
      [Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))],
      { type: "audio/mp3" }
    );
    const url = URL.createObjectURL(blob);
    if (!audioRef.current) audioRef.current = new Audio();
    audioRef.current.src = url;
    audioRef.current.play();
  }

  async function startCall() {
    setError(null);
    setHistory([]);
    setPhase("in_call");
    setThinking(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Athena's opening line — no audio sent on first turn.
      const fd = new FormData();
      fd.append("history", "[]");
      fd.append("stability", String(settingsRef.current.stability));
      fd.append("similarity_boost", String(settingsRef.current.similarity));
      fd.append("style", String(settingsRef.current.style));

      const res = await fetch("/api/calls/converse", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setHistory([{ role: "assistant", content: data.ai_text }]);
      playAudio(data.ai_audio);
    } catch (err: any) {
      setError(err.message ?? "Could not start call.");
      setPhase("idle");
    } finally {
      setThinking(false);
    }
  }

  function startTalking() {
    if (!streamRef.current || thinking) return;
    setHolding(true);
    chunksRef.current = [];
    const mr = new MediaRecorder(streamRef.current, { mimeType: "audio/webm" });
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    mr.start(250);
    mediaRecorderRef.current = mr;
  }

  async function stopTalking() {
    if (!mediaRecorderRef.current) return;
    setHolding(false);

    await new Promise<void>((resolve) => {
      mediaRecorderRef.current!.addEventListener("stop", () => resolve(), { once: true });
      mediaRecorderRef.current!.stop();
    });

    if (chunksRef.current.length === 0) return;

    setThinking(true);
    try {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const fd = new FormData();
      fd.append("audio", blob, "turn.webm");
      fd.append("history", JSON.stringify(historyRef.current));
      fd.append("stability", String(settingsRef.current.stability));
      fd.append("similarity_boost", String(settingsRef.current.similarity));
      fd.append("style", String(settingsRef.current.style));

      const res = await fetch("/api/calls/converse", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setHistory((h) => [
        ...h,
        { role: "user", content: data.user_text },
        { role: "assistant", content: data.ai_text },
      ]);
      playAudio(data.ai_audio);
    } catch (err: any) {
      setError(err.message ?? "Turn failed.");
    } finally {
      setThinking(false);
    }
  }

  async function endCall() {
    setPhase("ending");
    streamRef.current?.getTracks().forEach((t) => t.stop());

    const fullTranscript = history
      .map((t) => `${t.role === "user" ? "Caller" : "Athena"}: ${t.content}`)
      .join("\n");

    try {
      const res = await fetch("/api/calls/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: fullTranscript }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setTranscript(fullTranscript);
      setExtraction(data.extraction);
      setPhase("review");
    } catch (err: any) {
      setError(err.message ?? "Extraction failed.");
      setPhase("in_call");
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="mb-6">
        <Link href="/calls" className="text-ink-3 hover:text-ink text-sm transition-colors">
          ← Calls
        </Link>
        <h1 className="text-2xl font-bold text-ink mt-2">Talk to Athena</h1>
        <p className="text-ink-2 text-sm mt-0.5">
          Test the conversational AI as if you were a customer calling in.
        </p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-400/10 border border-red-400/20 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Idle */}
      {phase === "idle" && (
        <div className="glass-card p-8 flex flex-col items-center gap-5">
          <div className="w-24 h-24 rounded-full bg-cta/20 border border-info/30 flex items-center justify-center">
            <PhoneIcon className="w-10 h-10 text-info" />
          </div>
          <button
            onClick={startCall}
            className="px-6 py-2.5 bg-cta hover:bg-cta-deep text-white text-sm font-medium rounded-lg transition-colors"
          >
            Start Call
          </button>
          <p className="text-ink-3 text-xs text-center max-w-sm">
            Athena will greet you. Then hold the mic button to talk, release to send. End the call when you have what you need.
          </p>
        </div>
      )}

      {/* Voice tuning sliders — always visible */}
      {(phase === "idle" || phase === "in_call") && (
        <div className="glass-card p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-ink-2 text-sm font-medium">Voice Tuning</h3>
            <button
              onClick={() => {
                setStability(0.55);
                setSimilarity(0.85);
                setStyle(0.25);
              }}
              className="text-ink-3 hover:text-ink-2 text-xs"
            >
              Reset
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Slider
              label="Stability"
              value={stability}
              onChange={setStability}
              hint={stability < 0.4 ? "Emotional" : stability > 0.7 ? "Monotone" : "Balanced"}
            />
            <Slider
              label="Similarity"
              value={similarity}
              onChange={setSimilarity}
              hint={similarity < 0.5 ? "Loose" : similarity > 0.85 ? "Strict" : "Balanced"}
            />
            <Slider
              label="Style"
              value={style}
              onChange={setStyle}
              hint={style < 0.2 ? "Neutral" : style > 0.5 ? "Dramatic" : "Natural"}
            />
          </div>
          <p className="text-ink-3 text-xs mt-3">
            Changes apply to the <span className="text-ink-2">next</span> response. Adjust mid-call to compare.
          </p>
        </div>
      )}

      {/* In Call */}
      {phase === "in_call" && (
        <div className="flex flex-col gap-4">
          {/* Conversation */}
          <div className="glass-card p-5 min-h-[280px] max-h-[420px] overflow-y-auto flex flex-col gap-3">
            {history.length === 0 && !thinking && (
              <p className="text-ink-3 text-sm italic text-center my-auto">
                Athena is dialing in…
              </p>
            )}
            {history.map((turn, i) => (
              <div
                key={i}
                className={`flex ${turn.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                    turn.role === "user"
                      ? "bg-cta text-white rounded-br-sm"
                      : "bg-shade text-ink rounded-bl-sm"
                  }`}
                >
                  {turn.content}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex justify-start">
                <div className="bg-shade text-ink-2 px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm">
                  <span className="inline-block animate-pulse">Athena is thinking…</span>
                </div>
              </div>
            )}
          </div>

          {/* Mic + End Call */}
          <div className="glass-card p-6 flex items-center justify-between gap-4">
            <button
              onMouseDown={startTalking}
              onMouseUp={stopTalking}
              onMouseLeave={() => holding && stopTalking()}
              onTouchStart={startTalking}
              onTouchEnd={stopTalking}
              disabled={thinking}
              className={`flex-1 py-4 rounded-lg font-medium text-ink transition-all select-none ${
                holding
                  ? "bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.5)]"
                  : "bg-cta hover:bg-cta-deep"
              } ${thinking ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              {holding ? "Listening… release to send" : thinking ? "…" : "Hold to Talk"}
            </button>
            <button
              onClick={endCall}
              className="px-5 py-4 bg-shade hover:bg-shade border border-edge2 text-ink text-sm font-medium rounded-lg transition-colors"
            >
              End Call
            </button>
          </div>
        </div>
      )}

      {/* Ending */}
      {phase === "ending" && (
        <div className="glass-card p-8 flex flex-col items-center gap-4">
          <SpinnerIcon className="w-10 h-10 text-info animate-spin" />
          <p className="text-ink font-medium">Extracting job details…</p>
        </div>
      )}

      {/* Review */}
      {phase === "review" && extraction && (
        <div className="flex flex-col gap-5">
          {extraction.job.urgency && extraction.job.urgency !== "standard" && (
            <div
              className={`px-4 py-3 rounded-lg border text-sm font-medium ${
                extraction.job.urgency === "emergency"
                  ? "bg-red-600/10 border-red-500/30 text-red-700"
                  : "bg-honey/10 border-yellow-500/30 text-honey"
              }`}
            >
              ⚠️ {extraction.job.urgency.toUpperCase()} — {extraction.summary}
            </div>
          )}

          <ReviewSection title="Customer">
            <ReviewField label="Name" value={extraction.customer.name} />
            <ReviewField label="Phone" value={extraction.customer.phone} />
            <ReviewField label="Insurance" value={extraction.customer.insurance_company} />
            <ReviewField label="Claim #" value={extraction.customer.insurance_claim_number} />
          </ReviewSection>

          <ReviewSection title="Job">
            <ReviewField label="Type" value={extraction.job.type} capitalize />
            <ReviewField label="Urgency" value={extraction.job.urgency} capitalize />
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
          </ReviewSection>

          <details className="glass-card p-5">
            <summary className="text-ink-2 text-sm cursor-pointer hover:text-ink">
              View full transcript
            </summary>
            <pre className="mt-3 text-ink-2 text-sm leading-relaxed whitespace-pre-wrap font-sans">
              {transcript}
            </pre>
          </details>

          {submitState?.error && <p className="text-red-700 text-sm">{submitState.error}</p>}

          <form action={submitAction} className="flex gap-3">
            <input type="hidden" name="extraction" value={JSON.stringify(extraction)} />
            <input type="hidden" name="transcript" value={transcript} />
            <button
              type="button"
              onClick={() => {
                setExtraction(null);
                setHistory([]);
                setPhase("idle");
              }}
              className="px-4 py-2 border border-edge2 text-ink-2 rounded-lg text-sm hover:bg-shade"
            >
              Start Over
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 bg-cta hover:bg-cta-deep disabled:opacity-50 text-white text-sm font-medium rounded-lg"
            >
              {submitting ? "Creating Job…" : "Confirm & Create Job"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-5">
      <h2 className="text-ink font-semibold mb-3">{title}</h2>
      <dl className="grid grid-cols-2 gap-3 text-sm">{children}</dl>
    </div>
  );
}

function ReviewField({
  label,
  value,
  capitalize,
}: {
  label: string;
  value?: string | null;
  capitalize?: boolean;
}) {
  return (
    <div>
      <dt className="text-ink-3 text-xs uppercase tracking-wide mb-0.5">{label}</dt>
      <dd className={`text-ink ${capitalize ? "capitalize" : ""}`}>
        {value || <span className="text-ink-3">—</span>}
      </dd>
    </div>
  );
}

function Slider({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-ink-2 text-xs uppercase tracking-wide">{label}</label>
        <span className="text-ink text-xs font-mono">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-blue-500"
      />
      {hint && <span className="text-ink-3 text-[10px]">{hint}</span>}
    </div>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
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
