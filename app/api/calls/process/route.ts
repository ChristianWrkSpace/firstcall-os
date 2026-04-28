import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/ai";
import type Anthropic from "@anthropic-ai/sdk";

const EXTRACT_TOOL: Anthropic.Tool = {
  name: "extract_call_data",
  description:
    "Extract structured data from a water damage restoration call transcript.",
  input_schema: {
    type: "object",
    properties: {
      caller_type: {
        type: "string",
        enum: ["customer", "partner"],
        description:
          "Whether the caller is a direct customer or a partner/plumber referring a job.",
      },
      partner: {
        type: "object",
        description: "Only present when caller_type is 'partner'.",
        properties: {
          name: { type: "string" },
          company: { type: "string" },
          phone: { type: "string" },
          relationship_notes: {
            type: "string",
            description: "How they know us, any special terms, etc.",
          },
        },
        required: ["name"],
      },
      customer: {
        type: "object",
        properties: {
          name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          insurance_company: { type: "string" },
          insurance_claim_number: { type: "string" },
        },
        required: ["name"],
      },
      job: {
        type: "object",
        properties: {
          site_address: { type: "string" },
          site_city: { type: "string" },
          site_state: { type: "string" },
          site_zip: { type: "string" },
          type: {
            type: "string",
            enum: ["water", "fire", "mold", "storm", "other"],
          },
          description: { type: "string" },
          urgency: {
            type: "string",
            enum: ["emergency", "urgent", "standard"],
            description:
              "emergency = active flooding/life safety; urgent = same-day; standard = scheduled.",
          },
        },
        required: ["type"],
      },
      summary: {
        type: "string",
        description: "One-sentence summary of the call for the activity log.",
      },
    },
    required: ["caller_type", "customer", "job", "summary"],
  },
};

async function transcribeAudio(audioBuffer: ArrayBuffer, mimeType: string): Promise<string> {
  const res = await fetch("https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true", {
    method: "POST",
    headers: {
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
      "Content-Type": mimeType,
    },
    body: audioBuffer,
  });

  if (!res.ok) {
    throw new Error(`Deepgram error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audio = formData.get("audio") as File | null;

    if (!audio) {
      return NextResponse.json({ error: "No audio file provided." }, { status: 400 });
    }

    const audioBuffer = await audio.arrayBuffer();
    const transcript = await transcribeAudio(audioBuffer, audio.type || "audio/webm");

    if (!transcript.trim()) {
      return NextResponse.json({ error: "Could not transcribe audio — no speech detected." }, { status: 422 });
    }

    const message = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 2048,
      tools: [EXTRACT_TOOL],
      tool_choice: { type: "tool", name: "extract_call_data" },
      messages: [
        {
          role: "user",
          content: `You are a dispatcher assistant for First Call Mitigation, a water restoration company in Austin TX.

Extract all relevant information from the following call transcript to create a job record.

If the caller is a plumber or partner referring a customer, set caller_type to "partner" and capture their info separately from the customer's info.

If the caller IS the homeowner/customer directly, set caller_type to "customer".

Transcript:
${transcript}`,
        },
      ],
    });

    const toolUse = message.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json({ error: "Extraction failed." }, { status: 500 });
    }

    return NextResponse.json({
      transcript,
      extraction: toolUse.input,
    });
  } catch (err: any) {
    console.error("[calls/process]", err);
    return NextResponse.json({ error: err.message ?? "Server error." }, { status: 500 });
  }
}
