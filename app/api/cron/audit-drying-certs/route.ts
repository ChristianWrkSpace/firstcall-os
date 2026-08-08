import { NextRequest, NextResponse } from "next/server";
import { auditDryingCertAutoDrafts } from "@/lib/audit-drying-certs";
import { authorizeCronRequest } from "@/lib/cron-auth";

// Weekly heartbeat: verifies the drying-cert auto-trigger is firing.
// Logs result to audit_logs (visible in /activity). Empty findings = green.
// Triggered by Vercel Cron (vercel.json).

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const auth = authorizeCronRequest(req.headers.get("authorization"), process.env.CRON_SECRET);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
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
