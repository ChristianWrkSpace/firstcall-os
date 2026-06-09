import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getDataCutoff } from "@/lib/data-cutoff";
import Link from "next/link";
import { DismissButton, ApplySuggestionButton } from "./ApprovalActions";
import { KIND_EMOJI } from "../NotificationBell";

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
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">🔔 Approval Inbox</h1>
        <p className="text-zinc-400 text-sm mt-1 max-w-2xl">
          Drafts the system created for you. Review each, approve via its
          underlying screen, or dismiss. Per the AI-native rule: agents draft;
          you decide.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <p className="text-zinc-400 text-sm">
            ✓ No pending approvals. The agents are caught up.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 mb-8">
          {items.map((it: any) => (
            <article
              key={it.id}
              className="glass-card p-5 flex gap-4 items-start"
            >
              <div className="text-2xl shrink-0">
                {KIND_EMOJI[it.kind] ?? "•"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-zinc-500 text-[10px] uppercase tracking-wide font-semibold">
                  {KIND_LABEL[it.kind] ?? it.kind}
                </p>
                <p className="text-white font-medium mt-1">{it.title}</p>
                {it.detail && (
                  <p className="text-zinc-400 text-sm mt-1.5 leading-snug">
                    {it.detail}
                  </p>
                )}
                <div className="flex gap-3 mt-3 flex-wrap">
                  {it.link && (
                    <Link
                      href={it.link}
                      className="text-blue-400 hover:underline text-xs"
                    >
                      Review →
                    </Link>
                  )}
                  {it.job_id && (
                    <Link
                      href={`/jobs/${it.job_id}`}
                      className="text-zinc-500 hover:text-zinc-300 text-xs"
                    >
                      Open job
                    </Link>
                  )}
                  <span className="text-zinc-600 text-xs">
                    {new Date(it.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="shrink-0">
                {it.kind === "status_suggestion" ? (
                  <ApplySuggestionButton approvalId={it.id} />
                ) : (
                  <DismissButton
                    approvalId={it.id}
                    hasUnderlying={!!it.entity_id}
                  />
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {(recent?.length ?? 0) > 0 && (
        <section>
          <h2 className="text-zinc-500 text-xs uppercase tracking-wide font-semibold mb-3">
            Recently resolved
          </h2>
          <ul className="flex flex-col gap-1">
            {recent!.map((r: any) => (
              <li
                key={r.id}
                className="text-zinc-500 text-xs flex justify-between gap-3"
              >
                <span className="truncate">
                  <span className="text-zinc-400">
                    {KIND_EMOJI[r.kind] ?? "•"}
                  </span>{" "}
                  {r.title}
                </span>
                <span className="shrink-0 text-zinc-600">
                  {r.status} · {new Date(r.resolved_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
