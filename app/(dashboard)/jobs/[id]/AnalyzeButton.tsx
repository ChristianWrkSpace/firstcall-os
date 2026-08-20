"use client";

import { useState, useTransition } from "react";
import { analyzeJobPhotos } from "@/app/actions/scope";

export default function AnalyzeButton({
  jobId,
  hasPhotos,
  hasScope,
  photoCount = 0,
}: {
  jobId: string;
  hasPhotos: boolean;
  hasScope: boolean;
  photoCount?: number;
}) {
  const [pending, startTransition] = useTransition();
  const [pendingMode, setPendingMode] = useState<"quick" | "deep" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    mode?: "quick" | "deep";
    photosAnalyzed?: number;
    photosTotal?: number;
  } | null>(null);

  // Deep scan only meaningful when there are more photos than the quick
  // mode would already cover.
  const QUICK_TARGET = 16;
  const showDeepOption = photoCount > QUICK_TARGET;

  function run(mode: "quick" | "deep") {
    setError(null);
    setPendingMode(mode);
    startTransition(async () => {
      const res = await analyzeJobPhotos(jobId, mode);
      if (res.error) setError(res.error);
      else setLastResult(res);
      setPendingMode(null);
    });
  }

  return (
    <div className="flex flex-col gap-1.5 items-end">
      <div className="flex items-center gap-1.5 flex-wrap justify-end">
        <button
          type="button"
          onClick={() => run("quick")}
          disabled={pending || !hasPhotos}
          className="px-4 py-2 bg-cta hover:bg-cta-deep disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          {pending && pendingMode === "quick" ? (
            <>
              <Spinner /> Analyzing photos…
            </>
          ) : hasScope ? (
            <>Update scope</>
          ) : (
            <>Analyze photos</>
          )}
        </button>
        {showDeepOption && (
          <button
            type="button"
            onClick={() => run("deep")}
            disabled={pending || !hasPhotos}
            title={`Analyze all ${photoCount} photos instead of the first 16. This takes longer but covers the full job.`}
            className="px-3 py-2 bg-tint hover:bg-shade border border-edge2 disabled:opacity-50 disabled:cursor-not-allowed text-ink/85 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
          >
            {pending && pendingMode === "deep" ? (
              <>
                <Spinner /> Deep scan…
              </>
            ) : (
              <>Analyze all {photoCount}</>
            )}
          </button>
        )}
      </div>
      {showDeepOption && !pending && !lastResult && (
        <p className="text-ink/40 text-[10px]">
          Standard analysis uses 16 photos · full analysis uses every photo
        </p>
      )}
      {lastResult?.photosAnalyzed != null && (
        <p className="text-[#A8DCD3] text-[10px]">
          ✓ {lastResult.mode === "deep" ? "Deep scan" : "Quick scan"} ·{" "}
          {lastResult.photosAnalyzed} of {lastResult.photosTotal} photos
        </p>
      )}
      {error && (
        <p className="text-red-700 text-xs bg-red-400/10 border border-red-400/20 rounded px-2 py-1">
          {error}
        </p>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
