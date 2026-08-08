import { NextRequest, NextResponse } from "next/server";
import { sweepOverdueInvoicesForDemandLetters } from "@/lib/auto-triggers";
import { authorizeCronRequest } from "@/lib/cron-auth";

// Daily sweep — drafts demand letters for invoices 60+ days unpaid.
// Esquire generates each draft; office reviews via /approvals before send.
// Triggered by Vercel Cron (vercel.json).

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const auth = authorizeCronRequest(req.headers.get("authorization"), process.env.CRON_SECRET);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
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
