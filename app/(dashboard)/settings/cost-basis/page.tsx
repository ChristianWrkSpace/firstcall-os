import { requireRoles } from "@/components/RoleGate";
import { getCostBasis } from "@/lib/job-pnl";
import Link from "next/link";
import CostBasisForm from "./CostBasisForm";

export default async function CostBasisPage() {
  await requireRoles(["owner", "manager"]);
  const cb = await getCostBasis();

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="mb-6">
        <Link
          href="/settings"
          className="text-ink-3 hover:text-ink text-sm transition-colors"
        >
          ← Settings
        </Link>
        <h1 className="text-2xl font-bold text-ink mt-2">Cost Basis</h1>
        <p className="text-ink-2 text-sm mt-0.5">
          The numbers behind every Job P&L. Tune these to match your real costs —
          Job Economics + per-job net profit recompute on the fly.
        </p>
      </div>

      <CostBasisForm initial={cb} />

      <div className="mt-6 bg-card border border-edge2 rounded-lg p-4 text-ink-3 text-xs leading-relaxed">
        <p className="text-ink-2 text-sm font-semibold mb-2">How each field is used</p>
        <ul className="space-y-1.5">
          <li>
            <span className="text-ink-2 font-mono">Default hourly rate</span> — applied to a
            tech labor entry when no per-entry rate is set. Override per entry for senior techs / OT.
          </li>
          <li>
            <span className="text-ink-2 font-mono">Van cost per job</span> — flat per-job
            allocation for truck/fuel/insurance. Crude but honest until you log per-job mileage.
          </li>
          <li>
            <span className="text-ink-2 font-mono">Default equipment daily</span> — used when an
            equipment row's <code>daily_cost</code> is null. Set per-piece on /equipment for
            accuracy on owned vs leased units.
          </li>
          <li>
            <span className="text-ink-2 font-mono">Monthly overhead</span> — fixed costs
            (rent, software, admin payroll, insurance) prorated to each window and allocated to
            jobs proportionally to their billed revenue.
          </li>
        </ul>
      </div>
    </div>
  );
}
