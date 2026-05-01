"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { recordJobVideo, recordJobPhoto } from "@/app/actions/scope";

const BUCKET = "job-photos";          // shared with photos — videos prefixed
const FRAME_COUNT = 8;                 // keyframes to extract per video
const FRAME_QUALITY = 0.85;            // JPEG quality for extracted frames

interface ExtractedFrame {
  blob: Blob;
  timestampSec: number;
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
      // 1. Extract frames + thumbnail + duration in the browser
      const { frames, duration, thumbnail } = await extractFramesFromVideo(file, FRAME_COUNT);
      setProgress({ phase: `Extracted ${frames.length} frames`, pct: 35 });

      // 2. Upload original video
      const supabase = createClient();
      const ext = (file.name.split(".").pop() ?? "mp4").toLowerCase();
      const videoPath = `videos/${jobId}/${crypto.randomUUID()}.${ext}`;
      const { error: vErr } = await supabase.storage.from(BUCKET).upload(videoPath, file, {
        contentType: file.type || "video/mp4",
        upsert: false,
      });
      if (vErr) throw vErr;
      setProgress({ phase: "Uploaded video", pct: 55 });

      // 3. Upload thumbnail
      let thumbPath: string | null = null;
      if (thumbnail) {
        thumbPath = `videos/${jobId}/thumb-${crypto.randomUUID()}.jpg`;
        const { error: tErr } = await supabase.storage
          .from(BUCKET)
          .upload(thumbPath, thumbnail, { contentType: "image/jpeg", upsert: false });
        if (tErr) throw tErr;
      }

      // 4. Record video row → get videoId
      const recorded = await recordJobVideo({
        jobId,
        storagePath: videoPath,
        thumbnailPath: thumbPath,
        durationSec: duration,
      });
      if (!recorded.ok) throw new Error(recorded.error);
      const videoId = recorded.videoId;

      // 5. Upload each frame + record as a job_photo linked to the video
      let done = 0;
      for (const frame of frames) {
        const framePath = `${jobId}/frame-${crypto.randomUUID()}.jpg`;
        const { error: fErr } = await supabase.storage
          .from(BUCKET)
          .upload(framePath, frame.blob, { contentType: "image/jpeg", upsert: false });
        if (fErr) throw fErr;

        const fr = await recordJobPhoto(jobId, framePath, {
          videoId,
          frameTimestampSec: frame.timestampSec,
        });
        if (fr.error) throw new Error(fr.error);

        done += 1;
        setProgress({
          phase: `Uploading frames ${done}/${frames.length}`,
          pct: 55 + Math.floor((done / frames.length) * 45),
        });
      }

      setProgress({ phase: "Done — Argus can now analyze", pct: 100 });
      setTimeout(() => {
        setProgress(null);
        if (cameraRef.current) cameraRef.current.value = "";
        if (libraryRef.current) libraryRef.current.value = "";
        router.refresh();
      }, 800);
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
        <div className="flex flex-col gap-1.5 px-4 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg">
          <div className="flex items-center gap-2 text-white/85 text-sm">
            <Spinner /> {progress.phase}
          </div>
          <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#6B8AD9] to-[#5FBDB0] transition-all duration-300"
              style={{ width: `${progress.pct}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="flex gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="px-4 py-2 bg-gradient-to-br from-[#6B8AD9] to-[#5FBDB0] text-white text-sm font-medium rounded-lg shadow-[0_0_18px_rgba(95,189,176,0.25)] active:opacity-90 transition-opacity flex items-center gap-2"
          >
            🎥 Record Video
          </button>
          <button
            type="button"
            onClick={() => libraryRef.current?.click()}
            className="px-4 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            📁 Upload
          </button>
        </div>
      )}
      {error && <p className="text-red-400 text-xs whitespace-pre-line">{error}</p>}
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
 * Extracts FRAME_COUNT evenly-spaced JPEG keyframes + a thumbnail (first
 * frame) from a local video file using the HTMLVideoElement + Canvas APIs.
 * Resolves to the array of frame blobs with their timestamps + the
 * thumbnail blob + the video's duration in seconds.
 *
 * Works on iPhone Safari (16+), Android Chrome, all modern desktop.
 */
async function extractFramesFromVideo(
  file: File,
  count: number
): Promise<{ frames: ExtractedFrame[]; duration: number; thumbnail: Blob | null }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    const url = URL.createObjectURL(file);
    video.src = url;

    const cleanup = () => URL.revokeObjectURL(url);

    video.onloadedmetadata = async () => {
      try {
        const duration = isFinite(video.duration) ? video.duration : 0;
        // Some browsers report 0 until the video can play through — wait briefly
        if (duration === 0) {
          await new Promise<void>((r) => {
            const onPlayable = () => {
              video.removeEventListener("canplaythrough", onPlayable);
              r();
            };
            video.addEventListener("canplaythrough", onPlayable);
            // Hard timeout in case onevent never fires
            setTimeout(r, 1500);
          });
        }
        const finalDuration = isFinite(video.duration) && video.duration > 0 ? video.duration : 5;
        const interval = finalDuration / (count + 1);

        // Cap output dim so we don't ship 4K frames to the API
        const maxDim = 1568;
        const w0 = video.videoWidth || 1280;
        const h0 = video.videoHeight || 720;
        const ratio = Math.min(1, maxDim / Math.max(w0, h0));
        const w = Math.round(w0 * ratio);
        const h = Math.round(h0 * ratio);

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D context unavailable");

        // Thumbnail = first quarter-second frame
        await seekTo(video, Math.min(0.25, finalDuration * 0.05));
        ctx.drawImage(video, 0, 0, w, h);
        const thumbnail = await canvasToJpegBlob(canvas, FRAME_QUALITY);

        const frames: ExtractedFrame[] = [];
        for (let i = 1; i <= count; i++) {
          const t = Math.min(i * interval, finalDuration - 0.05);
          await seekTo(video, t);
          ctx.drawImage(video, 0, 0, w, h);
          const blob = await canvasToJpegBlob(canvas, FRAME_QUALITY);
          if (blob) frames.push({ blob, timestampSec: t });
        }

        cleanup();
        resolve({ frames, duration: finalDuration, thumbnail });
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Could not decode video — try a different format (MP4 / MOV / WebM)."));
    };
  });
}

function seekTo(video: HTMLVideoElement, seconds: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    const onErr = () => {
      video.removeEventListener("error", onErr);
      reject(new Error("Seek failed"));
    };
    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onErr, { once: true });
    video.currentTime = seconds;
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
