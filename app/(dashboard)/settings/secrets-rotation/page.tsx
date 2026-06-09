import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SECRETS } from "@/lib/secrets-catalog";
import MarkRotatedDialog from "./MarkRotatedDialog";

const BLAST_BADGE = {
  low:    "bg-shade text-ink-2",
  medium: "bg-honey/10 text-honey",
  high:   "bg-red-600/10 text-red-700",
};

export default async function SecretsRotationPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (me.role !== "owner" && me.role !== "manager") {
    return (
      <div className="p-8 max-w-2xl">
        <h1 className="text-2xl font-bold text-ink">Secrets Rotation</h1>
        <p className="text-ink-2 text-sm mt-2">Owner / manager only.</p>
      </div>
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data: history } = await supabase
    .from("secrets_rotation_log")
    .select("secret_name, rotated_at, notes, profiles:profiles!rotated_by(name)")
    .order("rotated_at", { ascending: false });

  // Latest rotation timestamp per secret
  const latestByName = new Map<string, { rotated_at: string; notes: string | null; by: string }>();
  for (const h of history ?? []) {
    if (!latestByName.has(h.secret_name)) {
      latestByName.set(h.secret_name, {
        rotated_at: h.rotated_at,
        notes: h.notes,
        by: (h.profiles as any)?.name ?? "—",
      });
    }
  }

  const today = Date.now();

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="mb-6">
        <Link href="/settings" className="text-ink-3 hover:text-ink text-sm">
          ← Settings
        </Link>
        <h1 className="text-2xl font-bold text-ink mt-2">🔑 Secrets Rotation</h1>
        <p className="text-ink-2 text-sm mt-1 max-w-2xl">
          Track when each API key was last rotated. Status flags appear when a
          secret is overdue against its target cadence. Rotation procedure for
          each vendor lives in the{" "}
          <Link
            href="/settings/incident-response"
            className="text-info hover:underline"
          >
            Incident Response runbook
          </Link>
          .
        </p>
      </div>

      <section className="glass-card p-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-edge2 text-ink-3 text-xs uppercase tracking-wide">
              <th className="text-left py-2">Secret</th>
              <th className="text-left py-2">Vendor</th>
              <th className="text-left py-2">Blast</th>
              <th className="text-left py-2">Cadence</th>
              <th className="text-left py-2">Last Rotated</th>
              <th className="text-left py-2">Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {SECRETS.map((s) => {
              const latest = latestByName.get(s.name);
              const ageDays = latest
                ? Math.floor(
                    (today - new Date(latest.rotated_at).getTime()) /
                      86_400_000
                  )
                : null;
              const status =
                latest == null
                  ? "never"
                  : ageDays! > s.cadence_days
                    ? "overdue"
                    : ageDays! > s.cadence_days - 14
                      ? "soon"
                      : "ok";
              const statusBadge =
                status === "overdue"
                  ? "bg-red-600/10 text-red-700"
                  : status === "soon"
                    ? "bg-honey/10 text-honey"
                    : status === "never"
                      ? "bg-shade text-ink-2"
                      : "bg-pine/10 text-pine";

              return (
                <tr
                  key={s.name}
                  className="border-b border-edge2/60 last:border-0 align-top"
                >
                  <td className="py-3 pr-3">
                    <p className="text-ink font-mono text-xs">{s.name}</p>
                    <p className="text-ink-3 text-[10px] mt-0.5 leading-snug max-w-xs">
                      {s.description}
                    </p>
                    <a
                      href={s.rotation_url}
                      target="_blank"
                      rel="noopener"
                      className="text-info hover:underline text-[10px] mt-1 inline-block"
                    >
                      Rotate at vendor →
                    </a>
                  </td>
                  <td className="py-3 pr-3 text-ink-2 text-xs">
                    {s.vendor}
                  </td>
                  <td className="py-3 pr-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] uppercase font-medium ${BLAST_BADGE[s.blast_radius]}`}
                    >
                      {s.blast_radius}
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-ink-2 text-xs">
                    Every {s.cadence_days}d
                  </td>
                  <td className="py-3 pr-3 text-ink-2 text-xs">
                    {latest
                      ? `${new Date(latest.rotated_at).toLocaleDateString()} (${ageDays}d ago)`
                      : "Never logged"}
                    {latest?.notes && (
                      <p className="text-ink-3 text-[10px] mt-0.5 italic">
                        {latest.notes}
                      </p>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] uppercase font-medium ${statusBadge}`}
                    >
                      {status}
                    </span>
                  </td>
                  <td className="py-3">
                    <MarkRotatedDialog secretName={s.name} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="glass-card p-6 mt-5">
        <h2 className="text-ink font-semibold mb-3">Rotation Steps (every secret)</h2>
        <ol className="flex flex-col gap-2 text-sm text-ink-2 list-decimal list-inside">
          <li>Log into the vendor and create a NEW key (don't delete the old one yet).</li>
          <li>
            Update Vercel env: <code className="text-info">vercel env rm SECRET_NAME production</code>{" "}
            then <code className="text-info">vercel env add SECRET_NAME production</code>.
          </li>
          <li>
            Trigger a redeploy: <code className="text-info">vercel deploy --prod --yes</code>.
          </li>
          <li>
            Verify the new key works (hit the affected feature once: send a
            test email, run an AI call, etc.).
          </li>
          <li>
            Revoke the OLD key in the vendor dashboard.
          </li>
          <li>
            Click "Mark rotated" on this page so the cadence clock resets.
          </li>
        </ol>
      </section>
    </div>
  );
}
