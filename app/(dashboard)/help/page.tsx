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
    emoji: "🤖",
    name: "Echo",
    href: "/command-center",
    oneLiner: "Your personal assistant.",
    what: "Ask anything in plain English — 'which jobs need my attention today?', 'how much have we billed this month?', 'show me Mrs. Garcia's address'. Lives in the bar at the top of every page.",
    when: "Anytime you'd otherwise click around hunting for info. Just type or tap the mic.",
  },
  {
    emoji: "📞",
    name: "Athena",
    href: "/calls",
    oneLiner: "Takes phone calls.",
    what: "Records the call (or paste a transcript), pulls out the customer name, address, insurance, urgency, and damage type — then makes the new Customer + Job for you.",
    when: "Every emergency call. Open Athena, hit Record, talk to the customer, hit Stop.",
  },
  {
    emoji: "📸",
    name: "Argus",
    href: "/jobs",
    oneLiner: "Looks at photos and writes the scope.",
    what: "Reads the photos your tech took on site and writes up: how bad the damage is, what materials are wet, what equipment to drop, how many days of drying. Industry-standard format (IICRC S500).",
    when: "After your tech uploads photos. Click 'Analyze with Argus' on the job.",
  },
  {
    emoji: "📋",
    name: "Ledger",
    href: "/jobs",
    oneLiner: "Writes the estimate.",
    what: "Turns the Argus scope into priced line items in the format insurance recognizes (Xactimate-style). You can edit any line before sending.",
    when: "After Argus finishes. Click 'Generate Estimate' on the job.",
  },
  {
    emoji: "💵",
    name: "Abacus",
    href: "/ar",
    oneLiner: "Sends invoices, tracks who owes you.",
    what: "Turns approved estimates into invoices, emails them to the customer, records payments when they come in, and tells you who's behind.",
    when: "When the job is done. From the estimate, hit 'Convert to Invoice' → 'Send'.",
  },
  {
    emoji: "🛠",
    name: "Atlas",
    href: "/equipment",
    oneLiner: "Tracks your gear.",
    what: "Every dehu, air mover, and scrubber in your van logged by serial number. Knows what's deployed where and what needs maintenance.",
    when: "When you drop or pick up equipment. Tap 'Deploy' or 'Retrieve' on the job.",
  },
  {
    emoji: "🎯",
    name: "Hunter",
    href: "/partners/outreach",
    oneLiner: "Writes outreach emails.",
    what: "Drafts cold emails, voicemail scripts, and follow-ups for property managers, plumbers, hotels, and insurance offices — so you can build the referral pipeline.",
    when: "When you have a list of partners to chase. Add the lead → generate the draft → review → send.",
  },
  {
    emoji: "⚖️",
    name: "Esquire",
    href: "/jobs",
    oneLiner: "Writes the legal paperwork.",
    what: "Drafts AOB, Work Authorization, Direction to Pay, Demand Letter (TX 60-day prompt-pay law), Notice of Appraisal, Drying Certificate.",
    when: "AOB + Work Auth at the start of every job. Drying Cert at the end. Demand Letter when the carrier sits on a claim past 60 days.",
  },
  {
    emoji: "🧠",
    name: "Solomon",
    href: "/solomon",
    oneLiner: "Tells you which carriers and zips to chase.",
    what: "Reads your jobs, invoices, and payments by zip and carrier. Flags carriers that pay slow, zips that pay too little, and prices that are out of line.",
    when: "Once a month. Owner/manager. Spits out a written report with recommendations.",
  },
];

interface DayStep {
  num: number;
  title: string;
  detail: string;
  tip?: string;
}

const DAILY_STEPS: DayStep[] = [
  {
    num: 1,
    title: "Phone rings — open Athena",
    detail:
      "Click 'Calls' in the left menu → 'New Call' → tap the big Record button while the customer is talking. When you hang up, hit Stop. Athena pulls out the name, address, insurance — and creates the Customer + Job automatically.",
    tip: "Don't have insurance info yet? Doesn't matter. You can fill it in later from the job page.",
  },
  {
    num: 2,
    title: "Set the payment route",
    detail:
      "On the new job, look for the 'Payment Route' card on the right. Pick one: Customer pays out of pocket / Insurance pays everything / Insurance + customer pays the deductible. This drives what the customer sees on their portal.",
  },
  {
    num: 3,
    title: "Esquire drafts AOB + Work Auth",
    detail:
      "These auto-draft as soon as you create an insurance job — check the 'Paperwork' section on the job page. Print, get the homeowner to sign on site, then upload the signed copy back (or have them sign electronically using the link Esquire makes).",
  },
  {
    num: 4,
    title: "Tech goes on site — uploads photos OR a video walk-through",
    detail:
      "On the job page, scroll to 'Site Photos & Scope'. Two ways to capture damage: (a) Upload photos one or many at a time, OR (b) hit '🎥 Record Video' and walk every wet room — we pull frames automatically.",
    tip: "The phone's back camera works for both. iPhone .mov and Android .mp4 both fine.",
  },
  {
    num: 5,
    title: "Argus analyzes — get the scope",
    detail:
      "Hit '✨ Analyze with Argus'. ~20-30 seconds and you'll have: water category (1/2/3), damaged materials, equipment plan, drying days, and a containment plan. If you uploaded 50+ photos, hit '🔬 Deep scan all N' instead — it looks at every single photo.",
  },
  {
    num: 6,
    title: "Generate the estimate (Ledger), get it approved",
    detail:
      "Click 'Generate Estimate' on the job. Ledger writes the line items at Austin market pricing. Edit anything you want, mark Approved. The customer can sign it from their portal.",
  },
  {
    num: 7,
    title: "Drop equipment (Atlas), log moisture daily",
    detail:
      "Equipment On Site card → 'Deploy Equipment' → pick from your van inventory. Each day on site, scroll to 'Moisture Readings' → log the room reading. The drying cert at the end pulls from this log.",
  },
  {
    num: 8,
    title: "Status changes auto-email the customer",
    detail:
      "Use the status dropdown at the top of the job to flip between Scheduled → Mitigation → Drying → Completed. The customer gets a branded email at each step automatically.",
  },
  {
    num: 9,
    title: "Closeout: drying certificate + invoice",
    detail:
      "When you're done drying, Esquire drafts the Drying Certificate from your moisture log. Convert the approved estimate into an invoice in Abacus — hit 'Send'.",
  },
  {
    num: 10,
    title: "Customer pays online (Stripe)",
    detail:
      "Customer hits the portal link, clicks 'Pay Online'. Stripe handles the card. The payment auto-records itself and the invoice marks Paid.",
  },
  {
    num: 11,
    title: "End of month — Solomon report",
    detail:
      "Click Solomon in the left menu → 'Run Analysis'. You get a written report on slow-pay carriers, weak zips, and pricing outliers. Export QuickBooks CSV from /reports/quickbooks.",
  },
];

interface FaqItem {
  q: string;
  a: string;
}

const FAQ: FaqItem[] = [
  {
    q: "I took the call but didn't get the policy/claim # — can I add it later?",
    a: "Yes. Open the job → 'Customer' card on the right → click 'Edit'. Same for the address and damage type — 'Job Details' card → 'Edit'. Save when you're done.",
  },
  {
    q: "I typed the wrong customer name (or just a first name).",
    a: "Job page → 'Customer' card → 'Edit' → fix the name → Save. Doesn't break anything downstream.",
  },
  {
    q: "How do I get the customer their progress link?",
    a: "Job page → scroll to 'Customer Portal' panel → 'Generate Link' → copy → text or email it to the customer. They see status, photos, and Pay Online — no login needed.",
  },
  {
    q: "What about the insurance adjuster?",
    a: "Same idea, separate link. Job page → 'Adjuster Portal' panel → 'Generate Link'. The adjuster sees scope, photos, moisture log, signed AOB — everything they need to approve the claim.",
  },
  {
    q: "What if a customer doesn't have insurance?",
    a: "Set Payment Route to 'Customer pays out of pocket' on the job. Their portal will show a full Pay Online button for the invoice balance.",
  },
  {
    q: "What if my carrier is dragging their feet on payment?",
    a: "Open the job → Esquire → 'Generate Demand Letter'. It cites Tex. Ins. Code § 542.058 (60-day prompt-pay) automatically. Approve → mark sent.",
  },
  {
    q: "How do I record a video walk-through?",
    a: "Job page → 'Site Photos & Scope' → '🎥 Record Video'. Phone opens the back camera. Walk every wet room narrating what you see, hit stop. Upload. We pull frames automatically and Argus analyzes them.",
  },
  {
    q: "The video upload says 'could not decode' — what do I do?",
    a: "It auto-uploads the original and falls back to manual photo capture. As a backup, take a few still photos of the worst rooms and upload those — Argus works the same on photos as it does on video frames.",
  },
  {
    q: "Argus seems to miss stuff on a 50-photo job.",
    a: "Quick mode samples 16 representative photos to stay fast. For big claim packets, use the '🔬 Deep scan all N' button instead — it looks at every photo in batches and synthesizes one unified scope. Slower (~60-90s) but covers everything.",
  },
  {
    q: "I deleted a photo by accident.",
    a: "Photos can't be undeleted — you'll need to re-upload from your phone. The original is still in your camera roll.",
  },
  {
    q: "I marked a job 'Completed' too early.",
    a: "Just change the status back. The customer will get whatever email goes with the new status — it's safe to flip back and forth.",
  },
  {
    q: "Why didn't a customer get my email?",
    a: "Check /settings/audit for the send. Most likely: (1) no email on the customer record, (2) the auto-notify toggle is off for that customer, (3) Resend domain not verified (one-time setup).",
  },
  {
    q: "What's the difference between Manager and Owner?",
    a: "Owner = full access including user management, secrets rotation, PII deletion. Manager = everything operational (jobs, money, reports) but can't manage users or redact PII. Manage in /settings/users.",
  },
  {
    q: "Where are my backups?",
    a: "/settings/backups. Cron auto-exports every Sunday 03:00 UTC. You can also trigger one manually anytime. Owner can download past backups as JSON.",
  },
  {
    q: "Something's broken in production. What do I do?",
    a: "Open /settings/incident-response. The runbook covers leaked API keys, customer breach, and vendor compromise — including how fast to react.",
  },
  {
    q: "Can I ask Echo to do things for me?",
    a: "Echo answers questions and points you to the right place — it doesn't take destructive actions on its own. Try: 'show me jobs missing a signed AOB', 'how much did we collect this week?', 'what's Mrs. Garcia's phone number?'.",
  },
];

interface HowTo {
  title: string;
  steps: string[];
}

const HOW_TO: HowTo[] = [
  {
    title: "Take a new call (start a job)",
    steps: [
      "Click 'Calls' in the left menu.",
      "Click 'New Call'. Tap the red Record button.",
      "Talk to the customer. When you hang up, tap Stop.",
      "Wait ~10 seconds for Athena to transcribe and pull out the details.",
      "Click 'Create Job from this call' — it pre-fills the Customer + Job.",
      "Don't have everything yet (claim #, full name)? That's fine. You can fix it later.",
    ],
  },
  {
    title: "Fix something you typed wrong on a new job",
    steps: [
      "Open the job (Jobs in the left menu → click the row).",
      "To fix customer info (name, phone, email, insurance, policy #, claim #): right side → 'Customer' card → 'Edit' → make changes → Save.",
      "To fix the address or damage type: left side → 'Job Details' card → 'Edit' → make changes → Save.",
      "Both update instantly. No paperwork needs to be regenerated unless the changes affect what AOB/Work Auth says.",
    ],
  },
  {
    title: "Capture damage with a video walk-through",
    steps: [
      "On site, open the job on your phone.",
      "Scroll to 'Site Photos & Scope'. Tap '🎥 Record Video'.",
      "The phone opens the back camera. Walk every wet room slowly. Narrate ('here's the kitchen ceiling, here's the master bath').",
      "Tap stop. The video uploads, frames are pulled automatically.",
      "Argus analyzes the frames and writes the scope — about 30 seconds.",
    ],
  },
  {
    title: "Get a homeowner to sign the AOB",
    steps: [
      "Open the job. Scroll to 'Paperwork' → 'Esquire-drafted'.",
      "AOB + Work Auth are usually already drafted (Esquire auto-runs at intake on insurance jobs).",
      "Click the AOB → review → 'Approve'.",
      "Two options: (a) print and have them sign in person, then upload the signed scan, OR (b) click 'Send for E-Signature' and they sign on their phone.",
      "Either way, the system marks it 'Signed' once it's done.",
    ],
  },
  {
    title: "Send an invoice",
    steps: [
      "Open the job. Find the approved estimate in the 'Estimates' section.",
      "Click the estimate → 'Convert to Invoice'.",
      "Review the invoice. Click 'Send'.",
      "Customer gets a branded email with a Pay Online button (Stripe).",
      "When they pay, the invoice automatically marks itself Paid.",
    ],
  },
  {
    title: "Add a new tech to the team",
    steps: [
      "Go to Settings → Users (left menu, bottom).",
      "Click 'Invite User'. Enter their email, pick a role (Tech, Manager, Owner).",
      "They get an email with a link to set their password.",
      "Once they're in, you can assign them to jobs from the 'Schedule & Crew' card on any job.",
    ],
  },
  {
    title: "Find any job, customer, or invoice fast",
    steps: [
      "Use Echo (top bar). Type plainly: 'Garcia job', 'this week's invoices', 'mold jobs'.",
      "Or use the regular nav — Jobs / Customers / AR — and the search box at the top of those pages.",
      "On any list, you can sort by clicking the column headers.",
    ],
  },
];

interface GlossaryTerm {
  term: string;
  meaning: string;
}

const GLOSSARY: GlossaryTerm[] = [
  {
    term: "AOB",
    meaning:
      "Assignment of Benefits. The form the homeowner signs to let us bill insurance directly instead of them paying us and getting reimbursed.",
  },
  {
    term: "Work Authorization",
    meaning:
      "The form that says 'yes, do the work'. Required before we touch anything. Esquire auto-drafts it.",
  },
  {
    term: "Direction to Pay",
    meaning:
      "Tells the insurance company to send the claim check straight to us, not the homeowner.",
  },
  {
    term: "Cat 1 / Cat 2 / Cat 3",
    meaning:
      "Water cleanliness category. Cat 1 = clean water (broken supply line). Cat 2 = grey water (washing machine overflow). Cat 3 = sewage / floodwater. Drives PPE and what we can save vs. tear out.",
  },
  {
    term: "IICRC S500",
    meaning:
      "Industry standard for water damage restoration. Argus follows it when writing scopes — categories, classes, drying targets.",
  },
  {
    term: "Drying Certificate",
    meaning:
      "Document that proves the structure is back to normal moisture levels. Required for closeout. Pulls from your daily moisture readings.",
  },
  {
    term: "Adjuster",
    meaning:
      "The insurance company's person who approves or denies the claim. They want photos, scope, and moisture logs — all available via the Adjuster Portal link.",
  },
  {
    term: "Deductible",
    meaning:
      "Amount the homeowner pays out of pocket; insurance covers the rest. Pick 'Insurance + deductible' on the payment route to charge only that amount.",
  },
  {
    term: "Containment",
    meaning:
      "Plastic sheeting that seals off the wet/affected area so contamination and dust don't spread. Argus tells you where to put it.",
  },
  {
    term: "Demand Letter",
    meaning:
      "Formal letter to a slow-paying carrier citing Texas 60-day prompt-pay law (§ 542.058). Esquire drafts it; you approve and send.",
  },
  {
    term: "PII",
    meaning:
      "Personally Identifiable Information. Names, phones, addresses, claim #s. The Owner can redact a customer's PII from /settings/pii-inventory if they request deletion.",
  },
];

interface RecoveryStep {
  problem: string;
  fix: string;
}

const RECOVERY: RecoveryStep[] = [
  {
    problem: "I created the job under the wrong customer.",
    fix: "Right now there's no 'move job to different customer' button — fastest fix is to edit the customer record on that job (Customer card → Edit) to match the correct person. If they're truly different people, create a new job under the right customer and mark the wrong one Cancelled.",
  },
  {
    problem: "I sent the customer the wrong portal link.",
    fix: "On the job, scroll to 'Customer Portal' card → 'Regenerate Link'. The old one stops working immediately. Send the new one.",
  },
  {
    problem: "I uploaded a photo that shouldn't be there (privacy / wrong job).",
    fix: "Click the photo in the gallery → trash icon → confirm. Gone immediately from both the gallery and the customer/adjuster portal.",
  },
  {
    problem: "Argus wrote a wrong scope (e.g. called it Cat 2 when it's Cat 1).",
    fix: "Add or remove photos to give Argus better evidence, then click '🔄 Re-analyze'. The new scope replaces the old one. If still wrong, you can edit the estimate line items by hand.",
  },
  {
    problem: "I sent an invoice for the wrong amount.",
    fix: "Open the invoice → 'Void'. Generate a new invoice from the corrected estimate. The customer's portal updates automatically.",
  },
  {
    problem: "Customer paid in cash, not through the portal.",
    fix: "Open the invoice → 'Record Payment' → enter the amount + 'Cash' → Save. Marks the invoice Paid (or Partial if it's not the full balance).",
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
              the moment the phone rings to the final payment. AI agents handle the
              boring admin so the field crew can focus on the work.
            </p>
          </div>
        </div>
      </section>

      {/* Brand-new? Start here */}
      <section className="mb-8 bg-blue-500/5 border border-blue-500/20 rounded-xl p-6">
        <p className="text-blue-300 text-xs uppercase tracking-wide font-semibold mb-2">
          New here? Read this first.
        </p>
        <h2 className="text-xl font-bold text-white mb-3">
          The 30-second mental model
        </h2>
        <ol className="flex flex-col gap-2 text-sm text-zinc-300 list-decimal list-inside leading-relaxed">
          <li>
            <strong className="text-white">Every customer call becomes a Job.</strong>{" "}
            Either Athena makes it for you (record the call), or you click 'New Job' yourself.
          </li>
          <li>
            <strong className="text-white">Every Job has one page</strong> with everything about
            it — photos, paperwork, equipment, estimate, invoice, customer details.
          </li>
          <li>
            <strong className="text-white">AI agents handle the work nobody likes</strong> —
            Argus reads your photos and writes the scope, Ledger prices the estimate,
            Esquire writes the legal docs, Abacus chases payment.
          </li>
          <li>
            <strong className="text-white">You stay in control.</strong> Every AI draft has an
            Approve button. Nothing gets sent to a customer or carrier without you saying yes.
          </li>
          <li>
            <strong className="text-white">Don't worry about typos.</strong> Almost everything
            has an Edit button. If you took a call without the claim #, just plug it in later.
          </li>
        </ol>
      </section>

      {/* What's new — recent shipped work, in plain English */}
      <section className="mb-8 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-6">
        <p className="text-emerald-300 text-xs uppercase tracking-wide font-semibold mb-2">
          What's new — May 5, 2026
        </p>
        <h2 className="text-xl font-bold text-white mb-3">
          Pricing got more honest, AI got more flexible
        </h2>
        <ul className="flex flex-col gap-3 text-sm text-zinc-300 leading-relaxed">
          <li>
            <strong className="text-white">📒 Estimates stop drifting.</strong>{" "}
            Ledger now uses a reviewed Xactimate price book as the source of truth.
            Every line gets tagged{" "}
            <span className="text-green-400 font-semibold">book</span> (price came
            from your reviewed list) or{" "}
            <span className="text-yellow-400 font-semibold">guess</span> (AI invented
            it). A panel at the top of every estimate tells you exactly how much of
            the total is anchored vs guessed — so you know which lines to scrutinize
            before clicking send.{" "}
            <Link
              href="/settings/price-book"
              className="text-blue-400 hover:underline"
            >
              Manage the book →
            </Link>
          </li>
          <li>
            <strong className="text-white">🛰 The Command Center sees every AI provider.</strong>{" "}
            The Compute panel now splits spend by provider (Anthropic / Google /
            DeepSeek), not just by tier. So when calls start routing through
            Gemini or DeepSeek, you'll see it instantly.
          </li>
          <li>
            <strong className="text-white">⚡ Any agent can be swapped to a cheaper model — no redeploy.</strong>{" "}
            Set an env var like{" "}
            <code className="text-blue-300 bg-blue-500/10 px-1 rounded text-xs">
              MODEL_HUNTER=deepseek/deepseek-v3
            </code>{" "}
            and Hunter routes through DeepSeek (5–15× cheaper for cold-email
            drafts). Already live for Hunter today.{" "}
            <Link
              href="/settings/ai-routing"
              className="text-blue-400 hover:underline"
            >
              See routing →
            </Link>
          </li>
          <li>
            <strong className="text-white">🛟 If a provider has an outage, calls auto-fail-over.</strong>{" "}
            When the primary model fails with a network or server error, the system
            silently retries on a different provider. The agent doing the work
            doesn't even know it happened.
          </li>
          <li>
            <strong className="text-white">🩹 Argus vision calls don't hang anymore.</strong>{" "}
            Fixed a retry bug where photo-scope assessments were timing out at 3
            minutes instead of 60 seconds. Vision calls now complete reliably.
          </li>
        </ul>
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
      <Section title="A typical day, step by step">
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
                {s.tip && (
                  <p className="mt-2 text-[#A8DCD3] text-xs bg-[#A8DCD3]/5 border border-[#A8DCD3]/15 rounded px-2 py-1.5 leading-snug">
                    💡 {s.tip}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* How to ___ recipes */}
      <Section title="How do I…">
        <div className="flex flex-col gap-3">
          {HOW_TO.map((ht) => (
            <details
              key={ht.title}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 group open:border-zinc-700"
            >
              <summary className="text-white font-medium cursor-pointer list-none flex justify-between items-center gap-3">
                {ht.title}
                <span className="text-zinc-500 text-xs shrink-0 group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>
              <ol className="mt-3 flex flex-col gap-2 text-sm text-zinc-300 list-decimal list-inside leading-relaxed marker:text-zinc-500">
                {ht.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </details>
          ))}
        </div>
      </Section>

      {/* Oops recovery */}
      <Section title="Oops — I messed up. How do I fix it?">
        <p className="text-zinc-400 text-sm mb-3">
          Almost nothing in this system is unrecoverable. Here's how to fix
          the common mistakes.
        </p>
        <div className="flex flex-col gap-2">
          {RECOVERY.map((r, i) => (
            <details
              key={i}
              className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 group open:border-amber-500/30"
            >
              <summary className="text-white font-medium cursor-pointer list-none flex justify-between items-start gap-3">
                {r.problem}
                <span className="text-amber-400/70 text-xs shrink-0 group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>
              <p className="text-zinc-300 text-sm mt-3 leading-snug">{r.fix}</p>
            </details>
          ))}
        </div>
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

      {/* Glossary */}
      <Section title="Restoration vocab cheat-sheet">
        <p className="text-zinc-400 text-sm mb-3">
          Industry terms that come up in scopes, paperwork, and on calls with
          adjusters.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {GLOSSARY.map((g) => (
            <div
              key={g.term}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-3"
            >
              <p className="text-white text-sm font-semibold">{g.term}</p>
              <p className="text-zinc-400 text-xs mt-1 leading-snug">{g.meaning}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Quick links */}
      <Section title="Jump anywhere">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
          <QuickLink href="/dashboard" label="Dashboard — triage queue" />
          <QuickLink href="/command-center" label="Command Center (Echo)" />
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
          First, try Echo (top bar) — it knows the system. If that doesn't sort
          it, email{" "}
          <a
            href="mailto:hello@firstcallm.com"
            className="text-blue-400 hover:underline"
          >
            hello@firstcallm.com
          </a>{" "}
          and we'll get you squared away.
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
