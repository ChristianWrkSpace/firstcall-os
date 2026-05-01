import {
  ROADMAP,
  computeTrackProgress,
  computeStatusCounts,
  TRACK_META,
  EFFORT_WEIGHTS,
  type RoadmapItem,
  type Status,
  type Track,
  type Effort,
} from "@/lib/roadmap";
import { requireRoles } from "@/components/RoleGate";

const STATUS_META: Record<Status, { label: string; color: string; emoji: string }> = {
  done: { label: "Shipped", color: "text-green-400", emoji: "✅" },
  in_progress: { label: "In Progress", color: "text-blue-400", emoji: "🔨" },
  planned: { label: "Planned", color: "text-zinc-400", emoji: "📋" },
  idea: { label: "Ideas", color: "text-purple-400", emoji: "💡" },
};

const EFFORT_META: Record<Effort, { label: string; hours: string; color: string }> = {
  S:  { label: "S",  hours: "~1-2h",  color: "bg-zinc-700 text-zinc-300" },
  M:  { label: "M",  hours: "~½ day", color: "bg-blue-500/20 text-blue-300" },
  L:  { label: "L",  hours: "~1-2d",  color: "bg-purple-500/20 text-purple-300" },
  XL: { label: "XL", hours: "~3+d",   color: "bg-red-500/20 text-red-300" },
};

const TRACKS: Track[] = ["core", "production", "security", "integrations"];
const STATUS_ORDER: Status[] = ["in_progress", "done", "planned", "idea"];

export default async function ProgressPage() {
  await requireRoles(["owner", "manager"]);
  const overall = computeTrackProgress("all");
  const counts = computeStatusCounts();
  const trackProgress: Record<Track, ReturnType<typeof computeTrackProgress>> = {
    core: computeTrackProgress("core"),
    production: computeTrackProgress("production"),
    security: computeTrackProgress("security"),
    integrations: computeTrackProgress("integrations"),
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Project Progress</h1>
        <p className="text-zinc-400 text-sm mt-0.5">
          Source of truth. Effort-weighted. Updated as work ships.
        </p>
      </div>

      {/* Overall progress */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-end justify-between mb-3 gap-3 flex-wrap">
          <div>
            <p className="text-zinc-400 text-xs uppercase tracking-wide">Overall Progress</p>
            <p className="text-5xl font-bold text-white mt-1">
              {overall.percent}
              <span className="text-2xl text-zinc-500">%</span>
            </p>
            <p className="text-zinc-500 text-xs mt-1">
              {overall.doneWeight} / {overall.totalWeight} effort units shipped (S=1, M=3, L=8, XL=20)
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <StatChip count={counts.done} label="Shipped" color="text-green-400" />
            <StatChip count={counts.in_progress} label="In Flight" color="text-blue-400" />
            <StatChip count={counts.planned} label="Planned" color="text-zinc-300" />
            <StatChip count={counts.idea} label="Ideas" color="text-purple-400" />
          </div>
        </div>

        <ProgressBar percent={overall.percent} />
      </div>

      {/* Per-track progress */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {TRACKS.map((track) => {
          const meta = TRACK_META[track];
          const stats = trackProgress[track];
          return (
            <div key={track} className="glass-card p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-white text-sm font-semibold">
                  {meta.emoji} {meta.label}
                </p>
                <p className="text-2xl font-bold text-white">
                  {stats.percent}<span className="text-sm text-zinc-500">%</span>
                </p>
              </div>
              <ProgressBar percent={stats.percent} thin />
              <p className="text-zinc-500 text-xs mt-2 leading-snug">{meta.description}</p>
              <p className="text-zinc-600 text-[10px] mt-1.5 font-mono">
                {stats.doneWeight} / {stats.totalWeight} effort · {stats.items} items
              </p>
            </div>
          );
        })}
      </div>

      {/* Items by track + status */}
      {TRACKS.map((track) => {
        const meta = TRACK_META[track];
        const trackItems = ROADMAP.filter((i) => i.track === track);

        return (
          <div key={track} className="mb-10">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-white/[0.06]">
              <h2 className="text-xl font-semibold text-white">
                {meta.emoji} {meta.label}
              </h2>
              <span className="text-zinc-600 text-sm">
                ({trackProgress[track].percent}%)
              </span>
            </div>

            {STATUS_ORDER.map((status) => {
              const items = trackItems.filter((i) => i.status === status);
              if (items.length === 0) return null;
              const statusMeta = STATUS_META[status];
              return (
                <div key={status} className="mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className={`text-sm font-semibold ${statusMeta.color}`}>
                      {statusMeta.emoji} {statusMeta.label}
                    </h3>
                    <span className="text-zinc-600 text-xs">({items.length})</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {items.map((item) => (
                      <RoadmapCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Footnote */}
      <div className="mt-8 bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 text-zinc-500 text-xs leading-relaxed">
        <p className="text-zinc-300 text-sm font-semibold mb-1">How this is calculated</p>
        <p>
          Items are weighted by effort (S=1, M=3, L=8, XL=20). Done counts full weight; in-progress
          counts half. Ideas are excluded — they're not committed scope. "Done" means shipped + working,
          not "scaffolded but needs hardening." If something here looks wrong, the source of truth is{" "}
          <code className="text-zinc-300 bg-zinc-800 px-1 py-0.5 rounded">lib/roadmap.ts</code>.
        </p>
      </div>
    </div>
  );
}

function ProgressBar({ percent, thin }: { percent: number; thin?: boolean }) {
  return (
    <div
      className={`bg-zinc-800 rounded-full overflow-hidden ${thin ? "h-1.5" : "h-3"}`}
    >
      <div
        className="h-full bg-gradient-to-r from-blue-600 to-green-500 transition-all duration-700"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function StatChip({
  count,
  label,
  color,
}: {
  count: number;
  label: string;
  color: string;
}) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-center min-w-[70px]">
      <p className={`text-xl font-bold ${color}`}>{count}</p>
      <p className="text-zinc-500 text-[10px] uppercase tracking-wide">{label}</p>
    </div>
  );
}

function RoadmapCard({ item }: { item: RoadmapItem }) {
  const effortMeta = EFFORT_META[item.effort];
  return (
    <div
      className={`border rounded-xl p-4 transition-colors ${
        item.status === "done"
          ? "bg-green-500/5 border-green-500/20"
          : item.status === "in_progress"
            ? "bg-blue-500/10 border-blue-500/30"
            : item.status === "planned"
              ? "bg-zinc-900 border-zinc-800"
              : "bg-purple-500/5 border-purple-500/15"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <h3 className="text-white font-semibold text-sm">{item.title}</h3>
          {item.agent && (
            <span className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 text-[10px] rounded font-mono uppercase">
              {item.agent}
            </span>
          )}
        </div>
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${effortMeta.color}`}
          title={`Effort: ${effortMeta.hours} (${EFFORT_WEIGHTS[item.effort]} weight units)`}
        >
          {effortMeta.label}
        </span>
      </div>

      {item.shipped_at && (
        <p className="text-green-500/70 text-[10px] mb-1.5 font-mono">
          shipped {item.shipped_at}
        </p>
      )}

      <p className="text-zinc-400 text-xs leading-relaxed">{item.description}</p>

      {item.features && item.features.length > 0 && (
        <ul className="mt-2.5 space-y-1">
          {item.features.map((f, i) => (
            <li key={i} className="text-zinc-500 text-xs flex items-start gap-1.5">
              <span className="text-green-500 shrink-0">✓</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
