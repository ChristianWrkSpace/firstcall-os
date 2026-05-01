"use server";

import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase-server";
import { assessScope, type ScopeImage, type DispatchInputs } from "@/lib/argus";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { autoDraftEstimate } from "@/lib/auto-triggers";
import { logAgentOutcome } from "@/lib/agent-feedback";

const BUCKET = "job-photos";

export async function saveDispatchInputs(jobId: string, inputs: DispatchInputs) {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await admin
    .from("jobs")
    .update({ dispatch_inputs: inputs })
    .eq("id", jobId);
  if (error) return { error: error.message };

  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

export async function recordJobPhoto(
  jobId: string,
  storagePath: string,
  source?: { videoId?: string; frameTimestampSec?: number }
) {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error: dbErr } = await admin.from("job_photos").insert({
    job_id: jobId,
    storage_path: storagePath,
    uploaded_by: user.id,
    source_video_id: source?.videoId ?? null,
    frame_timestamp_sec: source?.frameTimestampSec ?? null,
  });
  if (dbErr) {
    console.error("[recordJobPhoto]", dbErr);
    return { error: dbErr.message };
  }

  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

/**
 * Record a job_videos row after the client has uploaded the original
 * video + thumbnail to Supabase Storage. Returns the new id so the
 * caller can link extracted frames to it via recordJobPhoto.
 */
export async function recordJobVideo(args: {
  jobId: string;
  storagePath: string;
  thumbnailPath?: string | null;
  durationSec?: number | null;
}) {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data, error } = await admin
    .from("job_videos")
    .insert({
      job_id: args.jobId,
      storage_path: args.storagePath,
      thumbnail_path: args.thumbnailPath ?? null,
      duration_sec: args.durationSec ?? null,
      uploaded_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[recordJobVideo]", error);
    return { error: error?.message ?? "Could not record video." };
  }

  revalidatePath(`/jobs/${args.jobId}`);
  return { ok: true as const, videoId: data.id };
}

export async function analyzeJobPhotos(jobId: string) {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  try {
    const { data: job, error: jobErr } = await admin
      .from("jobs")
      .select("type, description, site_address, site_city, site_state, site_zip, dispatch_inputs, scope_assessment, scope_analyzed_at")
      .eq("id", jobId)
      .single();
    if (jobErr || !job) return { error: "Job not found." };

    // If a scope already exists, this re-analysis is a "revised" signal —
    // the user wasn't happy with what Argus produced last time.
    const wasRevision = !!job.scope_assessment;

    const { data: photos, error: photosErr } = await admin
      .from("job_photos")
      .select("storage_path")
      .eq("job_id", jobId);
    if (photosErr) throw photosErr;
    if (!photos?.length) return { error: "No photos uploaded yet." };

    // Cap images sent to the model. More images = more vision tokens + more
    // model latency. 8 evenly-spaced is plenty for a scope assessment; if
    // there are more (e.g. video frames + extra photos), pick a strided
    // subset so we still cover the whole walk-through.
    const MAX_IMAGES = 8;
    let chosenPhotos = photos;
    if (photos.length > MAX_IMAGES) {
      const stride = photos.length / MAX_IMAGES;
      chosenPhotos = Array.from({ length: MAX_IMAGES }, (_, i) =>
        photos[Math.min(photos.length - 1, Math.floor(i * stride))]
      );
    }

    // Download + Sharp-normalize all photos in parallel. Was sequential —
    // for 8 photos at ~400ms each that's 3.2s of pure waiting on a single
    // CPU core. Promise.all + per-photo failure isolation drops it to
    // roughly the slowest single download (~600ms).
    const sharp = (await import("sharp")).default;
    const downloads = await Promise.all(
      chosenPhotos.map(async (p): Promise<ScopeImage | null> => {
        try {
          const { data: blob, error: dlErr } = await admin.storage
            .from(BUCKET)
            .download(p.storage_path);
          if (dlErr || !blob) return null;
          const buf = Buffer.from(await blob.arrayBuffer());
          // Resize to max 1024px long edge — plenty for vision scope, half
          // the upload bytes vs 1568, ~30% lower vision token cost.
          const normalized = await sharp(buf)
            .rotate() // honor EXIF orientation
            .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 82 })
            .toBuffer();
          return {
            mediaType: "image/jpeg",
            data: normalized.toString("base64"),
          };
        } catch (err) {
          console.warn("[analyzeJobPhotos] skipping bad photo:", p.storage_path, err);
          return null;
        }
      })
    );
    const images: ScopeImage[] = downloads.filter(
      (i): i is ScopeImage => i !== null
    );
    if (images.length === 0) {
      return { error: "No usable photos — all downloads/decoding failed." };
    }

    const jobContext = [
      `Damage type: ${job.type}`,
      job.description ? `Caller description: ${job.description}` : null,
      job.site_address
        ? `Address: ${[job.site_address, job.site_city, job.site_state, job.site_zip].filter(Boolean).join(", ")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    const scope = await assessScope(images, jobContext, job.dispatch_inputs ?? {});

    const { error: updateErr } = await admin
      .from("jobs")
      .update({
        scope_assessment: scope,
        scope_analyzed_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    if (updateErr) throw updateErr;

    // Wire 1: Ledger drafts an estimate from the scope. Use after() so the
    // ~30s Ledger call survives the response/redirect on Vercel.
    after(() => autoDraftEstimate(jobId));

    // Recursive feedback: if a scope already existed, this re-run means the
    // user wasn't satisfied — log it so future Argus drafts learn.
    if (wasRevision) {
      after(() =>
        logAgentOutcome({
          agent: "argus",
          task: "scope_assessment",
          outcome: "revised",
          jobId,
          entityType: "job",
          entityId: jobId,
          delta: {
            previous_analyzed_at: job.scope_analyzed_at ?? null,
            had_dispatch_inputs:
              !!job.dispatch_inputs && Object.keys(job.dispatch_inputs).length > 0,
          },
          userId: user.id,
        })
      );
    }

    revalidatePath(`/jobs/${jobId}`);
    return { ok: true };
  } catch (err: any) {
    console.error("[analyzeJobPhotos]", err);
    return { error: err.message ?? "Analysis failed." };
  }
}

export async function deleteJobPhoto(photoId: string, jobId: string) {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  try {
    const { data: photo, error: fetchErr } = await admin
      .from("job_photos")
      .select("storage_path")
      .eq("id", photoId)
      .single();
    if (fetchErr || !photo) return { error: "Photo not found." };

    await admin.storage.from(BUCKET).remove([photo.storage_path]);
    await admin.from("job_photos").delete().eq("id", photoId);

    revalidatePath(`/jobs/${jobId}`);
    return { ok: true };
  } catch (err: any) {
    return { error: err.message ?? "Delete failed." };
  }
}

export async function getPhotoSignedUrl(storagePath: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60 * 60); // 1 hour
  if (error || !data) return null;
  return data.signedUrl;
}
