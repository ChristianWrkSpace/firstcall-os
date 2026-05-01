"use client";

import { useState, useTransition } from "react";
import { generateTuringReport } from "@/app/actions/turing";
import type { TuringReport } from "@/lib/turing";

const CATEGORY_META: Record<
  string,
  { label: string; color: string; emoji: string }
> = {
  prompt_quality:    { label: "Prompt Quality",    color: "bg-purple-500/15 text-purple-300 border-purple-500/30", emoji: "✍️" },
  process_friction:  { label: "Process Friction",  color: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30", emoji: "🐌" },
  cost_efficiency:   { label: "Cost Efficiency",   color: "bg-orange-500/15 text-orange-300 border-orange-500/30", emoji: "💸" },
  data_gap:          { label: "Data Gap",          color: "bg-blue-500/15 text-blue-300 border-blue-500/30",       emoji: "📉" },
  wins:              { label: "Wins",              color: "bg-green-500/15 text-green-300 border-green-500/30",   emoji: "✅" },
};

const SEV_COLOR: Record<string, string> = {
  high: "text-red-400 border-red-500/40",
  med: "text-yellow-400 border-yellow-500/30",
  low: "text-zinc-400 border-zinc-700",
};

const WINDOWS = [7, 14, 30, 90];

export default function TuringRunner() {
  const [windowDays, setWindowDays] = useState(14);
  const [report, setReport] = useState<TuringReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run() {
    setError(null);
    setReport(null);
    start(async () => {
      const res = await generateTuringReport(windowDays);
      if (res.error) setError(res.error);
      else setReport(res.report ?? null);
    });
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-end justify-between gap-3 flex-wrap mb-5">
        <div>
          <p className="text-white text-sm font-semibold">Run audit</p>
          <p className="text-zinc-500 text-xs">
            Pulls outcomes + health for the chosen window, asks Opus to produce
            5–8 prioritized insights. Takes ~20 seconds.
          </p>
        </div>
        <div className="flex items-center gap-1">
          {WINDOWS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setWindowDays(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                windowDays === d
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
      >
        {pending ? "🧠 Auditing…" : "🧠 Run Turing Audit"}
      </button>

      {error && (
        <p className="mt-3 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded px-3 py-2">
          {error}
        </p>
      )}

      {report && (
        <div className="mt-6 flex flex-col gap-4">
          {/* Summary */}
          <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-lg p-4">
            <p className="text-zinc-300 text-xs uppercase tracking-wide font-semibold mb-2">
              Executive Summary
            </p>
            <p className="text-white text-sm leading-relaxed">{report.summary}</p>
            <p className="text-zinc-500 text-[10px] mt-2 font-mono">
              Window: {report.data_window_days}d · Generated{" "}
              {new Date(report.generated_at).toLocaleString()} · {report.insights.length} insights
            </p>
          </div>

          {/* Insights */}
          {report.insights.length === 0 ? (
            <p className="text-zinc-500 text-sm italic">No insights returned.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {report.insights
                .slice()
                .sort((a, b) => {
                  const order: Record<string, number> = { high: 0, med: 1, low: 2 };
                  return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
                })
                .map((ins, i) => {
                  const cat = CATEGORY_META[ins.category] ?? CATEGORY_META.wins;
                  const sevColor = SEV_COLOR[ins.severity] ?? SEV_COLOR.low;
                  return (
                    <li
                      key={i}
                      className={`border rounded-xl p-4 ${sevColor.split(" ")[1]}`}
                    >
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${cat.color}`}
                        >
                          {cat.emoji} {cat.label}
                        </span>
                        <span
                          className={`text-[10px] uppercase tracking-wide font-mono ${sevColor.split(" ")[0]}`}
                        >
                          {ins.severity}
                        </span>
                        <span className="text-zinc-500 text-xs ml-auto">
                          {ins.agent}
                        </span>
                      </div>
                      <p className="text-zinc-200 text-sm leading-relaxed mb-2">
                        <span className="text-zinc-400">Observed: </span>
                        {ins.observation}
                      </p>
                      <p className="text-white text-sm leading-relaxed">
                        <span className="text-zinc-400">→ Recommend: </span>
                        {ins.recommendation}
                      </p>
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
