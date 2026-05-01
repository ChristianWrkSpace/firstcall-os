"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// One-tap voice note. Uses MediaRecorder (built into browsers; no library).
// Records → uploads → /api/notes/voice transcribes via Deepgram → saves
// as job_notes row. Field tech keeps gloves on, hands-free typing replaced
// with a single button.

type RecState = "idle" | "asking_permission" | "recording" | "uploading" | "done" | "error";

export default function VoiceNote({ jobId }: { jobId: string }) {
  const [state, setState] = useState<RecState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      // Stop any active stream tracks on unmount
      const r = recorderRef.current;
      if (r && r.state !== "inactive") {
        r.stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  async function start() {
    setError(null);
    setTranscript(null);
    setState("asking_permission");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: pickMimeType(),
      });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        // Free mic
        recorder.stream.getTracks().forEach((t) => t.stop());
        await upload(new Blob(chunksRef.current, { type: recorder.mimeType }));
      };
      recorder.start();
      recorderRef.current = recorder;
      startTimeRef.current = Date.now();
      setElapsed(0);
      tickRef.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 250);
      setState("recording");
    } catch (err: any) {
      setState("error");
      setError(
        err?.name === "NotAllowedError"
          ? "Microphone permission denied. Enable it in your browser settings."
          : err?.message ?? "Could not access microphone."
      );
    }
  }

  function stop() {
    const r = recorderRef.current;
    if (!r) return;
    if (r.state !== "inactive") r.stop();
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setState("uploading");
  }

  async function upload(blob: Blob) {
    try {
      if (blob.size === 0) {
        setState("error");
        setError("Recording was empty.");
        return;
      }
      const fd = new FormData();
      fd.append("audio", blob, `voice-note.${blob.type.includes("ogg") ? "ogg" : "webm"}`);
      fd.append("job_id", jobId);
      const res = await fetch("/api/notes/voice", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setState("error");
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setTranscript(data.transcript);
      setState("done");
      // Refresh the page so the new note shows up in the activity / notes list
      router.refresh();
    } catch (err: any) {
      setState("error");
      setError(err?.message ?? "Upload failed.");
    }
  }

  function reset() {
    setState("idle");
    setError(null);
    setTranscript(null);
    setElapsed(0);
  }

  if (state === "done" && transcript) {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
        <p className="text-green-300 text-xs font-semibold uppercase tracking-wide">
          ✓ Voice note saved
        </p>
        <p className="text-zinc-200 text-sm mt-2 leading-snug whitespace-pre-wrap">
          {transcript}
        </p>
        <button
          onClick={reset}
          className="mt-3 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded-lg"
        >
          + New voice note
        </button>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
        <p className="text-red-300 text-sm">{error ?? "Something went wrong."}</p>
        <button
          onClick={reset}
          className="mt-3 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded-lg"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {state === "idle" || state === "asking_permission" ? (
        <button
          onClick={start}
          disabled={state === "asking_permission"}
          className="flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg min-h-[48px]"
        >
          <span className="text-base leading-none">🎤</span>
          <span>
            {state === "asking_permission" ? "Asking permission…" : "Voice note"}
          </span>
        </button>
      ) : state === "recording" ? (
        <button
          onClick={stop}
          className="flex items-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg min-h-[48px] animate-pulse"
        >
          <span className="text-base leading-none">⏹</span>
          <span>Stop ({fmtTime(elapsed)})</span>
        </button>
      ) : state === "uploading" ? (
        <div className="flex items-center gap-2 px-4 py-3 bg-zinc-800 text-zinc-300 text-sm font-medium rounded-lg min-h-[48px]">
          <span className="text-base leading-none">⏳</span>
          <span>Transcribing…</span>
        </div>
      ) : null}
      <p className="text-zinc-500 text-[11px]">
        Records your voice → AI transcribes → saves to job notes.
      </p>
    </div>
  );
}

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "audio/webm";
}

function fmtTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
