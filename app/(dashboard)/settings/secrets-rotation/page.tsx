import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SECRETS } from "@/lib/secrets-catalog";
import MarkRotatedDialog from "./MarkRotatedDialog";
import { PageShell, Glass } from "@/components/ui/Glass";

const BLAST_BADGE = {
  low:    "bg-white/5 text-white/60 ring-1 ring-white/10",
  medium: "bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/20",
  high:   "bg-red-400/10 text-red-300 ring-1 ring-red-400/20",
};

export default async function SecretsRotationPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (me.role !== "owner" && me.role !== "manager") {
    return (
      <PageShell eyebrow="Settings" title="Secrets Rotation" width="narrow">
        <p className="text-white/45 text-sm">Owner / manager only.</p>
      </PageShell>
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
    <PageShell
      eyebrow="Settings"
      title="🔑 Secrets Rotation"
      subtitle={
        <>
          Track when each API key was last rotated. Status flags appear when a
          secret is overdue against its target cadence. Rotation procedure for
          each vendor lives in the{" "}
          <Link
            href="/settings/incident-response"
            className="text-[#A6B8E7] hover:text-white transition-colors"
          >
            Incident Response runbook
          </Link>
          .
        </>
      }
      action={
        <Link
          href="/settings"
          className="px-3 py-1.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.05] text-white/70 text-sm transition-colors"
        >
          ← Settings
        </Link>
      }
      width="wide"
    >
      <Glass className="p-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-white/40 text-xs uppercase tracking-wide">
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
                  ? "bg-red-400/10 text-red-300"
                  : status === "soon"
                    ? "bg-amber-400/10 text-amber-300"
                    : status === "never"
                      ? "bg-white/5 text-white/60"
                      : "bg-emerald-400/10 text-emerald-300";

              return (
                <tr key={s.name} className="border-b border-white/[0.06] last:border-0 align-top">
                  <td className="py-3 pr-3">
                    <p className="text-white/90 font-mono text-xs">{s.name}</p>
                    <p className="text-white/40 text-[10px] mt-0.5 leading-snug max-w-xs">
                      {s.description}
                    </p>
                    <a
                      href={s.rotation_url}
                      target="_blank"
                      rel="noopener"
                      className="text-[#A6B8E7] hover:text-white text-[10px] mt-1 inline-block transition-colors"
                    >
                      Rotate at vendor →
                    </a>
                  </td>
                  <td className="py-3 pr-3 text-white/70 text-xs">{s.vendor}</td>
                  <td className="py-3 pr-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] uppercase font-medium ${BLAST_BADGE[s.blast_radius]}`}
                    >
                      {s.blast_radius}
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-white/45 text-xs">Every {s.cadence_days}d</td>
                  <td className="py-3 pr-3 text-white/70 text-xs">
                    {latest
                      ? `${new Date(latest.rotated_at).toLocaleDateString()} (${ageDays}d ago)`
                      : "Never logged"}
                    {latest?.notes && (
                      <p className="text-white/40 text-[10px] mt-0.5 italic">{latest.notes}</p>
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
      </Glass>

      <Glass className="p-6 mt-5">
        <h2 className="text-white/90 font-semibold mb-3">Rotation Steps (every secret)</h2>
        <ol className="flex flex-col gap-2 text-sm text-white/70 list-decimal list-inside">
          <li>Log into the vendor and create a NEW key (don't delete the old one yet).</li>
          <li>
            Update Vercel env: <code className="text-[#A6B8E7]">vercel env rm SECRET_NAME production</code>{" "}
            then <code className="text-[#A6B8E7]">vercel env add SECRET_NAME production</code>.
          </li>
          <li>
            Trigger a redeploy: <code className="text-[#A6B8E7]">vercel deploy --prod --yes</code>.
          </li>
          <li>
            Verify the new key works (hit the affected feature once: send a
            test email, run an AI call, etc.).
          </li>
          <li>Revoke the OLD key in the vendor dashboard.</li>
          <li>Click "Mark rotated" on this page so the cadence clock resets.</li>
        </ol>
      </Glass>
    </PageShell>
  );
}
