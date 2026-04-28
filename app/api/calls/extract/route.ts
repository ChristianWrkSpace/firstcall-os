import { NextRequest, NextResponse } from "next/server";
import { extractFromTranscript } from "@/lib/extract";

export async function POST(req: NextRequest) {
  try {
    const { transcript } = await req.json();
    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json({ error: "Missing transcript." }, { status: 400 });
    }
    const extraction = await extractFromTranscript(transcript);
    return NextResponse.json({ transcript, extraction });
  } catch (err: any) {
    console.error("[calls/extract]", err);
    return NextResponse.json({ error: err.message ?? "Server error." }, { status: 500 });
  }
}
