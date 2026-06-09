import { createServerSupabaseClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  EQUIPMENT_STATUS_COLORS,
  equipmentTypeLabel,
} from "@/lib/equipment-types";
import EditForm from "./EditForm";
import StatusActions from "./StatusActions";
import { getActiveJobs } from "@/app/actions/equipment";

export default async function EquipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const [{ data: equipment }, { data: assignments }, activeJobs] = await Promise.all([
    supabase
      .from("equipment")
      .select("*, jobs:current_job_id(id, job_number, customers(name))")
      .eq("id", id)
      .single(),
    supabase
      .from("equipment_assignments")
      .select(
        "*, jobs(job_number, customers(name)), deployer:profiles!deployed_by(name), retriever:profiles!retrieved_by(name)"
      )
      .eq("equipment_id", id)
      .order("deployed_at", { ascending: false })
      .limit(20),
    getActiveJobs(),
  ]);

  if (!equipment) notFound();

  const currentJob = (equipment as any).jobs;

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/equipment"
          className="text-ink-3 hover:text-ink text-sm transition-colors"
        >
          ← Equipment
        </Link>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <h1 className="text-2xl font-bold text-ink font-mono">
            {equipment.serial_number}
          </h1>
          <span
            className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
              EQUIPMENT_STATUS_COLORS[equipment.status] ?? ""
            }`}
          >
            {equipment.status}
          </span>
          <span className="text-ink-2 text-sm">
            {equipmentTypeLabel(equipment.type)}
          </span>
        </div>
        {currentJob && (
          <p className="text-ink-2 text-sm mt-1">
            Currently deployed to{" "}
            <Link
              href={`/jobs/${currentJob.id}`}
              className="text-info hover:underline font-mono"
            >
              {currentJob.job_number}
            </Link>{" "}
            · {currentJob.customers?.name ?? "—"}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Info + history */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          <section className="glass-card p-6">
            <EditForm
              id={equipment.id}
              defaults={{
                serial_number: equipment.serial_number,
                model: equipment.model ?? "",
                manufacturer: equipment.manufacturer ?? "",
                location_notes: equipment.location_notes ?? "",
                notes: equipment.notes ?? "",
              }}
              meta={{
                hours_logged: Number(equipment.hours_logged ?? 0),
                purchased_at: equipment.purchased_at,
                created_at: equipment.created_at,
              }}
            />
          </section>

          <section className="glass-card p-6">
            <h2 className="text-ink font-semibold mb-4">Assignment History</h2>
            {!assignments?.length ? (
              <p className="text-ink-3 text-sm italic">
                Not yet deployed to any jobs.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-edge2 text-ink-3 text-xs uppercase tracking-wide">
                    <th className="text-left py-2">Job</th>
                    <th className="text-left py-2">Deployed</th>
                    <th className="text-left py-2">Retrieved</th>
                    <th className="text-right py-2">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a: any) => {
                    const hours =
                      a.hours_at_return && a.hours_at_deploy
                        ? Number(a.hours_at_return) - Number(a.hours_at_deploy)
                        : null;
                    return (
                      <tr
                        key={a.id}
                        className="border-b border-edge2/60 last:border-0"
                      >
                        <td className="py-2.5">
                          <Link
                            href={`/jobs/${a.job_id}`}
                            className="text-info hover:underline font-mono text-xs"
                          >
                            {a.jobs?.job_number ?? "—"}
                          </Link>
                          <p className="text-ink-3 text-xs">
                            {a.jobs?.customers?.name ?? "—"}
                          </p>
                        </td>
                        <td className="py-2.5 text-ink-2 text-xs">
                          {new Date(a.deployed_at).toLocaleDateString()}
                          {a.deployer?.name && (
                            <p className="text-ink-3">by {a.deployer.name}</p>
                          )}
                        </td>
                        <td className="py-2.5 text-ink-2 text-xs">
                          {a.retrieved_at ? (
                            <>
                              {new Date(a.retrieved_at).toLocaleDateString()}
                              {a.retriever?.name && (
                                <p className="text-ink-3">by {a.retriever.name}</p>
                              )}
                            </>
                          ) : (
                            <span className="text-info italic">currently deployed</span>
                          )}
                        </td>
                        <td className="py-2.5 text-right text-ink-2 font-mono text-xs">
                          {hours !== null ? hours.toFixed(0) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-col gap-5">
          <section className="glass-card p-5">
            <h2 className="text-ink font-semibold mb-3">Actions</h2>
            <StatusActions
              equipmentId={equipment.id}
              status={equipment.status}
              activeJobs={activeJobs}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
