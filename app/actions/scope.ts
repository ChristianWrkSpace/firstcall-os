"use server";

import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase-server";
import { assessScope, type ScopeImage, type DispatchInputs } from "@/lib/argus";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { autoDraftEstimate } from "@/lib/auto-triggers";
import { logAgentOutcome } from "@/lib/agent-feedback";
import { requireInputs, PreconditionError } from "@/lib/agent-preconditions";

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

/**
 * Photo analysis modes. The default 'quick' mode handles 99% of jobs — it
 * smart-selects 16 representative photos so even a 100-photo job analyzes
 * in ~15-20s. 'deep' mode chunks every single photo through Argus and
 * synthesizes the partial scopes into one — slower (~60-90s) and pricier
 * (~$0.30-0.50) but covers everything for big claim-grade documentation.
 */
export type AnalyzeMode = "quick" | "deep";

const QUICK_TARGET = 16;        // photos sent to one Argus call in quick mode
const DEEP_BATCH_SIZE = 12;     // photos per parallel chunk in deep mode

export interface AnalyzeResult {
  ok?: true;
  error?: string;
  mode?: AnalyzeMode;
  photosAnalyzed?: number;
  photosTotal?: number;
}

/**
 * Pick a representative subset of photos for quick scope analysis.
 *
 * Strategy: latest 6 (current state, what the tech most recently captured)
 * + oldest 4 (initial baseline for before/after comparison) + 6 evenly
 * stride-sampled from the middle (full timeline coverage). When total ≤
 * target, just return all of them in upload order.
 */
function smartSelect<T>(photos: T[], target: number): T[] {
  if (photos.length <= target) return photos;
  const lastN = 6;
  const firstN = 4;
  const middleN = target - lastN - firstN;
  const oldest = photos.slice(0, firstN);
  const newest = photos.slice(-lastN);
  const middle = photos.slice(firstN, photos.length - lastN);
  const middleStrided: T[] = [];
  if (middle.length > 0 && middleN > 0) {
    const stride = middle.length / middleN;
    for (let i = 0; i < middleN; i++) {
      middleStrided.push(middle[Math.min(middle.length - 1, Math.floor(i * stride))]);
    }
  }
  // Dedupe (in case strides overlap when middle is short) and preserve order
  const seen = new Set<T>();
  const out: T[] = [];
  for (const p of [...oldest, ...middleStrided, ...newest]) {
    if (!seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  }
  return out;
}

async function downloadAndResizePhotos(
  admin: ReturnType<typeof createAdminClient>,
  photos: Array<{ storage_path: string }>
): Promise<ScopeImage[]> {
  const sharp = (await import("sharp")).default;
  const downloads = await Promise.all(
    photos.map(async (p): Promise<ScopeImage | null> => {
      try {
        const { data: blob, error: dlErr } = await admin.storage
          .from(BUCKET)
          .download(p.storage_path);
        if (dlErr || !blob) return null;
        const buf = Buffer.from(await blob.arrayBuffer());
        const normalized = await sharp(buf)
          .rotate()
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
  return downloads.filter((i): i is ScopeImage => i !== null);
}

export async function analyzeJobPhotos(
  jobId: string,
  mode: AnalyzeMode = "quick"
): Promise<AnalyzeResult> {
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

    // Law 1 — Bounded Inputs. Argus must have ceiling_height before scoping
    // (sqft × ceiling = airflow + dehu sizing). Water jobs additionally
    // require water_source_secured (changes mitigation plan radically).
    // Surfaced by Turing 2026-05-04: had_dispatch_inputs=false produced a
    // revised scope with stale previous_analyzed_at.
    try {
      const required = ["dispatch_inputs.ceiling_height_ft"];
      if (job.type === "water") {
        required.push("dispatch_inputs.water_source_secured");
      }
      requireInputs(
        "argus.scope_assessment",
        job,
        required,
        "Fill the Dispatch Inputs panel on the job before re-running scope analysis."
      );
    } catch (err) {
      if (err instanceof PreconditionError) {
        return { error: err.message };
      }
      throw err;
    }

    const wasRevision = !!job.scope_assessment;

    const { data: photos, error: photosErr } = await admin
      .from("job_photos")
      .select("storage_path, created_at")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true });
    if (photosErr) throw photosErr;
    if (!photos?.length) return { error: "No photos uploaded yet." };

    const jobContext = [
      `Damage type: ${job.type}`,
      job.description ? `Caller description: ${job.description}` : null,
      job.site_address
        ? `Address: ${[job.site_address, job.site_city, job.site_state, job.site_zip].filter(Boolean).join(", ")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    let scope: any;
    let photosAnalyzed = 0;

    if (mode === "deep" && photos.length > QUICK_TARGET) {
      // ── DEEP MODE: every photo gets seen ─────────────────────────────
      // Chunk into batches of DEEP_BATCH_SIZE, run Argus on each batch in
      // parallel (gets us partial scopes), then synthesize one unified
      // scope from the partials via a final Argus call. Costs ~3-5x quick
      // mode but handles 50-100 photo claim packets honestly.
      const chunks: Array<typeof photos> = [];
      for (let i = 0; i < photos.length; i += DEEP_BATCH_SIZE) {
        chunks.push(photos.slice(i, i + DEEP_BATCH_SIZE));
      }
      const partialScopes = await Promise.all(
        chunks.map(async (chunk) => {
          const images = await downloadAndResizePhotos(admin, chunk);
          if (images.length === 0) return null;
          return assessScope(images, jobContext, job.dispatch_inputs ?? {});
        })
      );
      const validPartials = partialScopes.filter((s) => s !== null);
      if (validPartials.length === 0) {
        return { error: "Deep scan failed — no chunks produced a usable scope." };
      }
      // Lazy-import to keep cold-start small
      const { synthesizeScopes } = await import("@/lib/argus");
      scope = await synthesizeScopes(validPartials as any[], jobContext);
      photosAnalyzed = photos.length;
    } else {
      // ── QUICK MODE: smart-selected 16 ────────────────────────────────
      const chosenPhotos = smartSelect(photos, QUICK_TARGET);
      const images = await downloadAndResizePhotos(admin, chosenPhotos);
      if (images.length === 0) {
        return { error: "No usable photos — all downloads/decoding failed." };
      }
      scope = await assessScope(images, jobContext, job.dispatch_inputs ?? {});
      photosAnalyzed = images.length;
    }

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
            mode,
            photosAnalyzed,
          },
          userId: user.id,
        })
      );
    }

    revalidatePath(`/jobs/${jobId}`);
    return {
      ok: true,
      mode,
      photosAnalyzed,
      photosTotal: photos.length,
    };
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
