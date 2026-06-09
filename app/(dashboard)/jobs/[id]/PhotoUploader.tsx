"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase";
import { recordJobPhoto } from "@/app/actions/scope";
import { useRouter } from "next/navigation";

const BUCKET = "job-photos";

export default function PhotoUploader({ jobId }: { jobId: string }) {
  // Two separate inputs so the tech gets a real CHOICE on mobile:
  //   • cameraRef: capture="environment" opens the rear camera directly
  //   • libraryRef: standard file picker, lets them pick from gallery
  // On desktop, capture="environment" is ignored — both behave like a file picker.
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
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
    if (cameraRef.current) cameraRef.current.value = "";
    if (libraryRef.current) libraryRef.current.value = "";
    router.refresh();
  }

  const pending = progress !== null;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Direct-to-camera (mobile rear cam). Hidden — triggered by the Take Photo button. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onPick(e.target.files)}
      />
      {/* Library / gallery picker (multi-select). */}
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onPick(e.target.files)}
      />
      {pending ? (
        <button
          type="button"
          disabled
          className="px-4 py-2 bg-shade border border-edge2 opacity-50 text-ink text-sm rounded-lg flex items-center gap-2"
        >
          <Spinner /> Uploading {progress!.done}/{progress!.total}…
        </button>
      ) : (
        <div className="flex gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="px-4 py-2 bg-cta hover:bg-cta-deep text-white text-sm rounded-lg transition-colors flex items-center gap-2"
          >
            📷 Take Photo
          </button>
          <button
            type="button"
            onClick={() => libraryRef.current?.click()}
            className="px-4 py-2 bg-shade hover:bg-shade border border-edge2 text-ink text-sm rounded-lg transition-colors flex items-center gap-2"
          >
            <UploadIcon className="w-4 h-4" /> Upload
          </button>
        </div>
      )}
      {error && <p className="text-red-700 text-xs whitespace-pre-line">{error}</p>}
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
