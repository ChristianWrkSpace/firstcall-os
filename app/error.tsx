"use client";

import Link from "next/link";

// Branded error boundary — when something breaks mid-flow, stay calm, offer
// retry first (most errors are transient), then a way back to work.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen app-backdrop flex items-center justify-center p-6">
      <div className="glass-card max-w-sm w-full p-8 text-center">
        <p className="text-3xl mb-4">🛠️</p>
        <h1 className="text-ink text-xl font-semibold">Something hiccupped</h1>
        <p className="text-ink-3 text-sm mt-2 leading-relaxed">
          Usually a blip — try again. If it keeps happening, the team can trace
          it{error.digest ? ` with code ${error.digest}` : ""}.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={reset}
            className="w-full py-2.5 rounded-xl bg-cta hover:bg-cta-deep text-white text-sm font-medium transition-colors"
          >
            Try again
          </button>
          <Link
            href="/command-center"
            className="block w-full py-2.5 rounded-xl bg-shade hover:bg-edge2 text-ink text-sm font-medium transition-colors"
          >
            Back to Command Center
          </Link>
        </div>
      </div>
    </div>
  );
}
