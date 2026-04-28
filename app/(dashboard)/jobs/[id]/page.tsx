import { createServerSupabaseClient } from "@/lib/supabase";
import { notFound } from "next/navigation";
import Link from "next/link";
import StatusSelector from "./StatusSelector";
import AddNoteForm from "./AddNoteForm";
import { STATUS_COLORS } from "@/lib/constants";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const [{ data: job }, { data: notes }] = await Promise.all([
    supabase
      .from("jobs")
      .select("*, customers(*)")
      .eq("id", id)
      .single(),
    supabase
      .from("job_notes")
      .select("*, profiles(name)")
      .eq("job_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!job) notFound();

  const customer = job.customers as any;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <Link href="/jobs" className="text-zinc-500 hover:text-white text-sm transition-colors">
            ← Jobs
          </Link>
          <div className="flex items-center gap-3 mt-2">
            <h1 className="text-2xl font-bold text-white font-mono">{job.job_number}</h1>
            <span
              className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[job.status] ?? ""}`}
            >
              {job.status}
            </span>
          </div>
          <p className="text-zinc-400 text-sm mt-1 capitalize">
            {job.type} damage · Created {new Date(job.created_at).toLocaleDateString()}
          </p>
        </div>
        <StatusSelector jobId={job.id} currentStatus={job.status} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Job Info + Notes */}
        <div className="col-span-2 flex flex-col gap-5">
          {/* Job Info */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-4">Job Details</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Field label="Site Address" value={job.site_address} />
              <Field
                label="City / State / Zip"
                value={[job.site_city, job.site_state, job.site_zip].filter(Boolean).join(", ")}
              />
              <Field label="Type" value={job.type} capitalize />
              <Field
                label="Estimated Value"
                value={job.estimated_value ? `$${Number(job.estimated_value).toLocaleString()}` : undefined}
              />
              {job.description && (
                <div className="col-span-2">
                  <p className="text-zinc-400 text-xs uppercase tracking-wide mb-1">Description</p>
                  <p className="text-zinc-200">{job.description}</p>
                </div>
              )}
            </div>
          </section>

          {/* Notes */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-4">Notes & Activity</h2>
            <AddNoteForm jobId={job.id} />

            {notes && notes.length > 0 && (
              <div className="mt-5 flex flex-col gap-4 border-t border-zinc-800 pt-5">
                {notes.map((note) => (
                  <div key={note.id} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-zinc-300 text-xs font-medium">
                        {((note.profiles as any)?.name ?? "?")[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-zinc-200 text-sm">{note.content}</p>
                      <p className="text-zinc-500 text-xs mt-1">
                        {(note.profiles as any)?.name ?? "Unknown"} ·{" "}
                        {new Date(note.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right: Customer Info */}
        <div className="flex flex-col gap-5">
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-4">Customer</h2>
            {customer ? (
              <div className="flex flex-col gap-3 text-sm">
                <div>
                  <p className="text-zinc-400 text-xs uppercase tracking-wide mb-0.5">Name</p>
                  <p className="text-white font-medium">{customer.name}</p>
                </div>
                {customer.phone && (
                  <div>
                    <p className="text-zinc-400 text-xs uppercase tracking-wide mb-0.5">Phone</p>
                    <a href={`tel:${customer.phone}`} className="text-blue-400 hover:underline">
                      {customer.phone}
                    </a>
                  </div>
                )}
                {customer.email && (
                  <div>
                    <p className="text-zinc-400 text-xs uppercase tracking-wide mb-0.5">Email</p>
                    <a href={`mailto:${customer.email}`} className="text-blue-400 hover:underline truncate block">
                      {customer.email}
                    </a>
                  </div>
                )}
                {customer.insurance_company && (
                  <div>
                    <p className="text-zinc-400 text-xs uppercase tracking-wide mb-0.5">Insurance</p>
                    <p className="text-zinc-200">{customer.insurance_company}</p>
                    {customer.insurance_claim_number && (
                      <p className="text-zinc-500 text-xs mt-0.5">
                        Claim: {customer.insurance_claim_number}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-zinc-500 text-sm">No customer linked.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  capitalize,
}: {
  label: string;
  value?: string | null;
  capitalize?: boolean;
}) {
  return (
    <div>
      <p className="text-zinc-400 text-xs uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-zinc-200 ${capitalize ? "capitalize" : ""}`}>{value || "—"}</p>
    </div>
  );
}
