"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase";
import { recordJobPhoto } from "@/app/actions/scope";
import { useRouter } from "next/navigation";

const BUCKET = "job-photos";

export default function PhotoUploader({ jobId }: { jobId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onPick(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const list = Array.from(files);
    setProgress({ done: 0, total: list.length });

    const supabase = createClient();
    let done = 0;
    const failures: string[] = [];

    for (const file of list) {
      try {
        const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
        const path = `${jobId}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });
        if (uploadErr) throw uploadErr;

        const recorded = await recordJobPhoto(jobId, path);
        if (recorded.error) throw new Error(recorded.error);
      } catch (err: any) {
        failures.push(`${file.name}: ${err.message ?? "upload failed"}`);
      }

      done += 1;
      setProgress({ done, total: list.length });
    }

    if (failures.length) setError(failures.join("\n"));
    setProgress(null);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  const pending = progress !== null;

  return (
    <div className="flex flex-col gap-1.5">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onPick(e.target.files)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
      >
        {pending ? (
          <>
            <Spinner /> Uploading {progress!.done}/{progress!.total}…
          </>
        ) : (
          <>
            <UploadIcon className="w-4 h-4" /> Upload Photos
          </>
        )}
      </button>
      {error && <p className="text-red-400 text-xs whitespace-pre-line">{error}</p>}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 7.5m0 0L7.5 12M12 7.5v9" />
    </svg>
  );
}
