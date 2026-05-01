import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const KIND_EMOJI: Record<string, string> = {
  estimate_draft: "📋",
  legal_doc_draft: "⚖️",
  invoice_draft: "💵",
  drying_cert_draft: "🌡",
  demand_letter_draft: "📨",
  status_suggestion: "🚦",
  referral_attribution: "🤝",
};

export default async function NotificationBell() {
  // Pull count + 5 latest items in one round-trip. The popover shows them
  // inline so the office doesn't have to click through to see what's
  // pending. Keeps the data slim — no body, no metadata.
  const supabase = await createServerSupabaseClient();
  const [{ count }, { data: items }] = await Promise.all([
    supabase
      .from("pending_approvals")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("pending_approvals")
      .select("id, kind, title, link, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const n = count ?? 0;
  const list = items ?? [];

  return (
    <details className="hidden md:block fixed top-4 right-20 z-30 group">
      <summary className="list-none cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors">
        <span className="text-base leading-none">🔔</span>
        {n > 0 ? (
          <span className="text-xs font-mono font-semibold text-blue-400">
            {n}
          </span>
        ) : (
          <span className="text-xs text-zinc-500">0</span>
        )}
      </summary>

      <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <p className="text-white text-sm font-semibold">Pending approvals</p>
          {n > 0 && (
            <span className="text-blue-400 text-xs font-mono">
              {n} waiting
            </span>
          )}
        </div>
        {list.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-zinc-400 text-sm">
              ✓ Caught up. The agents have nothing for you to review.
            </p>
          </div>
        ) : (
          <ul className="max-h-96 overflow-y-auto">
            {list.map((it: any) => (
              <li
                key={it.id}
                className="border-b border-zinc-800/60 last:border-0"
              >
                <Link
                  href={it.link ?? "/approvals"}
                  className="block px-4 py-3 hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg shrink-0 leading-none mt-0.5">
                      {KIND_EMOJI[it.kind] ?? "•"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-zinc-100 text-sm truncate">
                        {it.title}
                      </p>
                      <p className="text-zinc-500 text-[11px] mt-0.5">
                        {new Date(it.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="px-4 py-2 border-t border-zinc-800 flex items-center justify-between text-xs">
          <Link
            href="/approvals"
            className="text-blue-400 hover:text-blue-300"
          >
            All approvals →
          </Link>
          <Link
            href="/activity"
            className="text-zinc-400 hover:text-white"
          >
            Activity feed
          </Link>
        </div>
      </div>
    </details>
  );
}

export { KIND_EMOJI };
