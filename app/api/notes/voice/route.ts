import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { checkRateLimit, maybeSweep, LIMITS } from "@/lib/rate-limit";

// Field tech voice notes — record on phone, send here, get transcribed via
// Deepgram, save as a job_notes row tagged [Voice]. Frees the tech's hands
// while their gloves are on. ~5-10 second turnaround on Deepgram nova-3.

export const runtime = "nodejs";
export const maxDuration = 60;

async function transcribeAudio(
  audioBuffer: ArrayBuffer,
  mimeType: string
): Promise<string> {
  const res = await fetch(
    "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true",
    {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": mimeType,
      },
      body: audioBuffer,
    }
  );
  if (!res.ok) {
    throw new Error(`Deepgram error: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    // Rate limit so a hot mic / runaway script doesn't burn Deepgram credits
    maybeSweep();
    const limit = checkRateLimit({
      key: `ai:${user.id}:voicenote`,
      ...LIMITS.ai_call,
    });
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Rate limit hit — wait a minute, then try again." },
        { status: 429 }
      );
    }

    const form = await req.formData();
    const audio = form.get("audio") as File | null;
    const jobId = form.get("job_id") as string | null;
    if (!audio || !jobId) {
      return NextResponse.json(
        { error: "Missing audio or job_id." },
        { status: 400 }
      );
    }
    if (audio.size === 0) {
      return NextResponse.json(
        { error: "Audio recording was empty." },
        { status: 400 }
      );
    }
    if (audio.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Audio too large (>25MB). Keep notes under ~10 minutes." },
        { status: 413 }
      );
    }

    const buffer = await audio.arrayBuffer();
    const mimeType = audio.type || "audio/webm";

    let transcript = "";
    try {
      transcript = await transcribeAudio(buffer, mimeType);
    } catch (err: any) {
      return NextResponse.json(
        { error: `Transcription failed: ${err.message ?? err}` },
        { status: 500 }
      );
    }

    if (!transcript.trim()) {
      return NextResponse.json(
        { error: "No speech detected. Try recording closer to your mouth." },
        { status: 422 }
      );
    }

    const admin = createAdminClient();

    // Save the audio file in Supabase Storage so the office can replay if needed
    const filename = `voice-note-${jobId}-${Date.now()}.webm`;
    const storagePath = `voice-notes/${jobId}/${filename}`;
    const { error: uploadError } = await admin.storage
      .from("job-photos") // reuse existing private bucket; the path namespaces it
      .upload(storagePath, buffer, {
        contentType: mimeType,
        cacheControl: "no-cache",
        upsert: false,
      });
    // Non-fatal if upload fails — transcript is the primary value
    if (uploadError) {
      console.warn("[voice-note.upload]", uploadError.message);
    }

    // Save as a job note tagged [Voice]
    const { error: noteErr } = await admin.from("job_notes").insert({
      job_id: jobId,
      author_id: user.id,
      content: `[Voice note] ${transcript.trim()}`,
      type: "note",
    });
    if (noteErr) {
      return NextResponse.json({ error: noteErr.message }, { status: 500 });
    }

    // Audit log so /activity surfaces it
    await admin.from("audit_logs").insert({
      user_id: user.id,
      user_name: user.name,
      action: "job.voice_note_added",
      entity_type: "job",
      entity_id: jobId,
      details: {
        transcript_chars: transcript.length,
        storage_path: uploadError ? null : storagePath,
      },
    });

    return NextResponse.json({
      ok: true,
      transcript: transcript.trim(),
      length: transcript.length,
    });
  } catch (err: any) {
    console.error("[voice-note]", err);
    return NextResponse.json(
      { error: err?.message ?? "Voice note save failed" },
      { status: 500 }
    );
  }
}
