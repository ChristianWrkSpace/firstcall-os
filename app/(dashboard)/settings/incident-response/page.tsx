import { getCurrentUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PageShell, Glass } from "@/components/ui/Glass";

// Static runbook. Update this file when contacts, vendors, or laws change.
// Texas breach-notification statute: Tex. Bus. & Com. Code § 521.053.

export default async function IncidentResponsePage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (me.role !== "owner" && me.role !== "manager") {
    return (
      <PageShell eyebrow="Settings" title="Incident Response" width="narrow">
        <p className="text-white/45 text-sm">Owner / manager only.</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      eyebrow="Settings"
      title="🚨 Incident Response Runbook"
      subtitle="Read this before something happens, not during. Update quarterly."
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
      {/* Severity matrix */}
      <Section title="Severity Matrix">
        <Table
          rows={[
            ["SEV 0", "Production down OR confirmed PII breach", "Drop everything. War room within 30 min."],
            ["SEV 1", "Suspected breach, secret leaked, or data integrity issue", "Same-day investigation. War room within 2h."],
            ["SEV 2", "Vendor compromise (no direct FCM impact yet)", "Same-week investigation."],
            ["SEV 3", "Anomaly worth tracking (failed-login spikes, unusual API errors)", "Triage in normal cadence."],
          ]}
          columns={["Level", "Trigger", "Response time"]}
        />
      </Section>

      {/* Leaked secret playbook */}
      <Section title="Leaked API Key / Secret">
        <Numbered
          steps={[
            <span key="1">
              <strong className="text-white/90">Confirm the leak.</strong> Where
              was it exposed (chat, email, GitHub, screenshot, support ticket)?
              Capture timestamps and audience.
            </span>,
            <span key="2">
              <strong className="text-white/90">Rotate immediately.</strong>
              <ul className="list-disc list-inside ml-4 mt-1 flex flex-col gap-1 text-white/45 text-xs">
                <li>
                  Anthropic — console.anthropic.com → API Keys → revoke + new
                  key, update Vercel env (production + preview), redeploy.
                </li>
                <li>
                  Supabase — supabase.com/dashboard/project/_/settings/api →
                  rotate service role; update Vercel env + redeploy. NOTE:
                  rotating the anon key invalidates ALL active client sessions —
                  acceptable for a leak, but plan for a re-login wave.
                </li>
                <li>
                  Stripe — dashboard.stripe.com/apikeys → roll the key, replace
                  webhook secret, redeploy. Failed webhooks during the window
                  will be re-attempted by Stripe for ~30 days.
                </li>
                <li>
                  Deepgram / ElevenLabs / Resend — each has a "regenerate"
                  action in their dashboard. Same Vercel env update + redeploy.
                </li>
              </ul>
            </span>,
            <span key="3">
              <strong className="text-white/90">Audit the blast radius.</strong>{" "}
              Pull provider usage logs for the leaked-key time window. Look for
              unfamiliar IPs, unexpected models, requests outside business
              hours.
            </span>,
            <span key="4">
              <strong className="text-white/90">Document.</strong> Write a one-page
              postmortem: how the key was exposed, time-to-rotate, observed
              abuse (if any), prevention. Add to /settings/audit log via a
              manual entry.
            </span>,
            <span key="5">
              <strong className="text-white/90">Fix the root cause.</strong> If a
              dev typed the key into a prompt — write a project rule. If a
              repo got pushed publicly — add the secret to GitHub Secret
              Scanning bypass + rotate.
            </span>,
          ]}
        />
      </Section>

      {/* Customer data breach */}
      <Section title="Customer Data Breach (PII Exposure)">
        <p className="text-amber-200 text-sm bg-amber-400/[0.06] border border-amber-400/20 rounded-lg p-3 mb-3">
          <strong>Texas law (Tex. Bus. & Com. Code § 521.053):</strong>{" "}
          Notify affected Texas residents "without unreasonable delay" — in
          practice, within 60 days of discovery. Notify the Texas AG if 250+
          residents are affected, also within 60 days.
        </p>
        <Numbered
          steps={[
            <span key="1">
              <strong className="text-white/90">Contain.</strong> Revoke
              compromised access, kill active sessions, lock impacted Supabase
              tables to admin-only RLS until resolved.
            </span>,
            <span key="2">
              <strong className="text-white/90">Quantify.</strong> What records
              touched? Whose PII? Use audit_logs + Supabase query logs for the
              window. Build a list of affected customer emails.
            </span>,
            <span key="3">
              <strong className="text-white/90">Notify counsel.</strong> Loop in
              an attorney before customer notification — wording matters and
              triggers liability.
            </span>,
            <span key="4">
              <strong className="text-white/90">Notify affected customers.</strong>{" "}
              Use Resend transactional email (not marketing). Required content:
              what happened, what data, what we did, what they should do, contact
              for questions.
            </span>,
            <span key="5">
              <strong className="text-white/90">Notify the TX AG if ≥250 affected.</strong>{" "}
              Use the OAG online form: oag.my.salesforce-sites.com/databreach.
            </span>,
            <span key="6">
              <strong className="text-white/90">Postmortem within 14 days.</strong>{" "}
              Root cause, control changes, monitoring upgrades.
            </span>,
          ]}
        />
      </Section>

      {/* Vendor compromise */}
      <Section title="Vendor Compromise (Supabase / Anthropic / Vercel / Stripe)">
        <Numbered
          steps={[
            <span key="1">
              <strong className="text-white/90">Read the vendor's incident page.</strong>{" "}
              Don't act on rumors.
              <ul className="list-disc list-inside ml-4 mt-1 flex flex-col gap-1 text-white/45 text-xs">
                <li>Supabase: status.supabase.com</li>
                <li>Anthropic: status.anthropic.com</li>
                <li>Vercel: vercel-status.com</li>
                <li>Stripe: status.stripe.com</li>
              </ul>
            </span>,
            <span key="2">
              <strong className="text-white/90">Rotate keys for the affected vendor</strong>{" "}
              even if they say "rotation not required" — defense in depth.
            </span>,
            <span key="3">
              <strong className="text-white/90">Pause writes if data integrity is in question.</strong>{" "}
              Toggle the affected agent (Hunter / Esquire / Solomon) off in
              this app, or shut down the cron. Communicate the pause internally.
            </span>,
            <span key="4">
              <strong className="text-white/90">Wait for vendor postmortem,</strong>{" "}
              then update this runbook with anything we learned.
            </span>,
          ]}
        />
      </Section>

      {/* Contact tree */}
      <Section title="Contact Tree (fill in your numbers)">
        <Table
          columns={["Role", "Person", "Phone", "Email"]}
          rows={[
            ["Owner / DRI", "Christian Castro", "(fill)", "hello@firstcallm.com"],
            ["Counsel", "(fill — restoration-savvy attorney)", "(fill)", "(fill)"],
            ["Insurance broker (cyber)", "(fill)", "(fill)", "(fill)"],
            ["Supabase support", "support@supabase.com", "—", "support@supabase.com"],
            ["Anthropic support", "support@anthropic.com", "—", "support@anthropic.com"],
            ["Vercel support", "via dashboard", "—", "—"],
            ["Texas AG (breach reporting)", "—", "(800) 252-8011", "—"],
          ]}
        />
        <p className="text-white/30 text-[10px] mt-3 italic">
          Edit{" "}
          <code className="text-[#A6B8E7]">
            app/(dashboard)/settings/incident-response/page.tsx
          </code>{" "}
          to populate your real contacts. Keep this off-system in a fireproof
          place too — if Supabase is down, you can't read this page.
        </p>
      </Section>

      <Section title="Drill Cadence">
        <ul className="list-disc list-inside flex flex-col gap-1 text-sm text-white/70">
          <li>
            <strong className="text-white/90">Quarterly:</strong> rotate one
            non-critical key end-to-end and verify the redeploy works (~30 min).
          </li>
          <li>
            <strong className="text-white/90">Annually:</strong> tabletop exercise
            walking through the breach playbook with counsel present.
          </li>
          <li>
            <strong className="text-white/90">Annually:</strong> third-party pen
            test (separate roadmap item).
          </li>
        </ul>
      </Section>
    </PageShell>
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
    <Glass className="p-6 mb-5">
      <h2 className="text-white/90 font-semibold mb-3">{title}</h2>
      {children}
    </Glass>
  );
}

function Numbered({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-3 text-sm text-white/70">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3">
          <span className="text-[#A6B8E7] font-mono text-xs mt-0.5 shrink-0">
            {i + 1}.
          </span>
          <div className="flex-1">{s}</div>
        </li>
      ))}
    </ol>
  );
}

function Table({
  columns,
  rows,
}: {
  columns: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] text-white/40 text-xs uppercase tracking-wide">
            {columns.map((c) => (
              <th key={c} className="text-left py-2 pr-3">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-white/[0.06] last:border-0">
              {r.map((cell, j) => (
                <td key={j} className="py-2.5 pr-3 text-white/70 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
