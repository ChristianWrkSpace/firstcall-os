import { NextRequest, NextResponse } from "next/server";
import { auditDryingCertAutoDrafts } from "@/lib/audit-drying-certs";

// Weekly heartbeat: verifies the drying-cert auto-trigger is firing.
// Logs result to audit_logs (visible in /activity). Empty findings = green.
// Triggered by Vercel Cron (vercel.json).

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
    const result = await auditDryingCertAutoDrafts();
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("[audit-drying-certs]", err);
    return NextResponse.json(
      { error: err?.message ?? "Audit failed" },
      { status: 500 }
    );
  }
}
