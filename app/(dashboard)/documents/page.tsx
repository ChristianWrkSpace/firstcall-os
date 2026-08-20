import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requireRoles } from "@/components/RoleGate";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Filter = "needs-action" | "signed" | "all";

const DOC_LABELS: Record<string, string> = {
  work_authorization: "Work authorization",
  direction_to_pay: "Direction to pay",
  certificate_of_completion: "Certificate of completion",
  demand_letter: "Demand letter",
  notice_of_intent_to_lien: "Notice of intent to lien",
  mold_disclosure: "Mold disclosure",
  other: "Other document",
};

export default async function PaperworkPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requireRoles(["owner", "manager", "office"]);
  const { filter: rawFilter } = await searchParams;
  const filter: Filter = ["needs-action", "signed", "all"].includes(rawFilter ?? "")
    ? (rawFilter as Filter)
    : "needs-action";
  const supabase = await createServerSupabaseClient();

  const [{ data: generated }, { data: uploads }] = await Promise.all([
    supabase
      .from("legal_documents")
      .select("id, job_id, doc_type, subject, status, created_at, sent_at, signed_at, jobs(job_number, is_test, customers(name))")
      .order("created_at", { ascending: false }),
    supabase
      .from("job_documents")
      .select("id, job_id, doc_type, filename, signed, signed_at, created_at, jobs(job_number, is_test, customers(name))")
      .order("created_at", { ascending: false }),
  ]);

  const allDocuments = [
    ...(generated ?? []).filter((doc: any) => !normalizeJob(doc.jobs).isTest).map((doc: any) => ({
      id: `generated-${doc.id}`,
      docId: doc.id,
      jobId: doc.job_id,
      title: doc.subject || DOC_LABELS[doc.doc_type] || humanize(doc.doc_type),
      kind: DOC_LABELS[doc.doc_type] || humanize(doc.doc_type),
      status: doc.signed_at ? "signed" : doc.sent_at ? "awaiting signature" : doc.status === "draft" ? "draft" : doc.status,
      signed: Boolean(doc.signed_at),
      needsAction: !doc.signed_at && ["draft", "approved", "sent"].includes(doc.status),
      generated: true,
      createdAt: doc.created_at,
      job: normalizeJob(doc.jobs),
    })),
    ...(uploads ?? []).filter((doc: any) => !normalizeJob(doc.jobs).isTest).map((doc: any) => ({
      id: `upload-${doc.id}`,
      docId: doc.id,
      jobId: doc.job_id,
      title: doc.filename,
      kind: DOC_LABELS[doc.doc_type] || humanize(doc.doc_type),
      status: doc.signed || doc.signed_at ? "signed" : "filed",
      signed: Boolean(doc.signed || doc.signed_at),
      needsAction: false,
      generated: false,
      createdAt: doc.created_at,
      job: normalizeJob(doc.jobs),
    })),
  ].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());

  const counts = {
    "needs-action": allDocuments.filter((doc) => doc.needsAction).length,
    signed: allDocuments.filter((doc) => doc.signed).length,
    all: allDocuments.length,
  };

  const visible = allDocuments.filter((doc) => {
    if (filter === "needs-action") return doc.needsAction;
    if (filter === "signed") return doc.signed;
    return true;
  });

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-ink-3">Office</p>
            <h1 className="text-2xl font-semibold text-ink mt-1">Paperwork</h1>
            <p className="text-sm text-ink-2 mt-1">Every job document, send, and signature in one place.</p>
          </div>
          <Link href="/jobs" className="min-h-11 inline-flex items-center rounded-xl border border-edge2 bg-card px-4 py-2 text-sm font-medium text-ink hover:bg-shade transition-colors">
            Open a job to add paperwork
          </Link>
        </header>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <Summary label="Needs action" value={counts["needs-action"]} warn />
          <Summary label="Signed" value={counts.signed} />
          <Summary label="Total files" value={counts.all} />
        </div>

        <nav className="flex gap-2 flex-wrap mb-5" aria-label="Paperwork filters">
          {([
            ["needs-action", "Needs action"],
            ["signed", "Signed"],
            ["all", "All paperwork"],
          ] as const).map(([value, label]) => (
            <Link
              key={value}
              href={value === "needs-action" ? "/documents" : `/documents?filter=${value}`}
              className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${filter === value ? "border-[#D97757]/30 bg-cta/10 text-cta-deep" : "border-edge2 bg-card text-ink-2 hover:bg-shade"}`}
            >
              {label} <span className="ml-1 text-ink-3">{counts[value]}</span>
            </Link>
          ))}
        </nav>

        {!visible.length ? (
          <div className="glass-card px-6 py-14 text-center">
            <p className="text-sm font-medium text-ink">Nothing in this view.</p>
            <p className="text-sm text-ink-3 mt-1">Paperwork is added from inside each job.</p>
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <div className="divide-y divide-edge2">
              {visible.map((doc) => (
                <Link
                  key={doc.id}
                  href={doc.generated ? `/jobs/${doc.jobId}/legal/${doc.docId}` : `/jobs/${doc.jobId}#paperwork`}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-shade/70 transition-colors group"
                >
                  <span className="w-9 h-9 rounded-lg bg-shade border border-edge2 flex items-center justify-center text-ink-2 shrink-0">▧</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-ink truncate">{doc.title}</p>
                      <Status value={doc.status} />
                    </div>
                    <p className="text-xs text-ink-3 mt-1 truncate">
                      {doc.job.jobNumber || "Job"} · {doc.job.customer || "No customer"} · {doc.kind}
                    </p>
                  </div>
                  <p className="hidden sm:block text-xs text-ink-3 shrink-0">
                    {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : ""}
                  </p>
                  <span className="text-ink-3 group-hover:translate-x-0.5 transition-transform">›</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Summary({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="glass-card p-4">
      <p className="text-[10px] uppercase tracking-[0.12em] text-ink-3">{label}</p>
      <p className={`text-xl font-semibold mt-2 tabular-nums ${warn && value > 0 ? "text-honey" : "text-ink"}`}>{value}</p>
    </div>
  );
}

function Status({ value }: { value: string }) {
  const tone = value === "signed"
    ? "bg-pine/10 text-pine"
    : value === "awaiting signature"
      ? "bg-honey/10 text-honey"
      : "bg-tint text-ink-2";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${tone}`}>{value}</span>;
}

function normalizeJob(value: any) {
  const job = Array.isArray(value) ? value[0] : value;
  const customer = Array.isArray(job?.customers) ? job.customers[0] : job?.customers;
  return { jobNumber: job?.job_number ?? null, customer: customer?.name ?? null, isTest: Boolean(job?.is_test) };
}

function humanize(value: string | null) {
  return (value || "Document").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
