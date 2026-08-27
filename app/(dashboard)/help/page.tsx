import Link from "next/link";

const WORKFLOW = [
  {
    step: "1",
    title: "Create the job",
    text: "Enter the customer, loss address, damage type, payment route, and appointment. Start with facts; details can be added later.",
    href: "/jobs/new",
    action: "Create a job",
  },
  {
    step: "2",
    title: "Run the field work",
    text: "Open the job to add photos, document the scope, record moisture, deploy equipment, assign technicians, and leave notes.",
    href: "/jobs",
    action: "Open jobs",
  },
  {
    step: "3",
    title: "Finish the paperwork",
    text: "Prepare authorizations, upload claim files, send documents, and track signatures from the job's Paperwork section.",
    href: "/documents",
    action: "Review paperwork",
  },
  {
    step: "4",
    title: "Bill and collect",
    text: "Enter the manual billing amount, create a draft invoice when needed, record every payment, and keep the remaining balance visible until it is paid.",
    href: "/ar",
    action: "Open receivables",
  },
  {
    step: "5",
    title: "Close and review",
    text: "Confirm documentation is complete, equipment is returned, costs are logged, payment is reconciled, and then close the job.",
    href: "/reports",
    action: "View reports",
  },
];

const QUICK_REFERENCE = [
  ["Home", "The operating snapshot: active jobs, today's schedule, money to collect, and paperwork needing action."],
  ["Jobs", "The source of truth for every loss. Most work should begin and end inside a job."],
  ["Schedule", "Appointments, crew assignments, and dispatch timing."],
  ["My Day", "Mobile field view for each technician's assigned jobs."],
  ["Paperwork", "Cross-job list of drafts, sent documents, signatures, and uploaded files."],
  ["Receivables", "Sent invoices, balances, payments, and overdue money."],
  ["Reports", "Job economics, technician performance, adjuster trends, and accounting export."],
];

export default function HelpPage() {
  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header>
          <p className="text-[10px] uppercase tracking-[0.18em] text-ink-3">FirstCall OS</p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-ink mt-1">How to run the system</h1>
          <p className="text-sm text-ink-2 mt-2 max-w-2xl">
            Keep it simple: one job record, one clear next step, complete paperwork, accurate costs, and a zero balance before closeout.
          </p>
        </header>

        <section className="glass-card p-5 md:p-6">
          <h2 className="text-lg font-semibold text-ink">The operating rule</h2>
          <p className="text-sm text-ink-2 mt-2 leading-relaxed">
            If something belongs to a specific loss—customer communication, photos, scope, equipment, documents, costs, invoice, or payment—put it inside that job. The home screen only tells you where attention is needed.
          </p>
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-ink">Job workflow</h2>
            <p className="text-sm text-ink-3 mt-1">Five stages from intake to closeout.</p>
          </div>
          <div className="space-y-3">
            {WORKFLOW.map((item) => (
              <article key={item.step} className="glass-card p-4 md:p-5 flex gap-4">
                <span className="w-8 h-8 rounded-full bg-cta text-white flex items-center justify-center text-sm font-semibold shrink-0">{item.step}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-ink">{item.title}</h3>
                  <p className="text-sm text-ink-2 mt-1 leading-relaxed">{item.text}</p>
                  <Link href={item.href} className="inline-block text-sm text-info-deep mt-2 hover:underline">{item.action} →</Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink mb-4">Where things live</h2>
          <div className="glass-card overflow-hidden divide-y divide-edge2">
            {QUICK_REFERENCE.map(([name, description]) => (
              <div key={name} className="grid grid-cols-1 sm:grid-cols-[9rem_1fr] gap-1 sm:gap-4 px-4 py-3.5">
                <p className="text-sm font-medium text-ink">{name}</p>
                <p className="text-sm text-ink-2">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-info/15 bg-info/5 p-5">
          <h2 className="font-semibold text-ink">About automation</h2>
          <p className="text-sm text-ink-2 mt-2 leading-relaxed">
            Optional AI tools remain available inside certain job actions and advanced settings, but they are not required to run the business. The operating workflow and stored job records work independently of them.
          </p>
        </section>
      </div>
    </div>
  );
}
