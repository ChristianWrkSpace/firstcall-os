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
  done: { label: "Shipped", color: "text-pine", emoji: "✅" },
  in_progress: { label: "In Progress", color: "text-info", emoji: "🔨" },
  planned: { label: "Planned", color: "text-ink-2", emoji: "📋" },
  idea: { label: "Ideas", color: "text-violet-700", emoji: "💡" },
};

const EFFORT_META: Record<Effort, { label: string; hours: string; color: string }> = {
  S:  { label: "S",  hours: "~1-2h",  color: "bg-shade text-ink-2" },
  M:  { label: "M",  hours: "~½ day", color: "bg-info/10 text-info" },
  L:  { label: "L",  hours: "~1-2d",  color: "bg-violet-500/10 text-violet-700" },
  XL: { label: "XL", hours: "~3+d",   color: "bg-red-600/10 text-red-700" },
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
        <h1 className="text-2xl font-bold text-ink">Project Progress</h1>
        <p className="text-ink-2 text-sm mt-0.5">
          Source of truth. Effort-weighted. Updated as work ships.
        </p>
      </div>

      {/* Overall progress */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-end justify-between mb-3 gap-3 flex-wrap">
          <div>
            <p className="text-ink-2 text-xs uppercase tracking-wide">Overall Progress</p>
            <p className="text-5xl font-bold text-ink mt-1">
              {overall.percent}
              <span className="text-2xl text-ink-3">%</span>
            </p>
            <p className="text-ink-3 text-xs mt-1">
              {overall.doneWeight} / {overall.totalWeight} effort units shipped (S=1, M=3, L=8, XL=20)
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <StatChip count={counts.done} label="Shipped" color="text-pine" />
            <StatChip count={counts.in_progress} label="In Flight" color="text-info" />
            <StatChip count={counts.planned} label="Planned" color="text-ink-2" />
            <StatChip count={counts.idea} label="Ideas" color="text-violet-700" />
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
                <p className="text-ink text-sm font-semibold">
                  {meta.emoji} {meta.label}
                </p>
                <p className="text-2xl font-bold text-ink">
                  {stats.percent}<span className="text-sm text-ink-3">%</span>
                </p>
              </div>
              <ProgressBar percent={stats.percent} thin />
              <p className="text-ink-3 text-xs mt-2 leading-snug">{meta.description}</p>
              <p className="text-ink-3 text-[10px] mt-1.5 font-mono">
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
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-edge2">
              <h2 className="text-xl font-semibold text-ink">
                {meta.emoji} {meta.label}
              </h2>
              <span className="text-ink-3 text-sm">
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
                    <span className="text-ink-3 text-xs">({items.length})</span>
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
      <div className="mt-8 bg-card border border-edge2 rounded-lg p-4 text-ink-3 text-xs leading-relaxed">
        <p className="text-ink-2 text-sm font-semibold mb-1">How this is calculated</p>
        <p>
          Items are weighted by effort (S=1, M=3, L=8, XL=20). Done counts full weight; in-progress
          counts half. Ideas are excluded — they're not committed scope. "Done" means shipped + working,
          not "scaffolded but needs hardening." If something here looks wrong, the source of truth is{" "}
          <code className="text-ink-2 bg-shade px-1 py-0.5 rounded">lib/roadmap.ts</code>.
        </p>
      </div>
    </div>
  );
}

function ProgressBar({ percent, thin }: { percent: number; thin?: boolean }) {
  return (
    <div
      className={`bg-shade rounded-full overflow-hidden ${thin ? "h-1.5" : "h-3"}`}
    >
      <div
        className="h-full bg-[color:var(--color-verified)] transition-[width] duration-150"
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
    <div className="bg-tint border border-edge2 rounded-lg px-3 py-2 text-center min-w-[70px]">
      <p className={`text-xl font-bold ${color}`}>{count}</p>
      <p className="text-ink-3 text-[10px] uppercase tracking-wide">{label}</p>
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
            ? "bg-info/10 border-info/30"
            : item.status === "planned"
              ? "bg-card border-edge2"
              : "bg-purple-500/5 border-purple-500/15"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <h3 className="text-ink font-semibold text-sm">{item.title}</h3>
          {item.agent && (
            <span className="px-1.5 py-0.5 bg-shade text-ink-2 text-[10px] rounded font-mono uppercase">
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

      <p className="text-ink-2 text-xs leading-relaxed">{item.description}</p>

      {item.features && item.features.length > 0 && (
        <ul className="mt-2.5 space-y-1">
          {item.features.map((f, i) => (
            <li key={i} className="text-ink-3 text-xs flex items-start gap-1.5">
              <span className="text-green-500 shrink-0">✓</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
