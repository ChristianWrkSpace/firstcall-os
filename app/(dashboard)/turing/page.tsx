import { requireRoles } from "@/components/RoleGate";
import TuringRunner from "./TuringRunner";
import { PageShell, Glass } from "@/components/ui/Glass";

export default async function TuringPage() {
  await requireRoles(["owner", "manager"]);

  return (
    <PageShell
      eyebrow="Self-audit"
      title="🔬 Turing"
      subtitle="Meta-agent that reads recent agent_outcomes + system health and surfaces concrete improvements: which prompts need tuning, which workflows have friction, which data gaps are blind spots, which agents are producing drafts that get sent unchanged (the wins worth reinforcing)."
    >
      <TuringRunner />

      <Glass level="shadow" className="mt-6 p-5 text-white/55 text-xs leading-relaxed">
        <p className="text-white/85 text-sm font-semibold mb-1">How it works</p>
        <p>
          Turing pulls the last N days of agent_outcomes (rejected drafts, edits, revisions),
          counts per-agent approval rates, reads recent deltas (what humans actually changed), and
          asks the SMART-tier model (Opus) to produce 5–8 prioritized insights. Categorized as
          <strong className="text-white/75"> prompt_quality / process_friction / cost_efficiency /
          data_gap / wins.</strong> Read-only — Turing never mutates other agents&apos; state. You
          decide what to act on.
        </p>
        <p className="mt-2">
          Each run is logged to audit_logs as{" "}
          <code className="text-white/75 bg-white/[0.06] px-1 rounded">turing.audit_run</code>. Run
          quarterly or when something feels off.
        </p>
      </Glass>
    </PageShell>
  );
}
