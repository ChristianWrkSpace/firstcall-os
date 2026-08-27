"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import {
  recordJobVideo,
  recordJobPhoto,
  analyzeJobPhotos,
} from "@/app/actions/scope";

const BUCKET = "job-photos";          // shared with photos — videos prefixed
const FRAME_COUNT = 8;                 // keyframes to extract per video
const FRAME_QUALITY = 0.85;            // JPEG quality for extracted frames

interface ExtractedFrame {
  blob: Blob;
  timestampSec: number;
}

interface ExtractionResult {
  frames: ExtractedFrame[];
  duration: number;
  thumbnail: Blob | null;
}

/**
 * Video uploader with client-side keyframe extraction.
 *
 * Flow:
 *   1. User picks a video (camera or library).
 *   2. Browser uses Canvas to extract FRAME_COUNT evenly-spaced keyframes.
 *   3. Original video uploaded to Supabase Storage at videos/<jobId>/<uuid>.mp4
 *   4. job_videos row recorded server-side, returns videoId.
 *   5. Each frame uploaded under <jobId>/frame-<uuid>.jpg + recorded as
 *      a job_photo with source_video_id=videoId so Argus picks them up.
 *
 * Why client-side extraction: no ffmpeg-on-Vercel headache, runs on
 * iPhone Safari, parallel processing is free on the device.
 */
export default function VideoUploader({ jobId }: { jobId: string }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [progress, setProgress] = useState<{ phase: string; pct: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onPick(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    setProgress({ phase: "Reading video…", pct: 5 });

    try {
      const supabase = createClient();
      const ext = (file.name.split(".").pop() ?? "mp4").toLowerCase();

      // 1. Try to extract frames in the browser. If extraction fails partially
      // (e.g. iPhone HEVC + flaky seeks), we still ship whatever frames we got
      // plus the original video. If it fails completely, we still upload the
      // video so nothing is lost — Argus just won't have frames to analyze.
      setProgress({ phase: "Reading video on device…", pct: 5 });
      let extracted: ExtractionResult = { frames: [], duration: 0, thumbnail: null };
      try {
        extracted = await extractFramesFromVideo(file, FRAME_COUNT);
      } catch (extractErr: any) {
        console.warn("[VideoUploader] frame extraction failed:", extractErr);
        // Soft-fail — keep the video, skip frames
      }

      setProgress({
        phase: extracted.frames.length > 0
          ? `Got ${extracted.frames.length} frames · uploading video`
          : "Uploading video (frame extraction unavailable)",
        pct: 35,
      });

      // 2. Upload original video
      const videoPath = `videos/${jobId}/${crypto.randomUUID()}.${ext}`;
      const { error: vErr } = await supabase.storage.from(BUCKET).upload(videoPath, file, {
        contentType: file.type || "video/mp4",
        upsert: false,
      });
      if (vErr) throw vErr;

      // 3. Upload thumbnail (if we got one)
      let thumbPath: string | null = null;
      if (extracted.thumbnail) {
        thumbPath = `videos/${jobId}/thumb-${crypto.randomUUID()}.jpg`;
        const { error: tErr } = await supabase.storage
          .from(BUCKET)
          .upload(thumbPath, extracted.thumbnail, { contentType: "image/jpeg", upsert: false });
        if (tErr) console.warn("[VideoUploader] thumbnail upload failed:", tErr);
      }

      // 4. Record video row → get videoId
      const recorded = await recordJobVideo({
        jobId,
        storagePath: videoPath,
        thumbnailPath: thumbPath,
        durationSec: extracted.duration || null,
      });
      if (!recorded.ok) throw new Error(recorded.error);
      const videoId = recorded.videoId;

      // 5. Upload each frame + record as a job_photo linked to the video.
      // Skip individual frame failures so one bad frame doesn't kill the lot.
      const total = extracted.frames.length;
      let done = 0;
      for (const frame of extracted.frames) {
        try {
          const framePath = `${jobId}/frame-${crypto.randomUUID()}.jpg`;
          const { error: fErr } = await supabase.storage
            .from(BUCKET)
            .upload(framePath, frame.blob, { contentType: "image/jpeg", upsert: false });
          if (fErr) throw fErr;
          await recordJobPhoto(jobId, framePath, {
            videoId,
            frameTimestampSec: frame.timestampSec,
          });
        } catch (frameErr) {
          console.warn("[VideoUploader] frame skip:", frameErr);
        }
        done += 1;
        setProgress({
          phase: `Uploading frames ${done}/${total}`,
          pct: 55 + Math.floor((done / Math.max(1, total)) * 35),
        });
      }

      // 6. Auto-analyze when we have frames. The user shouldn't have to
      // click "Analyze" separately — they recorded a video, they want
      // the scope NOW.
      if (total > 0) {
        setProgress({ phase: "Argus is analyzing…", pct: 92 });
        try {
          const analysis = await analyzeJobPhotos(jobId);
          if (analysis.error) {
            console.warn("[VideoUploader] auto-analyze failed:", analysis.error);
          }
        } catch (e) {
          console.warn("[VideoUploader] auto-analyze threw:", e);
        }
      }

      setProgress({
        phase: total > 0 ? "Done — scope updated below" : "Video saved (no frames extracted)",
        pct: 100,
      });
      setTimeout(() => {
        setProgress(null);
        if (cameraRef.current) cameraRef.current.value = "";
        if (libraryRef.current) libraryRef.current.value = "";
        router.refresh();
      }, 1100);
    } catch (err: any) {
      console.error("[VideoUploader]", err);
      setError(err?.message ?? "Video upload failed");
      setProgress(null);
    }
  }

  const pending = progress !== null;

  return (
    <div className="flex flex-col gap-1.5">
      <input
        ref={cameraRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onPick(e.target.files)}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => onPick(e.target.files)}
      />
      {pending ? (
        <div className="flex flex-col gap-1.5 px-4 py-2 bg-tint border border-edge2 rounded-lg">
          <div className="flex items-center gap-2 text-ink/85 text-sm">
            <Spinner /> {progress.phase}
          </div>
          <div className="h-1 bg-tint rounded-full overflow-hidden">
            <div
              className="h-full bg-cta transition-[width] duration-150"
              style={{ width: `${progress.pct}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="flex gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="px-4 py-2 bg-cta hover:bg-cta-deep text-white text-sm font-medium rounded-[6px] active:opacity-90 transition-colors flex items-center gap-2"
          >
            🎥 Record Video
          </button>
          <button
            type="button"
            onClick={() => libraryRef.current?.click()}
            className="px-4 py-2 bg-tint hover:bg-shade border border-edge2 text-ink text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            📁 Upload
          </button>
        </div>
      )}
      {error && (
        <div className="px-3 py-2 bg-red-600/10 border border-red-500/30 rounded-lg">
          <p className="text-red-700 text-sm font-medium whitespace-pre-line">
            ⚠ Video upload failed
          </p>
          <p className="text-red-700/80 text-xs mt-1 whitespace-pre-line">{error}</p>
          <p className="text-red-700/60 text-[11px] mt-1.5">
            Common causes: video over 50MB (Supabase default file size limit) or weak network. Try a shorter clip or switch to wifi.
          </p>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin"
      aria-hidden
    />
  );
}

/**
 * Extracts up to `count` evenly-spaced JPEG keyframes + a thumbnail from a
 * local video file using HTMLVideoElement + Canvas. Resilient by design:
 *   • iPhone .mov / HEVC works (NO crossOrigin — that breaks blob: URLs).
 *   • Individual seek failures are skipped, not fatal.
 *   • If the whole element errors before metadata, we resolve empty and
 *     let the caller upload the original video without frames.
 *   • Always cleans up the blob URL.
 */
async function extractFramesFromVideo(file: File, count: number): Promise<ExtractionResult> {
  const url = URL.createObjectURL(file);
  const cleanup = () => {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  };

  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  // Critical: no crossOrigin on blob: URLs — Safari treats it as a CORS
  // violation and refuses to decode iPhone .mov files.
  video.src = url;

  // Wait for metadata. Reject after a generous timeout so we never hang.
  const ready = await new Promise<"ok" | "fail">((resolve) => {
    const ok = () => {
      cleanupHandlers();
      resolve("ok");
    };
    const fail = () => {
      cleanupHandlers();
      resolve("fail");
    };
    function cleanupHandlers() {
      video.removeEventListener("loadedmetadata", ok);
      video.removeEventListener("error", fail);
    }
    video.addEventListener("loadedmetadata", ok, { once: true });
    video.addEventListener("error", fail, { once: true });
    setTimeout(() => {
      cleanupHandlers();
      resolve("fail");
    }, 12_000);
  });

  if (ready === "fail") {
    cleanup();
    return { frames: [], duration: 0, thumbnail: null };
  }

  // Some browsers report 0 / Infinity until canplaythrough fires
  if (!isFinite(video.duration) || video.duration <= 0) {
    await new Promise<void>((r) => {
      const onPlayable = () => {
        video.removeEventListener("canplaythrough", onPlayable);
        r();
      };
      video.addEventListener("canplaythrough", onPlayable, { once: true });
      setTimeout(r, 3000);
    });
  }

  const duration = isFinite(video.duration) && video.duration > 0 ? video.duration : 5;
  const interval = duration / (count + 1);

  // Cap output dim — never ship 4K frames to the API
  const maxDim = 1568;
  const w0 = video.videoWidth || 1280;
  const h0 = video.videoHeight || 720;
  const ratio = Math.min(1, maxDim / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * ratio));
  const h = Math.max(1, Math.round(h0 * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    cleanup();
    return { frames: [], duration, thumbnail: null };
  }

  // Thumbnail = ~5% into the video (avoids the all-black opening frame
  // some videos start with). Best-effort — null on failure.
  let thumbnail: Blob | null = null;
  try {
    await seekTo(video, Math.min(0.25, duration * 0.05));
    ctx.drawImage(video, 0, 0, w, h);
    thumbnail = await canvasToJpegBlob(canvas, FRAME_QUALITY);
  } catch {
    // ignore — thumbnail is optional
  }

  const frames: ExtractedFrame[] = [];
  for (let i = 1; i <= count; i++) {
    const t = Math.min(i * interval, Math.max(0, duration - 0.05));
    try {
      await seekTo(video, t);
      ctx.drawImage(video, 0, 0, w, h);
      const blob = await canvasToJpegBlob(canvas, FRAME_QUALITY);
      if (blob && blob.size > 1024) {
        frames.push({ blob, timestampSec: t });
      }
    } catch (err) {
      console.warn(`[VideoUploader] frame at ${t.toFixed(1)}s failed, skipping:`, err);
      // Continue — one bad seek shouldn't kill the whole extraction
    }
  }

  cleanup();
  return { frames, duration, thumbnail };
}

/**
 * Seek with a hard timeout so a bad codec frame can't hang us forever.
 * Resolves on `seeked`, rejects on `error` or after 4s.
 */
function seekTo(video: HTMLVideoElement, seconds: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const onSeeked = () => {
      if (settled) return;
      settled = true;
      cleanupHandlers();
      resolve();
    };
    const onErr = () => {
      if (settled) return;
      settled = true;
      cleanupHandlers();
      reject(new Error("Seek failed"));
    };
    function cleanupHandlers() {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onErr);
    }
    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onErr, { once: true });
    video.currentTime = seconds;
    setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanupHandlers();
      reject(new Error("Seek timeout"));
    }, 4000);
  });
}

function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality)
  );
}
