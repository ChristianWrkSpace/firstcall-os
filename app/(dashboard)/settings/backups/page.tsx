import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ManualBackupButton, DownloadBackupLink, VerifyLatestBackupButton } from "./BackupActions";

const STATUS_BADGE: Record<string, string> = {
  ok:      "bg-pine/10 text-pine",
  failed:  "bg-red-600/10 text-red-700",
  running: "bg-honey/10 text-honey",
};

export default async function BackupsPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (me.role !== "owner" && me.role !== "manager") {
    return (
      <div className="p-8 max-w-2xl">
        <h1 className="text-2xl font-bold text-ink">Backups</h1>
        <p className="text-ink-2 text-sm mt-2">
          Owner / manager only.
        </p>
      </div>
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data: backups } = await supabase
    .from("backups_log")
    .select(
      "id, created_at, triggered_by, status, storage_path, bytes, row_counts, error, finished_at"
    )
    .order("created_at", { ascending: false })
    .limit(30);

  const last = backups?.[0];
  const lastOk = backups?.find((b: any) => b.status === "ok");

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="mb-6">
        <Link
          href="/settings"
          className="text-ink-3 hover:text-ink text-sm transition-colors"
        >
          ← Settings
        </Link>
        <h1 className="text-2xl font-bold text-ink mt-2">💾 Backups & DR</h1>
        <p className="text-ink-2 text-sm mt-1 max-w-2xl">
          Weekly automated logical export of operational tables to private
          Supabase Storage. Defense-in-depth on top of Supabase point-in-time
          recovery — not a replacement.
        </p>
      </div>

      {/* Layered protection summary */}
      <section className="glass-card p-6 mb-5">
        <h2 className="text-ink font-semibold mb-3">Protection Layers</h2>
        <ul className="flex flex-col gap-3 text-sm">
          <li className="flex gap-3">
            <span className="text-info font-mono text-xs mt-0.5">L1</span>
            <div>
              <p className="text-ink font-medium">
                Supabase Point-in-Time Recovery (PITR)
              </p>
              <p className="text-ink-3 text-xs mt-0.5">
                Continuous WAL replication. Restore to any second in the last 7+
                days. Configured in your Supabase project Database settings.{" "}
                <span className="text-honey">
                  Verify: Database → Backups → PITR enabled.
                </span>
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="text-info font-mono text-xs mt-0.5">L2</span>
            <div>
              <p className="text-ink font-medium">
                Daily Auto Backups (Supabase)
              </p>
              <p className="text-ink-3 text-xs mt-0.5">
                Full DB snapshot every 24h, retained 7 days on free / longer on
                paid tiers.
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="text-info font-mono text-xs mt-0.5">L3</span>
            <div>
              <p className="text-ink font-medium">
                Weekly Logical Export (this page)
              </p>
              <p className="text-ink-3 text-xs mt-0.5">
                Every Sunday 03:00 UTC, the cron exports operational tables to
                JSON in the private <code className="text-info">backups</code>{" "}
                bucket. Useful for accidental-mass-delete recovery and
                project-to-project moves.
              </p>
            </div>
          </li>
        </ul>
      </section>

      {/* Status + manual trigger */}
      <section className="glass-card p-6 mb-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div>
            <h2 className="text-ink font-semibold">Cron Status</h2>
            <p className="text-ink-3 text-xs mt-0.5">
              Schedule: Sundays 03:00 UTC (10:00 PM Saturday Austin).
            </p>
          </div>
          <ManualBackupButton />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Stat
            label="Last Run"
            value={
              last
                ? new Date(last.created_at).toLocaleString()
                : "Never"
            }
            note={last ? `via ${last.triggered_by}` : undefined}
          />
          <Stat
            label="Last Successful"
            value={
              lastOk
                ? new Date(lastOk.created_at).toLocaleString()
                : "—"
            }
            note={
              lastOk?.bytes
                ? `${(Number(lastOk.bytes) / 1024).toFixed(0)} KB`
                : undefined
            }
          />
          <Stat
            label="Total Logged Runs"
            value={(backups?.length ?? 0).toString()}
          />
        </div>
      </section>

      {/* History */}
      <section className="glass-card p-6">
        <h2 className="text-ink font-semibold mb-3">Recent Runs</h2>
        {!backups?.length ? (
          <p className="text-ink-3 text-sm italic">
            No backups yet. The first cron will fire next Sunday, or click "Run
            Backup Now" to test.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-edge2 text-ink-3 text-xs uppercase tracking-wide">
                  <th className="text-left py-2">When</th>
                  <th className="text-left py-2">Source</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-right py-2">Size</th>
                  {me.role === "owner" && (
                    <th className="text-right py-2">Action</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {backups.map((b: any) => (
                  <tr
                    key={b.id}
                    className="border-b border-edge2/60 last:border-0"
                  >
                    <td className="py-2.5 text-ink-2">
                      {new Date(b.created_at).toLocaleString()}
                    </td>
                    <td className="py-2.5 text-ink-2 capitalize">
                      {b.triggered_by}
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium uppercase ${STATUS_BADGE[b.status] ?? ""}`}
                      >
                        {b.status}
                      </span>
                      {b.error && (
                        <p className="text-red-700 text-[10px] mt-1">
                          {b.error}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 text-right text-ink-2 font-mono text-xs">
                      {b.bytes
                        ? `${(Number(b.bytes) / 1024).toFixed(0)} KB`
                        : "—"}
                    </td>
                    {me.role === "owner" && (
                      <td className="py-2.5 text-right">
                        {b.status === "ok" && b.storage_path ? (
                          <DownloadBackupLink storagePath={b.storage_path} />
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Restore drill */}
      <section className="glass-card p-6 mt-5">
        <h2 className="text-ink font-semibold mb-1">Restore Drill</h2>
        <p className="text-ink-3 text-xs mb-4 leading-relaxed">
          A backup you've never restored is a backup you don't have. The Verify
          button below downloads the latest successful backup, parses it, and
          confirms row counts match the metadata — answers "is this actually
          restorable?" in 30 seconds without spinning up a sandbox.
        </p>

        <VerifyLatestBackupButton />

        <div className="mt-5 pt-5 border-t border-edge2">
          <p className="text-ink text-sm font-semibold mb-2">Full quarterly drill (still recommended)</p>
          <ol className="flex flex-col gap-1.5 text-sm text-ink-2 list-decimal list-inside leading-relaxed">
            <li>Click Verify above to confirm the latest backup is intact.</li>
            <li>
              Spin up a sandbox Supabase project (or restore PITR snapshot to a
              sister project).
            </li>
            <li>
              Download a recent backup JSON from this page (Owner only) and
              import into the sandbox via your seed script.
            </li>
            <li>
              Sign into the sandbox with a test user and confirm jobs / customers /
              invoices look right.
            </li>
            <li>
              Document elapsed restore time (target: under 60 minutes for a full
              cold restore). Tear down the sandbox.
            </li>
          </ol>
          <p className="text-ink-3 text-xs mt-3">
            Drills are auto-logged to the audit trail (action <code className="text-ink-2 bg-shade px-1 rounded">backup.drill_verify</code>) so you can see the last 4 quarters at a glance from /settings/audit.
          </p>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="bg-tint rounded-lg px-4 py-3">
      <p className="text-ink-3 text-[10px] uppercase tracking-wide font-semibold">
        {label}
      </p>
      <p className="text-ink text-sm font-medium mt-1">{value}</p>
      {note && <p className="text-ink-3 text-[10px] mt-0.5">{note}</p>}
    </div>
  );
}
