import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/ai";

const ATHENA_SYSTEM = `You are Athena, dispatcher for First Call Mitigation — a water/fire/mold restoration company in Austin TX.

The caller is in an emergency. They're stressed, water is everywhere, time matters. Your ONE job: get the 5 essentials and dispatch a tech FAST. Don't waste their time.

THE 5 ESSENTIALS (in order):
1. Their name
2. Callback number (in case the line drops)
3. Property address with zip
4. What's happening RIGHT NOW (water source, fire, mold, etc.)
5. Anything the tech needs to know to bring the right equipment

Once you have those 5, say: "Got it — I'm dispatching a tech now, they'll call you within 15 minutes. Hang tight." Then say: "Thanks, talk to you soon." That's the hang-up cue.

INSURANCE / CLAIM INFO: Only ask if the caller brings it up first. Otherwise we get it during the dispatch callback.

PARTNER CALLS: If they say "I'm a plumber" or "I'm calling on behalf of a customer," skip empathy and go straight to: customer name, address, what they found, customer's callback number. Done.

VOICE RULES (CRITICAL):
- Every response under 20 words. Phone calls, not essays.
- ONE question per turn. Never stack.
- Use contractions: "we'll," "you're," "I'm."
- Start with empathy ONCE, not every turn: "I'm so sorry, we'll handle this" — then move.
- If they're panicking, anchor them: "You're okay. Tech's coming. What's your address?"
- Never promise insurance coverage, costs, or arrival times beyond "within 15 minutes."

GOAL: Get them off the phone in under 90 seconds with a tech rolling.`;

interface Turn {
  role: "user" | "assistant";
  content: string;
}

async function transcribeAudio(audio: ArrayBuffer, mimeType: string): Promise<string> {
  const res = await fetch(
    "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true",
    {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": mimeType,
      },
      body: audio,
    }
  );
  if (!res.ok) throw new Error(`Deepgram STT error: ${res.status}`);
  const data = await res.json();
  return data.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? "";
}

interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
}

async function synthesizeSpeech(text: string, settings: VoiceSettings): Promise<Buffer> {
  const voiceId = process.env.ELEVENLABS_VOICE_ID ?? "EXAVITQu4vr4xnSDxMaL";
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "",
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_flash_v2_5",
        voice_settings: {
          ...settings,
          use_speaker_boost: true,
        },
      }),
    }
  );
  if (!res.ok) throw new Error(`ElevenLabs TTS error: ${res.status} ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audio = formData.get("audio") as File | null;
    const historyJson = (formData.get("history") as string) ?? "[]";
    const history: Turn[] = JSON.parse(historyJson);

    const voiceSettings: VoiceSettings = {
      stability: parseFloat((formData.get("stability") as string) ?? "0.5"),
      similarity_boost: parseFloat((formData.get("similarity_boost") as string) ?? "0.8"),
      style: parseFloat((formData.get("style") as string) ?? "0.3"),
    };

    let userText = "";

    if (audio) {
      const buf = await audio.arrayBuffer();
      userText = await transcribeAudio(buf, audio.type || "audio/webm");
      if (!userText) {
        return NextResponse.json(
          { error: "Could not understand audio." },
          { status: 422 }
        );
      }
    }

    const seedMessages: Turn[] =
      history.length === 0 && !userText
        ? [{ role: "user", content: "[Incoming call connected — greet the caller now.]" }]
        : [];

    const messages = [
      ...seedMessages,
      ...history.map((t) => ({ role: t.role, content: t.content })),
      ...(userText ? [{ role: "user" as const, content: userText }] : []),
    ];

    const completion = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 120,
      system: ATHENA_SYSTEM,
      messages,
    });

    const aiText = completion.content
      .filter((b) => b.type === "text")
      .map((b: any) => b.text)
      .join(" ")
      .trim();

    const audioBuf = await synthesizeSpeech(aiText, voiceSettings);

    return NextResponse.json({
      user_text: userText,
      ai_text: aiText,
      ai_audio: audioBuf.toString("base64"),
    });
  } catch (err: any) {
    console.error("[calls/converse]", err);
    return NextResponse.json({ error: err.message ?? "Server error." }, { status: 500 });
  }
}
