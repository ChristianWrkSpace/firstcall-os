import { NextRequest, NextResponse } from "next/server";
import { performBackup } from "@/lib/backups";
import { authorizeCronRequest } from "@/lib/cron-auth";

// Vercel Cron triggers this Sunday 03:00 UTC (see vercel.json).
// Logical export of operational tables to private Storage bucket — defense
// in depth on top of Supabase point-in-time recovery, not a replacement.

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const auth = authorizeCronRequest(req.headers.get("authorization"), process.env.CRON_SECRET);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
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
