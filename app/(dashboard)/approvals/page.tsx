import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getDataCutoff } from "@/lib/data-cutoff";
import Link from "next/link";
import { DismissButton, ApplySuggestionButton } from "./ApprovalActions";
import { KIND_EMOJI } from "../NotificationBell";
import { PageShell, Glass, Band, EmptyState } from "@/components/ui/Glass";

const KIND_LABEL: Record<string, string> = {
  estimate_draft: "Estimate ready for review",
  legal_doc_draft: "Legal doc drafted",
  invoice_draft: "Invoice draft created",
  drying_cert_draft: "Drying certificate drafted",
  demand_letter_draft: "Demand letter drafted",
  status_suggestion: "Status change suggestion",
  referral_attribution: "Referral attribution",
};

export default async function ApprovalsPage() {
  const supabase = await createServerSupabaseClient();
  const cutoff = getDataCutoff();

  let pendingQuery = supabase
    .from("pending_approvals")
    .select("id, kind, job_id, entity_type, entity_id, title, detail, link, source, status, created_at, metadata")
    .in("status", ["pending"])
    .order("created_at", { ascending: false });
  if (cutoff) pendingQuery = pendingQuery.gte("created_at", cutoff);

  let recentQuery = supabase
    .from("pending_approvals")
    .select("id, kind, title, status, created_at, resolved_at")
    .in("status", ["approved", "rejected"])
    .order("resolved_at", { ascending: false })
    .limit(10);
  if (cutoff) recentQuery = recentQuery.gte("created_at", cutoff);

  const [{ data: pending }, { data: recent }] = await Promise.all([
    pendingQuery,
    recentQuery,
  ]);

  const items = pending ?? [];

  return (
    <PageShell
      eyebrow="Hand-offs"
      title="Approval Inbox"
      subtitle={
        items.length > 0
          ? `${items.length} waiting on you — agents draft, you decide`
          : "Drafts the agents created for you, in one feed to scan"
      }
    >
      {items.length === 0 ? (
        <EmptyState icon="✓" title="No pending approvals.">
          The agents are caught up.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((it: any, i: number) => (
            <Glass
              key={it.id}
              accent={it.kind === "status_suggestion" ? "amber" : "neutral"}
              className="p-5 flex gap-4 items-start animate-rise-in"
            >
              <div className="text-2xl shrink-0">{KIND_EMOJI[it.kind] ?? "•"}</div>
              <div className="flex-1 min-w-0">
                <p className="text-white/40 text-[10px] uppercase tracking-[0.15em] font-semibold">
                  {KIND_LABEL[it.kind] ?? it.kind}
                </p>
                <p className="text-white/95 font-semibold tracking-tight mt-1">{it.title}</p>
                {it.detail && (
                  <p className="text-white/50 text-sm mt-1.5 leading-snug">{it.detail}</p>
                )}
                <div className="flex gap-3 mt-3 flex-wrap items-center">
                  {it.link && (
                    <Link
                      href={it.link}
                      className="text-[#A8DCD3] hover:text-white text-xs font-medium transition-colors"
                    >
                      Review →
                    </Link>
                  )}
                  {it.job_id && (
                    <Link
                      href={`/jobs/${it.job_id}`}
                      className="text-white/45 hover:text-white text-xs transition-colors"
                    >
                      Open job
                    </Link>
                  )}
                  <span className="text-white/30 text-xs">
                    {new Date(it.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="shrink-0">
                {it.kind === "status_suggestion" ? (
                  <ApplySuggestionButton approvalId={it.id} />
                ) : (
                  <DismissButton approvalId={it.id} hasUnderlying={!!it.entity_id} />
                )}
              </div>
            </Glass>
          ))}
        </div>
      )}

      {(recent?.length ?? 0) > 0 && (
        <div className="mt-8">
          <Band label="Recently resolved">
            <ul className="flex flex-col gap-1">
              {recent!.map((r: any) => (
                <li key={r.id} className="text-white/45 text-xs flex justify-between gap-3">
                  <span className="truncate">
                    <span className="text-white/60">{KIND_EMOJI[r.kind] ?? "•"}</span> {r.title}
                  </span>
                  <span className="shrink-0 text-white/30">
                    {r.status} · {new Date(r.resolved_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          </Band>
        </div>
      )}
    </PageShell>
  );
}
