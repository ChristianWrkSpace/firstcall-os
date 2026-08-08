import { NextRequest, NextResponse } from "next/server";
import { runApprovalsDigest } from "@/lib/approvals-digest";
import { authorizeCronRequest } from "@/lib/cron-auth";

// Daily digest of stale approvals (>48h) + failed legal-doc sends.
// Triggered by Vercel Cron (vercel.json). Sends email to OPERATOR_EMAIL
// if anything to report; always emits a heartbeat to /activity.

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const auth = authorizeCronRequest(req.headers.get("authorization"), process.env.CRON_SECRET);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
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
