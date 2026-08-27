import { NextRequest, NextResponse } from "next/server";
import { reconcileAccountActiveTransitions } from "@/lib/account-active-transitions";
import { authorizeCronRequest } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const auth = authorizeCronRequest(
    request.headers.get("authorization"),
    process.env.CRON_SECRET
  );
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const summary = await reconcileAccountActiveTransitions({ apply: true, limit: 25 });
    return NextResponse.json({ ok: true, ...summary });
  } catch {
    return NextResponse.json(
      { error: "Account transition reconciliation failed." },
      { status: 500 }
    );
  }
}
