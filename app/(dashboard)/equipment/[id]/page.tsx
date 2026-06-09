import { createServerSupabaseClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { equipmentTypeLabel } from "@/lib/equipment-types";
import EditForm from "./EditForm";
import StatusActions from "./StatusActions";
import { getActiveJobs } from "@/app/actions/equipment";
import { Glass, PageBackdrop, GlassRow, EmptyState } from "@/components/ui/Glass";

// Equipment-status pills in the glass palette (mirrors the equipment list).
const EQ_STATUS_GLASS: Record<string, string> = {
  available:   "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
  deployed:    "bg-[#6B8AD9]/10 text-[#A6B8E7] ring-[#6B8AD9]/20",
  maintenance: "bg-amber-400/10 text-amber-300 ring-amber-400/20",
  retired:     "bg-white/5 text-white/35 ring-white/10",
};

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
    <PageBackdrop>
      <div className="p-4 md:p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/equipment"
            className="text-white/40 hover:text-white text-sm transition-colors"
          >
            ← Equipment
          </Link>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight text-white/95 font-mono">
              {equipment.serial_number}
            </h1>
            <span
              className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-medium capitalize ring-1 ${
                EQ_STATUS_GLASS[equipment.status] ?? EQ_STATUS_GLASS.retired
              }`}
            >
              {equipment.status}
            </span>
            <span className="text-white/45 text-sm">{equipmentTypeLabel(equipment.type)}</span>
          </div>
          {currentJob && (
            <p className="text-white/45 text-sm mt-1">
              Currently deployed to{" "}
              <Link
                href={`/jobs/${currentJob.id}`}
                className="text-[#A6B8E7] hover:text-white font-mono transition-colors"
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
            <Glass className="p-6">
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
            </Glass>

            <Glass className="p-6">
              <h2 className="text-white/90 font-semibold mb-4">Assignment History</h2>
              {!assignments?.length ? (
                <EmptyState icon="🛠" title="Not yet deployed to any jobs." />
              ) : (
                <div className="flex flex-col gap-2">
                  {assignments.map((a: any, i: number) => {
                    const hours =
                      a.hours_at_return && a.hours_at_deploy
                        ? Number(a.hours_at_return) - Number(a.hours_at_deploy)
                        : null;
                    return (
                      <GlassRow
                        key={a.id}
                        href={`/jobs/${a.job_id}`}
                        index={i}
                        meta={
                          <span className="text-white/45 text-[11px]">
                            {new Date(a.deployed_at).toLocaleDateString()}
                            {a.deployer?.name ? ` by ${a.deployer.name}` : ""} →{" "}
                            {a.retrieved_at ? (
                              `${new Date(a.retrieved_at).toLocaleDateString()}${a.retriever?.name ? ` by ${a.retriever.name}` : ""}`
                            ) : (
                              <span className="text-[#A6B8E7]">currently deployed</span>
                            )}
                          </span>
                        }
                        title={<span className="font-mono text-[#A6B8E7]">{a.jobs?.job_number ?? "—"}</span>}
                        sub={a.jobs?.customers?.name ?? "—"}
                        trailing={
                          <span className="text-white/70 font-mono text-xs">
                            {hours !== null ? `${hours.toFixed(0)}h` : a.retrieved_at ? "—" : "active"}
                          </span>
                        }
                      />
                    );
                  })}
                </div>
              )}
            </Glass>
          </div>

          {/* Right: Actions */}
          <div className="flex flex-col gap-5">
            <Glass className="p-5">
              <h2 className="text-white/90 font-semibold mb-3">Actions</h2>
              <StatusActions
                equipmentId={equipment.id}
                status={equipment.status}
                activeJobs={activeJobs}
              />
            </Glass>
          </div>
        </div>
      </div>
    </PageBackdrop>
  );
}
