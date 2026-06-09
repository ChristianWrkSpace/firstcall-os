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
import { PageShell, Glass } from "@/components/ui/Glass";

const STATUS_META: Record<Status, { label: string; color: string; emoji: string }> = {
  done: { label: "Shipped", color: "text-emerald-300", emoji: "✅" },
  in_progress: { label: "In Progress", color: "text-[#A6B8E7]", emoji: "🔨" },
  planned: { label: "Planned", color: "text-white/55", emoji: "📋" },
  idea: { label: "Ideas", color: "text-purple-300", emoji: "💡" },
};

const EFFORT_META: Record<Effort, { label: string; hours: string; color: string }> = {
  S:  { label: "S",  hours: "~1-2h",  color: "bg-white/[0.06] text-white/60" },
  M:  { label: "M",  hours: "~½ day", color: "bg-[#6B8AD9]/15 text-[#A6B8E7]" },
  L:  { label: "L",  hours: "~1-2d",  color: "bg-purple-400/15 text-purple-300" },
  XL: { label: "XL", hours: "~3+d",   color: "bg-red-400/15 text-red-300" },
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
    <PageShell
      eyebrow="Roadmap"
      title="Project Progress"
      subtitle="Source of truth. Effort-weighted. Updated as work ships."
      width="full"
    >
      {/* Overall progress */}
      <Glass className="p-6 mb-6">
        <div className="flex items-end justify-between mb-3 gap-3 flex-wrap">
          <div>
            <p className="text-white/45 text-xs uppercase tracking-wide">Overall Progress</p>
            <p className="text-5xl font-bold text-white/95 mt-1">
              {overall.percent}
              <span className="text-2xl text-white/40">%</span>
            </p>
            <p className="text-white/40 text-xs mt-1">
              {overall.doneWeight} / {overall.totalWeight} effort units shipped (S=1, M=3, L=8, XL=20)
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <StatChip count={counts.done} label="Shipped" color="text-emerald-300" />
            <StatChip count={counts.in_progress} label="In Flight" color="text-[#A6B8E7]" />
            <StatChip count={counts.planned} label="Planned" color="text-white/70" />
            <StatChip count={counts.idea} label="Ideas" color="text-purple-300" />
          </div>
        </div>

        <ProgressBar percent={overall.percent} />
      </Glass>

      {/* Per-track progress */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {TRACKS.map((track) => {
          const meta = TRACK_META[track];
          const stats = trackProgress[track];
          return (
            <Glass key={track} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-white/90 text-sm font-semibold">
                  {meta.emoji} {meta.label}
                </p>
                <p className="text-2xl font-bold text-white/95">
                  {stats.percent}<span className="text-sm text-white/40">%</span>
                </p>
              </div>
              <ProgressBar percent={stats.percent} thin />
              <p className="text-white/40 text-xs mt-2 leading-snug">{meta.description}</p>
              <p className="text-white/30 text-[10px] mt-1.5 font-mono">
                {stats.doneWeight} / {stats.totalWeight} effort · {stats.items} items
              </p>
            </Glass>
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
              <h2 className="text-xl font-semibold text-white/95">
                {meta.emoji} {meta.label}
              </h2>
              <span className="text-white/30 text-sm">({trackProgress[track].percent}%)</span>
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
                    <span className="text-white/30 text-xs">({items.length})</span>
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
      <Glass subtle className="mt-8 p-4 text-white/40 text-xs leading-relaxed">
        <p className="text-white/70 text-sm font-semibold mb-1">How this is calculated</p>
        <p>
          Items are weighted by effort (S=1, M=3, L=8, XL=20). Done counts full weight; in-progress
          counts half. Ideas are excluded — they're not committed scope. "Done" means shipped + working,
          not "scaffolded but needs hardening." If something here looks wrong, the source of truth is{" "}
          <code className="text-white/70 bg-white/10 px-1 py-0.5 rounded">lib/roadmap.ts</code>.
        </p>
      </Glass>
    </PageShell>
  );
}

function ProgressBar({ percent, thin }: { percent: number; thin?: boolean }) {
  return (
    <div className={`bg-white/10 rounded-full overflow-hidden ${thin ? "h-1.5" : "h-3"}`}>
      <div
        className="h-full bg-gradient-to-r from-[#6B8AD9] to-[#5FBDB0] transition-all duration-700"
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
      <p className="text-white/40 text-[10px] uppercase tracking-wide">{label}</p>
    </div>
  );
}

function RoadmapCard({ item }: { item: RoadmapItem }) {
  const effortMeta = EFFORT_META[item.effort];
  return (
    <div
      className={`border rounded-xl p-4 transition-colors ${
        item.status === "done"
          ? "bg-emerald-400/[0.05] border-emerald-400/20"
          : item.status === "in_progress"
            ? "bg-[#6B8AD9]/10 border-[#6B8AD9]/30"
            : item.status === "planned"
              ? "bg-white/[0.03] border-white/[0.06]"
              : "bg-purple-400/[0.05] border-purple-400/15"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <h3 className="text-white/90 font-semibold text-sm">{item.title}</h3>
          {item.agent && (
            <span className="px-1.5 py-0.5 bg-white/[0.06] text-white/55 text-[10px] rounded font-mono uppercase">
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
        <p className="text-emerald-400/70 text-[10px] mb-1.5 font-mono">shipped {item.shipped_at}</p>
      )}

      <p className="text-white/55 text-xs leading-relaxed">{item.description}</p>

      {item.features && item.features.length > 0 && (
        <ul className="mt-2.5 space-y-1">
          {item.features.map((f, i) => (
            <li key={i} className="text-white/45 text-xs flex items-start gap-1.5">
              <span className="text-emerald-400 shrink-0">✓</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
