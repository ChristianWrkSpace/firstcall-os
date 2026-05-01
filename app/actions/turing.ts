"use server";

import { runTuringAudit, type TuringReport } from "@/lib/turing";
import { getCurrentUser } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";

export async function generateTuringReport(
  windowDays: number = 14
): Promise<{ report?: TuringReport; error?: string }> {
  const me = await getCurrentUser();
  if (!me) return { error: "Not authenticated." };
  if (me.role !== "owner" && me.role !== "manager") {
    return { error: "Owner or manager only." };
  }

  try {
    const report = await runTuringAudit(windowDays);
    logAudit({
      user: me,
      action: "turing.audit_run",
      details: { window_days: windowDays, insight_count: report.insights.length },
    });
    return { report };
  } catch (err: any) {
    return { error: err?.message ?? "Audit failed." };
  }
}
