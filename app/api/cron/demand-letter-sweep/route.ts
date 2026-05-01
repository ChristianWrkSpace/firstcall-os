import { NextRequest, NextResponse } from "next/server";
import { sweepOverdueInvoicesForDemandLetters } from "@/lib/auto-triggers";

// Daily sweep — drafts demand letters for invoices 60+ days unpaid.
// Esquire generates each draft; office reviews via /approvals before send.
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
    const result = await sweepOverdueInvoicesForDemandLetters();
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("[demand-letter-sweep]", err);
    return NextResponse.json(
      { error: err?.message ?? "Sweep failed" },
      { status: 500 }
    );
  }
}
