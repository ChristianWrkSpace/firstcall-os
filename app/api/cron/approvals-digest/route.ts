import { NextRequest, NextResponse } from "next/server";
import { runApprovalsDigest } from "@/lib/approvals-digest";

// Daily digest of stale approvals (>48h) + failed legal-doc sends.
// Triggered by Vercel Cron (vercel.json). Sends email to OPERATOR_EMAIL
// if anything to report; always emits a heartbeat to /activity.

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runApprovalsDigest();
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("[approvals-digest]", err);
    return NextResponse.json(
      { error: err?.message ?? "Digest failed" },
      { status: 500 }
    );
  }
}
