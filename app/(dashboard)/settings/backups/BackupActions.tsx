"use client";

import { useState, useTransition } from "react";
import {
  triggerManualBackup,
  getSignedBackupUrl,
} from "@/app/actions/backups";

export function ManualBackupButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function go() {
    if (
      !confirm(
        "Run a manual backup now? This exports all operational tables to private Storage. Takes ~30s on small datasets."
      )
    )
      return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await triggerManualBackup();
      if (res.ok !== true) {
        setError(res.error ?? "Backup failed.");
        return;
      }
      setSuccess(
        `✓ Saved ${res.file} — ${(res.bytes / 1024).toFixed(0)} KB · ${res.rows} rows across ${res.tables} tables`
      );
      setTimeout(() => window.location.reload(), 1500);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={go}
        disabled={pending}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
      >
        {pending ? "Backing up…" : "💾 Run Backup Now"}
      </button>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      {success && <p className="text-green-400 text-xs">{success}</p>}
    </div>
  );
}

export function DownloadBackupLink({ storagePath }: { storagePath: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function dl() {
    setError(null);
    startTransition(async () => {
      const res = await getSignedBackupUrl(storagePath);
      if (res.error || !res.url) {
        setError(res.error ?? "Could not sign URL.");
        return;
      }
      window.open(res.url, "_blank");
    });
  }

  return (
    <div className="flex flex-col items-end">
      <button
        onClick={dl}
        disabled={pending}
        className="text-blue-400 hover:text-blue-300 text-xs disabled:opacity-50"
      >
        {pending ? "..." : "Download"}
      </button>
      {error && <p className="text-red-400 text-[10px]">{error}</p>}
    </div>
  );
}
