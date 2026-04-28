"use server";

import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase-server";
import { assessScope, type ScopeImage, type DispatchInputs } from "@/lib/argus";
import { revalidatePath } from "next/cache";

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

export async function recordJobPhoto(jobId: string, storagePath: string) {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error: dbErr } = await admin.from("job_photos").insert({
    job_id: jobId,
    storage_path: storagePath,
    uploaded_by: user.id,
  });
  if (dbErr) {
    console.error("[recordJobPhoto]", dbErr);
    return { error: dbErr.message };
  }

  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

export async function analyzeJobPhotos(jobId: string) {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  try {
    const { data: job, error: jobErr } = await admin
      .from("jobs")
      .select("type, description, site_address, site_city, site_state, site_zip, dispatch_inputs")
      .eq("id", jobId)
      .single();
    if (jobErr || !job) return { error: "Job not found." };

    const { data: photos, error: photosErr } = await admin
      .from("job_photos")
      .select("storage_path")
      .eq("job_id", jobId);
    if (photosErr) throw photosErr;
    if (!photos?.length) return { error: "No photos uploaded yet." };

    // Download each photo, normalize (resize/convert to JPEG) for Claude Vision
    const sharp = (await import("sharp")).default;
    const images: ScopeImage[] = [];
    for (const p of photos) {
      const { data: blob, error: dlErr } = await admin.storage
        .from(BUCKET)
        .download(p.storage_path);
      if (dlErr || !blob) throw dlErr ?? new Error("Photo download failed");

      const buf = Buffer.from(await blob.arrayBuffer());

      // Normalize: resize to max 1568px long edge, convert to JPEG quality 85.
      // This handles HEIC, large phone photos, weird formats — Claude only sees clean JPEG.
      const normalized = await sharp(buf)
        .rotate() // honor EXIF orientation
        .resize({ width: 1568, height: 1568, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();

      images.push({ mediaType: "image/jpeg", data: normalized.toString("base64") });
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
