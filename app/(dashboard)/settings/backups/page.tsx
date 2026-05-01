import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ManualBackupButton, DownloadBackupLink } from "./BackupActions";

const STATUS_BADGE: Record<string, string> = {
  ok:      "bg-green-500/15 text-green-400",
  failed:  "bg-red-500/15 text-red-400",
  running: "bg-yellow-500/15 text-yellow-300",
};

export default async function BackupsPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (me.role !== "owner" && me.role !== "manager") {
    return (
      <div className="p-8 max-w-2xl">
        <h1 className="text-2xl font-bold text-white">Backups</h1>
        <p className="text-zinc-400 text-sm mt-2">
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
          className="text-zinc-500 hover:text-white text-sm transition-colors"
        >
          ← Settings
        </Link>
        <h1 className="text-2xl font-bold text-white mt-2">💾 Backups & DR</h1>
        <p className="text-zinc-400 text-sm mt-1 max-w-2xl">
          Weekly automated logical export of operational tables to private
          Supabase Storage. Defense-in-depth on top of Supabase point-in-time
          recovery — not a replacement.
        </p>
      </div>

      {/* Layered protection summary */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-5">
        <h2 className="text-white font-semibold mb-3">Protection Layers</h2>
        <ul className="flex flex-col gap-3 text-sm">
          <li className="flex gap-3">
            <span className="text-blue-400 font-mono text-xs mt-0.5">L1</span>
            <div>
              <p className="text-zinc-200 font-medium">
                Supabase Point-in-Time Recovery (PITR)
              </p>
              <p className="text-zinc-500 text-xs mt-0.5">
                Continuous WAL replication. Restore to any second in the last 7+
                days. Configured in your Supabase project Database settings.{" "}
                <span className="text-amber-300">
                  Verify: Database → Backups → PITR enabled.
                </span>
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="text-blue-400 font-mono text-xs mt-0.5">L2</span>
            <div>
              <p className="text-zinc-200 font-medium">
                Daily Auto Backups (Supabase)
              </p>
              <p className="text-zinc-500 text-xs mt-0.5">
                Full DB snapshot every 24h, retained 7 days on free / longer on
                paid tiers.
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="text-blue-400 font-mono text-xs mt-0.5">L3</span>
            <div>
              <p className="text-zinc-200 font-medium">
                Weekly Logical Export (this page)
              </p>
              <p className="text-zinc-500 text-xs mt-0.5">
                Every Sunday 03:00 UTC, the cron exports operational tables to
                JSON in the private <code className="text-blue-300">backups</code>{" "}
                bucket. Useful for accidental-mass-delete recovery and
                project-to-project moves.
              </p>
            </div>
          </li>
        </ul>
      </section>

      {/* Status + manual trigger */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div>
            <h2 className="text-white font-semibold">Cron Status</h2>
            <p className="text-zinc-500 text-xs mt-0.5">
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
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-3">Recent Runs</h2>
        {!backups?.length ? (
          <p className="text-zinc-500 text-sm italic">
            No backups yet. The first cron will fire next Sunday, or click "Run
            Backup Now" to test.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wide">
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
                    className="border-b border-zinc-800/60 last:border-0"
                  >
                    <td className="py-2.5 text-zinc-300">
                      {new Date(b.created_at).toLocaleString()}
                    </td>
                    <td className="py-2.5 text-zinc-400 capitalize">
                      {b.triggered_by}
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium uppercase ${STATUS_BADGE[b.status] ?? ""}`}
                      >
                        {b.status}
                      </span>
                      {b.error && (
                        <p className="text-red-400 text-[10px] mt-1">
                          {b.error}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 text-right text-zinc-400 font-mono text-xs">
                      {b.bytes
                        ? `${(Number(b.bytes) / 1024).toFixed(0)} KB`
                        : "—"}
                    </td>
                    {me.role === "owner" && (
                      <td className="py-2.5 text-right">
                        {b.status === "ok" && b.storage_path ? (
                          <DownloadBackupLink storagePath={b.storage_path} />
                        ) : (
                          <span className="text-zinc-700">—</span>
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
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mt-5">
        <h2 className="text-white font-semibold mb-3">Restore Drill (run quarterly)</h2>
        <ol className="flex flex-col gap-2 text-sm text-zinc-300 list-decimal list-inside">
          <li>
            Spin up a sandbox Supabase project (or restore PITR snapshot to a
            sister project).
          </li>
          <li>
            Pick a recent backup JSON from this page and download it (Owner only).
          </li>
          <li>
            Confirm row counts in the sandbox match the JSON metadata.
          </li>
          <li>
            Document the elapsed restore time (target: under 60 minutes for a
            full cold restore).
          </li>
          <li>
            Tear down the sandbox. Note any gaps in this page's "Recent Runs"
            for the next iteration.
          </li>
        </ol>
        <p className="text-zinc-500 text-xs mt-3">
          Last drill: <span className="text-amber-300">not yet documented</span>{" "}
          — update this once your first quarterly drill is on file.
        </p>
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
    <div className="bg-zinc-800/40 rounded-lg px-4 py-3">
      <p className="text-zinc-500 text-[10px] uppercase tracking-wide font-semibold">
        {label}
      </p>
      <p className="text-white text-sm font-medium mt-1">{value}</p>
      {note && <p className="text-zinc-500 text-[10px] mt-0.5">{note}</p>}
    </div>
  );
}
