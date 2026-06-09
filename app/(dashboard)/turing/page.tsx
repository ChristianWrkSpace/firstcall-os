import { requireRoles } from "@/components/RoleGate";
import TuringRunner from "./TuringRunner";

export default async function TuringPage() {
  await requireRoles(["owner", "manager"]);

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">🧠 Turing — Self-Audit</h1>
        <p className="text-zinc-400 text-sm mt-0.5">
          Meta-agent that reads recent agent_outcomes + system health and surfaces
          concrete improvements: which prompts need tuning, which workflows have
          friction, which data gaps are blind spots, which agents are producing
          drafts that get sent unchanged (the wins worth reinforcing).
        </p>
      </div>

      <TuringRunner />

      <div className="mt-6 bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 text-zinc-500 text-xs leading-relaxed">
        <p className="text-zinc-300 text-sm font-semibold mb-1">How it works</p>
        <p>
          Turing pulls the last N days of agent_outcomes (rejected drafts,
          edits, revisions), counts per-agent approval rates, reads recent
          deltas (what humans actually changed), and asks the SMART-tier model
          (Opus) to produce 5–8 prioritized insights. Categorized as
          <strong className="text-zinc-300"> prompt_quality / process_friction /
          cost_efficiency / data_gap / wins.</strong> Read-only — Turing never
          mutates other agents' state. You decide what to act on.
        </p>
        <p className="mt-2">
          Each run is logged to audit_logs as <code className="text-zinc-300 bg-zinc-800 px-1 rounded">turing.audit_run</code>.
          Run quarterly or when something feels off.
        </p>
      </div>
    </div>
  );
}
