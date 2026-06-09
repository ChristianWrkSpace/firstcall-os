import { requireRoles } from "@/components/RoleGate";
import { getCostBasis } from "@/lib/job-pnl";
import Link from "next/link";
import CostBasisForm from "./CostBasisForm";
import { PageShell, Glass } from "@/components/ui/Glass";

export default async function CostBasisPage() {
  await requireRoles(["owner", "manager"]);
  const cb = await getCostBasis();

  return (
    <PageShell
      eyebrow="Settings"
      title="Cost Basis"
      subtitle="The numbers behind every Job P&L. Tune these to match your real costs — Job Economics + per-job net profit recompute on the fly."
      action={
        <Link
          href="/settings"
          className="px-3 py-1.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.05] text-white/70 text-sm transition-colors"
        >
          ← Settings
        </Link>
      }
      width="narrow"
    >
      <CostBasisForm initial={cb} />

      <Glass subtle className="mt-6 p-4 text-white/40 text-xs leading-relaxed">
        <p className="text-white/70 text-sm font-semibold mb-2">How each field is used</p>
        <ul className="space-y-1.5">
          <li>
            <span className="text-white/70 font-mono">Default hourly rate</span> — applied to a
            tech labor entry when no per-entry rate is set. Override per entry for senior techs / OT.
          </li>
          <li>
            <span className="text-white/70 font-mono">Van cost per job</span> — flat per-job
            allocation for truck/fuel/insurance. Crude but honest until you log per-job mileage.
          </li>
          <li>
            <span className="text-white/70 font-mono">Default equipment daily</span> — used when an
            equipment row's <code>daily_cost</code> is null. Set per-piece on /equipment for
            accuracy on owned vs leased units.
          </li>
          <li>
            <span className="text-white/70 font-mono">Monthly overhead</span> — fixed costs
            (rent, software, admin payroll, insurance) prorated to each window and allocated to
            jobs proportionally to their billed revenue.
          </li>
        </ul>
      </Glass>
    </PageShell>
  );
}
