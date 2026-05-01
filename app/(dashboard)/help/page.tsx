import Link from "next/link";
import Logo from "@/components/Logo";

interface AgentMeta {
  emoji: string;
  name: string;
  href: string;
  oneLiner: string;
  what: string;
  when: string;
}

const AGENTS: AgentMeta[] = [
  {
    emoji: "📞",
    name: "Athena",
    href: "/calls",
    oneLiner: "AI call intake.",
    what: "Records or transcribes a customer call, extracts structured intake (caller type, urgency, address, insurance), auto-creates Customer + Job.",
    when: "Every inbound emergency call. Either record the call directly in the browser, or upload a recording.",
  },
  {
    emoji: "📸",
    name: "Argus",
    href: "/jobs",
    oneLiner: "Photo-driven scoping.",
    what: "Reads job-site photos with vision AI, returns IICRC S500-compliant scope: water cat/class, affected materials, equipment plan, drying days.",
    when: "After the tech walks the property and uploads photos. Click 'Analyze' on a job to run scope.",
  },
  {
    emoji: "📋",
    name: "Ledger",
    href: "/jobs",
    oneLiner: "Estimate generator.",
    what: "Converts an Argus scope into Xactimate-style line items at Austin TX market pricing. Editable, versioned.",
    when: "Once Argus has produced a scope. Click 'Generate Estimate' on the job.",
  },
  {
    emoji: "💵",
    name: "Abacus",
    href: "/ar",
    oneLiner: "Billing + AR.",
    what: "Invoices from approved estimates, sends via Resend, records payments, tracks aging.",
    when: "When work wraps up. Convert estimate → invoice, hit Send, then record payments as they arrive.",
  },
  {
    emoji: "🛠",
    name: "Atlas",
    href: "/equipment",
    oneLiner: "Equipment + fleet.",
    what: "Track every dehu/air mover/scrubber by serial. Deploy to a job, retrieve at end, log hours, flag maintenance.",
    when: "Every equipment move. Deploy at start of drying, retrieve at end.",
  },
  {
    emoji: "🎯",
    name: "Hunter",
    href: "/partners/outreach",
    oneLiner: "B2B outreach.",
    what: "Drafts cold emails / voicemail scripts / follow-ups to property managers, plumbers, hotels, insurance offices.",
    when: "When you have a list of partner targets to chase. Add lead → generate draft → review → send via your email client.",
  },
  {
    emoji: "⚖️",
    name: "Esquire",
    href: "/jobs",
    oneLiner: "Legal docs.",
    what: "AI-drafts AOB, Work Authorization, Direction to Pay, Demand Letter (TX § 542.058), Notice of Appraisal, IICRC Drying Certificate.",
    when: "On every job. AOB + Work Auth at intake; Drying Cert at closeout; Demand Letter when a carrier is past 60-day prompt-pay.",
  },
  {
    emoji: "🧠",
    name: "Solomon",
    href: "/solomon",
    oneLiner: "FP&A.",
    what: "Reads jobs/invoices/payments by zip and carrier; flags slow-pay carriers, low-revenue zips, pricing outliers.",
    when: "Monthly. Owner/manager only. Generates a structured insights + recommendations report.",
  },
];

interface DayStep {
  num: number;
  title: string;
  detail: string;
}

const DAILY_STEPS: DayStep[] = [
  {
    num: 1,
    title: "Phone rings",
    detail:
      "Open Athena, hit record (or paste a transcript). It auto-creates the Customer + Job and pre-fills insurance + urgency.",
  },
  {
    num: 2,
    title: "Set the payment route",
    detail:
      "On the new job, pick: Customer-pay / Insurance / Insurance + deductible. This drives what the customer sees on their portal.",
  },
  {
    num: 3,
    title: "Generate AOB + Work Auth (Esquire)",
    detail:
      "Right column → Esquire panel → generate AOB and Work Auth. Print, get signed in person, mark signed in the system.",
  },
  {
    num: 4,
    title: "Tech goes on site, uploads photos",
    detail:
      "On the job page, upload photos. Click Analyze (Argus). You'll get scope + materials + equipment plan in ~30 seconds.",
  },
  {
    num: 5,
    title: "Generate estimate (Ledger), get it approved",
    detail:
      "From the scope, click Generate Estimate. Review line items, edit if needed, mark approved.",
  },
  {
    num: 6,
    title: "Deploy equipment (Atlas), log moisture daily",
    detail:
      "Atlas tracks each unit by serial. Field tech logs psychrometric readings each day on the job page.",
  },
  {
    num: 7,
    title: "Status changes auto-email the customer",
    detail:
      "Flip status to Mitigation / Drying / Completed and the customer auto-receives a branded email update.",
  },
  {
    num: 8,
    title: "Closeout: drying cert + invoice",
    detail:
      "Esquire drafts a Drying Certificate from your moisture log. Ledger estimate becomes an Abacus invoice. Send.",
  },
  {
    num: 9,
    title: "Customer pays online (Stripe)",
    detail:
      "Customer hits the portal link, clicks Pay Online. Stripe handles payment, webhook auto-records it. For deductible jobs, the cap is enforced.",
  },
  {
    num: 10,
    title: "Monthly: Solomon report",
    detail:
      "Run a Solomon analysis to spot carrier slow-pay, geographic outliers, and pricing recommendations. Export QuickBooks CSVs from /reports/quickbooks.",
  },
];

interface FaqItem {
  q: string;
  a: string;
}

const FAQ: FaqItem[] = [
  {
    q: "What if a customer doesn't have insurance?",
    a: "Set Payment Route to 'Customer pays out of pocket' on the job. The customer portal will show a full Pay Online button for the invoice balance.",
  },
  {
    q: "What if my carrier is dragging their feet on payment?",
    a: "Open the job → Esquire → Generate Demand Letter. It cites Tex. Ins. Code § 542.058 (60-day prompt-pay) automatically. Approve → mark sent.",
  },
  {
    q: "How do I get the customer their progress link?",
    a: "On any job, scroll to Customer Portal panel → Generate Customer Link → copy the URL → text/email to customer. They see status, photos, and (if applicable) Pay Online without logging in.",
  },
  {
    q: "What about the insurance adjuster?",
    a: "Same idea but separate. On the job → Adjuster Portal panel → Generate Link. Adjuster sees scope, photos, moisture log, signed AOB — everything they need to approve the claim.",
  },
  {
    q: "Why didn't a customer get my email?",
    a: "Check /settings/audit for the send. Most likely causes: (1) no email on the customer record, (2) auto-notify toggle is off for that customer, (3) Resend domain not verified (one-time setup).",
  },
  {
    q: "What's the difference between a Manager and Owner role?",
    a: "Owner = full access including user management + secrets rotation + PII deletion. Manager = everything operational (jobs, money, reports) but cannot manage users or redact PII. See /settings/users.",
  },
  {
    q: "Where are my backups?",
    a: "/settings/backups. Cron auto-exports every Sunday 03:00 UTC. You can manually trigger one anytime. Owner can download past backups as JSON.",
  },
  {
    q: "Something's broken in production. What do I do?",
    a: "Open /settings/incident-response. The runbook covers: leaked API keys, customer breach, vendor compromise. Severity matrix tells you how fast to react.",
  },
];

export default function HelpPage() {
  return (
    <div className="p-4 md:p-8 max-w-5xl">
      {/* Hero */}
      <section className="mb-8">
        <div className="flex flex-col items-start gap-4">
          <Logo variant="banner" size={48} priority />
          <div>
            <h1 className="text-3xl font-bold text-white">Welcome to FirstCall OS</h1>
            <p className="text-zinc-400 mt-1 max-w-2xl">
              Everything you need to run First Call Mitigation in one place — from
              the moment the phone rings to final payment, with AI agents handling
              the heavy administrative lift so the field crew can focus on the work.
            </p>
          </div>
        </div>
      </section>

      {/* How it fits together */}
      <Section title="How everything fits together">
        <p className="text-zinc-300 leading-relaxed">
          Think of this as a circular org chart, not a pyramid.{" "}
          <strong className="text-white">You and your team</strong> are at the
          edge — making decisions, handling emergencies, building relationships.{" "}
          <strong className="text-white">FirstCall OS</strong> sits in the
          middle as the "intelligence layer," capturing every call, photo,
          reading, and dollar so nothing falls through the cracks. Each AI
          agent handles one slice of the boring admin work.
        </p>
        <div className="mt-4 bg-white/[0.03] border border-zinc-700 rounded-lg p-4 text-sm text-zinc-300 leading-relaxed">
          <p>
            <strong className="text-white">The daily flow:</strong> Athena
            picks up the call → Argus scopes the damage → Ledger prices it →
            Esquire signs the homeowner → Atlas deploys equipment → daily
            moisture readings logged → Abacus invoices → customer pays via
            portal → Solomon flags trends. You stay in the loop on every
            approval gate; the agents draft, you decide.
          </p>
        </div>
      </Section>

      {/* The agents */}
      <Section title="The agents">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {AGENTS.map((a) => (
            <Link
              key={a.name}
              href={a.href}
              className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-5 transition-colors flex flex-col"
            >
              <div className="flex items-baseline gap-2.5">
                <span className="text-2xl">{a.emoji}</span>
                <p className="text-white font-semibold">{a.name}</p>
                <span className="text-zinc-500 text-xs">— {a.oneLiner}</span>
              </div>
              <p className="text-zinc-400 text-sm mt-2 leading-snug">{a.what}</p>
              <p className="text-zinc-500 text-xs mt-2 leading-snug italic">
                <span className="text-zinc-400 not-italic font-medium">
                  When to use:
                </span>{" "}
                {a.when}
              </p>
            </Link>
          ))}
        </div>
      </Section>

      {/* Daily workflow */}
      <Section title="A typical day">
        <ol className="flex flex-col gap-3">
          {DAILY_STEPS.map((s) => (
            <li
              key={s.num}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex gap-4"
            >
              <span className="text-blue-400 font-mono text-sm shrink-0 w-6">
                {s.num.toString().padStart(2, "0")}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm">{s.title}</p>
                <p className="text-zinc-400 text-sm mt-1 leading-snug">
                  {s.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* FAQ */}
      <Section title="FAQ">
        <div className="flex flex-col gap-3">
          {FAQ.map((f, i) => (
            <details
              key={i}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 group open:border-zinc-700"
            >
              <summary className="text-white font-medium cursor-pointer list-none flex justify-between items-start gap-3">
                {f.q}
                <span className="text-zinc-500 text-xs shrink-0 group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>
              <p className="text-zinc-400 text-sm mt-3 leading-snug">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* Quick links */}
      <Section title="Quick links">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
          <QuickLink href="/dashboard" label="Dashboard — triage queue" />
          <QuickLink href="/schedule" label="Schedule — agenda + crew" />
          <QuickLink href="/jobs" label="Jobs — every active loss" />
          <QuickLink href="/customers" label="Customers — who you've helped" />
          <QuickLink href="/calls" label="Calls — Athena intake" />
          <QuickLink href="/equipment" label="Equipment — Atlas fleet" />
          <QuickLink href="/partners/outreach" label="Outreach — Hunter pipeline" />
          <QuickLink href="/ar" label="AR — aging buckets" />
          <QuickLink href="/reports" label="Reports — KPIs + QBO export" />
          <QuickLink href="/solomon" label="Solomon — FP&A" />
          <QuickLink href="/settings" label="Settings — users, audit, backups" />
          <QuickLink href="/progress" label="Progress — roadmap" />
        </div>
      </Section>

      {/* Contact */}
      <section className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-6 mt-5 text-center">
        <p className="text-white font-semibold">
          Stuck? Something doesn't make sense?
        </p>
        <p className="text-zinc-400 text-sm mt-2">
          Email{" "}
          <a
            href="mailto:hello@firstcallm.com"
            className="text-blue-400 hover:underline"
          >
            hello@firstcallm.com
          </a>{" "}
          and we'll get you sorted.
        </p>
      </section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold text-white mb-3">{title}</h2>
      {children}
    </section>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-colors"
    >
      {label}
    </Link>
  );
}
