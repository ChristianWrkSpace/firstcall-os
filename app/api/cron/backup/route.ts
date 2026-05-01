import { NextRequest, NextResponse } from "next/server";
import { performBackup } from "@/lib/backups";

// Vercel Cron triggers this Sunday 03:00 UTC (see vercel.json).
// Logical export of operational tables to private Storage bucket — defense
// in depth on top of Supabase point-in-time recovery, not a replacement.

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // not configured yet — first-deploy convenience
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await performBackup("cron", null);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[backup.cron]", err);
    return NextResponse.json(
      { error: err?.message ?? "Backup failed" },
      { status: 500 }
    );
  }
}
