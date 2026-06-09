"use client";

import { useState, useTransition } from "react";
import {
  generateCustomerShareToken,
  regenerateCustomerShareToken,
  revokeCustomerShareToken,
} from "@/app/actions/portal";

export default function CustomerShareCard({
  jobId,
  initialToken,
}: {
  jobId: string;
  initialToken: string | null;
}) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function generate() {
    setError(null);
    startTransition(async () => {
      const res = await generateCustomerShareToken(jobId);
      if (res.error) setError(res.error);
      else setToken(res.token!);
    });
  }

  function regenerate() {
    if (
      !confirm(
        "Generate a new link? The old link will stop working immediately."
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await regenerateCustomerShareToken(jobId);
      if (res.error) setError(res.error);
      else setToken(res.token!);
    });
  }

  function revoke() {
    if (!confirm("Revoke customer access? They won't be able to view the job anymore."))
      return;
    setError(null);
    startTransition(async () => {
      const res = await revokeCustomerShareToken(jobId);
      if (res.error) setError(res.error);
      else setToken(null);
    });
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  const url = token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/portal/${token}`
    : null;

  if (!token) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-ink-2 text-xs">
          Generate a public link your customer can open from any device — no login.
          They'll see job status, photos, and signed documents.
        </p>
        <button
          onClick={generate}
          disabled={pending}
          className="px-3 py-2 bg-cta hover:bg-cta-deep disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {pending ? "Generating…" : "🔗 Generate Customer Link"}
        </button>
        {error && <p className="text-red-700 text-xs">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-ink-2 text-xs">
        Customer can view this job at the link below. Status updates appear
        automatically — no login required.
      </p>
      <div className="bg-shade border border-edge2 rounded-lg px-3 py-2 break-all text-info text-xs font-mono">
        {url}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => url && copyLink(url)}
          className="flex-1 px-3 py-1.5 bg-cta hover:bg-cta-deep text-white text-xs font-medium rounded-lg"
        >
          {copied ? "✓ Copied" : "📋 Copy Link"}
        </button>
        <a
          href={url ?? "#"}
          target="_blank"
          rel="noopener"
          className="px-3 py-1.5 bg-shade hover:bg-shade text-ink-2 text-xs rounded-lg"
        >
          Preview
        </a>
      </div>
      <div className="flex gap-2 mt-1">
        <button
          onClick={regenerate}
          disabled={pending}
          className="text-ink-3 hover:text-ink-2 text-[10px]"
        >
          regenerate link
        </button>
        <span className="text-ink-3">·</span>
        <button
          onClick={revoke}
          disabled={pending}
          className="text-red-700 hover:text-red-700 text-[10px]"
        >
          revoke access
        </button>
      </div>
      {error && <p className="text-red-700 text-xs">{error}</p>}
    </div>
  );
}
