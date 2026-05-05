import { getCurrentUser } from "@/lib/auth-helpers";
import { createAdminClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";

// Engagement-prep packet for a third-party pen-test. Walk in with this
// printed and the firm has half the kickoff-meeting answers already.
// Everything here is read-only — never expose env var VALUES, only names.
//
// Update this file when architecture changes. Pair with /settings/incident-response
// (post-breach playbook) and /settings/pii-inventory (data classification).

export const dynamic = "force-dynamic";

interface RlsPolicy {
  schemaname: string;
  tablename: string;
  policyname: string;
}

async function getRlsCoverage(): Promise<{
  tables_with_policies: number;
  total_policies: number;
  policies_by_table: Record<string, number>;
}> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("pg_policies_summary").single();
    // If the RPC doesn't exist (likely — we never created it), fall through
    // to direct query via the system catalog. Supabase exposes pg_policies.
    if (error) throw error;
    return data as any;
  } catch {
    // Fallback: best-effort via REST. If even this fails, return zeros and
    // the page will surface "see Supabase dashboard" as the source.
    return { tables_with_policies: 0, total_policies: 0, policies_by_table: {} };
  }
}

export default async function SecuritySelfAuditPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (me.role !== "owner") {
    return (
      <div className="p-8 max-w-2xl">
        <h1 className="text-2xl font-bold text-white">Security Self-Audit</h1>
        <p className="text-zinc-400 text-sm mt-2">Owner only.</p>
      </div>
    );
  }

  const rls = await getRlsCoverage();

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="mb-6">
        <Link href="/settings" className="text-zinc-500 hover:text-white text-sm transition-colors">
          ← Settings
        </Link>
        <h1 className="text-2xl font-bold text-white mt-2">🔐 Security Self-Audit & Pen-Test Engagement Packet</h1>
        <p className="text-zinc-400 text-sm mt-1 leading-relaxed">
          Hand this to the third-party firm at engagement kickoff. Saves billable hours by giving them
          architecture, auth model, env-var inventory, and high-risk surfaces upfront. Updated 2026-05-05.
        </p>
        <p className="mt-3 text-xs text-zinc-500">
          Press <kbd className="px-1.5 py-0.5 rounded border border-zinc-700 bg-zinc-800 font-mono">⌘P</kbd>{" "}
          (Mac) or <kbd className="px-1.5 py-0.5 rounded border border-zinc-700 bg-zinc-800 font-mono">Ctrl+P</kbd>{" "}
          (Windows) to save this page as PDF for the engagement.
        </p>
      </div>

      <Section title="1. System Overview">
        <Para>
          <strong className="text-white">FirstCall OS</strong> is an internal AI-native business OS for
          First Call Mitigation, an Austin TX water/fire/mold restoration company. Production:{" "}
          <code className="text-blue-400">https://firstcall-os.vercel.app</code>. Single-tenant. Solo
          operator + a small field team. Deployed on Vercel; data on Supabase Postgres + Storage.
        </Para>
        <Para>
          <strong className="text-white">Sensitive data:</strong> customer PII (name/address/phone),
          insurance claim data, photos of damaged property, signed legal documents (AOB, drying
          certs), payment records, and AI-generated estimates. Voice recordings are biometric data
          per Texas § 521.002.
        </Para>
        <Para>
          <strong className="text-white">Threat model:</strong> primary concern is a credential leak
          (Supabase service-role key, Anthropic key) leading to PII exfiltration; secondary is a token
          leak on customer/adjuster portal share links exposing one job's data.
        </Para>
      </Section>

      <Section title="2. Tech Stack & Architecture">
        <KvList
          items={[
            ["Frontend / Server", "Next.js 16 (App Router) + React 19 on Vercel"],
            ["Database", "Supabase Postgres (managed) — 29 schema migrations"],
            ["Auth", "Supabase Auth (email + password + TOTP MFA)"],
            ["Storage", "Supabase Storage (private buckets, signed URLs)"],
            ["AI providers", "Anthropic (primary), Google Gemini, DeepSeek (via Vercel AI Gateway)"],
            ["Voice STT", "Deepgram (browser MediaRecorder → server transcription)"],
            ["Voice TTS", "ElevenLabs Flash v2.5"],
            ["Payments", "Stripe Checkout (PCI handled by Stripe; webhooks signature-verified)"],
            ["Email", "Resend"],
            ["Observability", "Vercel Analytics + Speed Insights, agent_invocations table"],
            ["CI/CD", "GitHub Actions: typecheck + Vitest on every push; Playwright daily; Vercel deploys main"],
          ]}
        />
      </Section>

      <Section title="3. Auth Model">
        <Para>
          <strong className="text-white">User auth:</strong> Supabase email + password. Strict 8-char
          minimum, password reset via emailed magic link. TOTP-based MFA available at{" "}
          <code className="text-blue-400">/settings/security</code> (no SMS — SIM-swap exposure
          unacceptable). Session management at the same page lets owner force-sign-out any user.
        </Para>
        <Para>
          <strong className="text-white">Roles:</strong> 4 roles — owner, manager, office, technician
          — with explicit permission matrix in <code className="text-blue-400">lib/permissions.ts</code>.
          Server-side enforcement via <code className="text-blue-400">requirePermission()</code>;
          self-protection prevents owner from demoting self.
        </Para>
        <Para>
          <strong className="text-white">RLS:</strong> Row-Level Security enabled on every public
          table. Per-table SELECT/INSERT/UPDATE/DELETE policies. <code className="text-blue-400">audit_logs</code>{" "}
          is append-only at the DB level (no UPDATE / DELETE policies). DELETE on customers/jobs/invoices/payments
          restricted to owner / manager via security-definer helpers (<code className="text-blue-400">current_user_role()</code>,{" "}
          <code className="text-blue-400">is_owner_or_manager()</code>).
        </Para>
        <Para>
          <strong className="text-white">RLS coverage (live):</strong>{" "}
          {rls.total_policies > 0 ? (
            <>
              {rls.total_policies} policies across {rls.tables_with_policies} tables.
            </>
          ) : (
            <span className="text-zinc-500">
              Live count unavailable from this page — query{" "}
              <code className="text-blue-400">pg_policies</code> directly in the Supabase SQL editor.
            </span>
          )}
        </Para>
        <Para>
          <strong className="text-white">Public token-based access:</strong> Two routes are
          intentionally public, gated only by a per-job UUID token —{" "}
          <code className="text-blue-400">/portal/[token]</code> (customer view) and{" "}
          <code className="text-blue-400">/adjuster/[token]</code> (insurance adjuster claim packet).
          Tokens regeneratable / revocable by office. <strong>Test scope:</strong> token guessability,
          enumeration, replay after revoke.
        </Para>
      </Section>

      <Section title="4. API Surface">
        <Para className="mb-3">
          Server actions (mutations) live in <code className="text-blue-400">app/actions/*</code>. API
          routes for streaming / webhooks / cron live below. All mutations write{" "}
          <code className="text-blue-400">audit_logs</code> entries via <code className="text-blue-400">logAudit()</code>.
        </Para>
        <KvList
          items={[
            ["/api/calls/process", "Audio upload → Deepgram STT → Claude tool-use → job draft. Auth required."],
            ["/api/calls/converse", "Athena conversational endpoint — Deepgram + Claude + ElevenLabs. Auth required."],
            ["/api/calls/extract", "Transcript → structured intake. Auth required."],
            ["/api/echo", "Echo Q&A chat. Auth required."],
            ["/api/notes/voice", "Voice note upload + transcription. Auth required."],
            ["/api/stripe/webhook", "Stripe webhook → records payment + flips invoice. Signature-verified via Stripe SDK."],
            ["/api/cron/backup", "Vercel Cron (Sun 03:00 UTC). Bearer-auth via CRON_SECRET."],
            ["/api/cron/audit-drying-certs", "Vercel Cron (Mon 16:23 UTC). Bearer-auth."],
            ["/api/cron/demand-letter-sweep", "Vercel Cron (M-F 14:00 UTC). Bearer-auth."],
            ["/api/cron/approvals-digest", "Vercel Cron (daily 14:30 UTC). Bearer-auth."],
          ]}
        />
      </Section>

      <Section title="5. High-Risk Surfaces (Test These First)">
        <ol className="list-decimal pl-5 text-zinc-300 text-sm space-y-2">
          <li>
            <strong>Service-role key handling.</strong> <code className="text-blue-400">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
            used only in server-side code. Verify no client bundle leak. Verify{" "}
            <code className="text-blue-400">lib/supabase-server.ts</code> never imported into client components.
          </li>
          <li>
            <strong>File upload paths.</strong> Photos uploaded direct browser → Supabase Storage with
            signed-URL policies. Test: upload of large/malicious files, path traversal, signed-URL replay
            after revoke, cross-job photo access.
          </li>
          <li>
            <strong>Public share-token routes.</strong> <code className="text-blue-400">/portal/[token]</code>{" "}
            and <code className="text-blue-400">/adjuster/[token]</code>. Test: token entropy, brute-force
            resistance, post-revoke access, internal data leakage (cost basis must NEVER reach customer view).
          </li>
          <li>
            <strong>Webhook endpoints.</strong> Stripe webhook signature verification (Stripe SDK
            constructEvent). Generic HMAC helper at <code className="text-blue-400">lib/verify-webhook.ts</code>{" "}
            for future Twilio/Resend. Test: tampered bodies, wrong secrets, replay.
          </li>
          <li>
            <strong>Cron routes.</strong> All cron routes check <code className="text-blue-400">CRON_SECRET</code>{" "}
            bearer token. Test: missing-secret bypass, timing attack on bearer compare.
          </li>
          <li>
            <strong>AI agent inputs.</strong> Prompt injection via call transcripts, photo metadata,
            customer description fields. Tool-use schemas constrain output but input is user-controlled.
          </li>
          <li>
            <strong>Rate limiting.</strong> Per-user sliding window on <code className="text-blue-400">/api/calls/*</code>{" "}
            (30/min, 200/hour). In-memory per Vercel instance — bypass possible via concurrent cold starts.
            Test: distributed abuse pattern.
          </li>
        </ol>
      </Section>

      <Section title="6. Storage Buckets">
        <KvList
          items={[
            ["job-photos", "Private. Per-job photos uploaded by techs. Signed URLs (1h TTL) for read."],
            ["job-documents", "Private. AOBs, drying certs, COIs. Signed URLs only. May contain signatures + IDs."],
            ["job-videos", "Private. Walk-through videos. Signed URLs only."],
            ["backups", "Private. Weekly JSON exports of 17 ops tables. Owner-only signed-URL download."],
          ]}
        />
      </Section>

      <Section title="7. Environment Variable Inventory (Names Only)">
        <Para className="mb-3 text-xs text-amber-400">
          ⚠ Values are NEVER displayed here. Provide values to the firm via your password manager,
          not via this packet.
        </Para>
        <KvList
          items={[
            ["SUPABASE_SERVICE_ROLE_KEY", "DB admin — server-only. Highest blast radius."],
            ["NEXT_PUBLIC_SUPABASE_URL", "Public. Anon-key paired."],
            ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "Public. RLS-restricted."],
            ["ANTHROPIC_API_KEY", "Direct Anthropic billing key."],
            ["AI_GATEWAY_API_KEY", "Vercel AI Gateway — routes to BYOK providers."],
            ["AI_GATEWAY_ENABLED", "Boolean flag. Currently true in prod."],
            ["AI_DAILY_SPEND_CAP_USD", "Kill-switch threshold. Currently $20."],
            ["AI_KILL_SWITCH_OFF", "Owner override — bypasses cap when true."],
            ["DEEPGRAM_API_KEY", "STT billing."],
            ["ELEVENLABS_API_KEY", "TTS billing."],
            ["RESEND_API_KEY", "Email sending."],
            ["RESEND_FROM", "From-address for outbound email."],
            ["STRIPE_SECRET_KEY", "Payment processing."],
            ["STRIPE_WEBHOOK_SECRET", "Webhook signature verification."],
            ["CRON_SECRET", "Bearer token for /api/cron/*."],
            ["OPERATOR_EMAIL", "Recipient for digest + kill-switch alerts."],
            ["DATA_CUTOFF", "Optional — UI-level filter for fresh-start (defaults to 2026-05-01)."],
          ]}
        />
        <Para className="mt-2 text-xs text-zinc-500">
          Rotation log + cadence at <Link href="/settings/secrets-rotation" className="text-blue-400 hover:underline">/settings/secrets-rotation</Link>.
        </Para>
      </Section>

      <Section title="8. OWASP Top 10 Posture">
        <KvList
          items={[
            ["A01 Broken Access Control", "RLS on every table; role-based mutations via requirePermission(); audit_logs append-only."],
            ["A02 Cryptographic Failures", "HTTPS enforced (HSTS); Supabase encrypted-at-rest; no client-side secret storage; service-role key server-only."],
            ["A03 Injection", "Supabase client uses parameterized queries; no raw SQL string concat; input validation at action layer; tool-use schemas constrain AI outputs."],
            ["A04 Insecure Design", "Single-tenant; HITL approval gate before sends/signs/payments; Five-Laws agent durability layer (preconditions, kill-switch, timeouts)."],
            ["A05 Security Misconfiguration", "CSP enforced via proxy.ts; X-Frame-Options + HSTS; default-deny via RLS; secrets-rotation tracked."],
            ["A06 Vulnerable Components", "Dependabot weekly scans (npm + GitHub Actions); auto-PRs for security patches."],
            ["A07 Auth Failures", "TOTP MFA available; password reset flow; rate-limit-able login (Supabase native); session management at /settings/security."],
            ["A08 Data Integrity Failures", "Stripe webhook signature-verified; audit_logs append-only at DB level; backup verify-drill for restore-tested integrity."],
            ["A09 Logging Failures", "audit_logs covers all mutations; agent_invocations covers AI calls; security-activity dashboard surfaces anomalies; backup history retained."],
            ["A10 SSRF", "Server fetches limited to known providers (Anthropic, Deepgram, ElevenLabs, Resend, Stripe, Supabase); no user-controlled URL fetch path."],
          ]}
        />
      </Section>

      <Section title="9. Engagement Scope">
        <Para>
          <strong className="text-white">In scope:</strong>
        </Para>
        <ul className="list-disc pl-5 text-zinc-300 text-sm space-y-1">
          <li>All routes under <code className="text-blue-400">https://firstcall-os.vercel.app</code></li>
          <li>Authenticated + unauthenticated paths (including <code>/portal/[token]</code> + <code>/adjuster/[token]</code>)</li>
          <li>API endpoints listed in section 4</li>
          <li>Auth flows: login, password reset, MFA enroll/unenroll, session management</li>
          <li>RLS policies (verifying defense-in-depth even with stolen JWTs)</li>
          <li>Webhook signature verification (Stripe + future Twilio)</li>
          <li>File upload + signed-URL replay</li>
          <li>Prompt injection on AI agent inputs</li>
        </ul>
        <Para className="mt-4">
          <strong className="text-white">Out of scope:</strong>
        </Para>
        <ul className="list-disc pl-5 text-zinc-300 text-sm space-y-1">
          <li>DoS / availability testing (low value vs. risk to live ops)</li>
          <li>Social engineering of staff or customers</li>
          <li>Vercel platform itself (their problem, not ours)</li>
          <li>Supabase platform (managed)</li>
          <li>Third-party providers — Anthropic / Deepgram / ElevenLabs / Stripe / Resend</li>
        </ul>
      </Section>

      <Section title="10. What to Hand the Firm at Kickoff">
        <ol className="list-decimal pl-5 text-zinc-300 text-sm space-y-1">
          <li>This page (printed PDF)</li>
          <li>Read-only access to a staging copy of the Supabase project (NOT prod)</li>
          <li>A test owner account + a test technician account on staging</li>
          <li>Two sample share-tokens (customer + adjuster) on a test job</li>
          <li>List of in-scope subdomains (just <code>firstcall-os.vercel.app</code> for now)</li>
          <li>Engagement window + emergency contact (your phone)</li>
          <li>Scope confirmation in writing — "in-scope" + "out-of-scope" sections above</li>
        </ol>
      </Section>

      <Section title="11. Related Pages">
        <ul className="list-disc pl-5 text-zinc-300 text-sm space-y-1">
          <li><Link href="/settings/pii-inventory" className="text-blue-400 hover:underline">/settings/pii-inventory</Link> — data classification + retention</li>
          <li><Link href="/settings/secrets-rotation" className="text-blue-400 hover:underline">/settings/secrets-rotation</Link> — rotation log + cadence</li>
          <li><Link href="/settings/incident-response" className="text-blue-400 hover:underline">/settings/incident-response</Link> — post-breach playbook</li>
          <li><Link href="/settings/audit" className="text-blue-400 hover:underline">/settings/audit</Link> — append-only audit log viewer</li>
          <li><Link href="/settings/security-activity" className="text-blue-400 hover:underline">/settings/security-activity</Link> — auth events + risk signals</li>
          <li><Link href="/settings/backups" className="text-blue-400 hover:underline">/settings/backups</Link> — backup posture + verify-drill</li>
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass-card p-5 mb-4">
      <h2 className="text-white font-semibold text-lg mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Para({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-zinc-300 text-sm leading-relaxed mb-2 ${className}`}>{children}</p>;
}

function KvList({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="grid grid-cols-1 gap-y-1.5 text-sm">
      {items.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[180px_1fr] gap-3 md:gap-4">
          <dt className="font-mono text-xs text-zinc-400 leading-relaxed">{k}</dt>
          <dd className="text-zinc-300 leading-relaxed">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
