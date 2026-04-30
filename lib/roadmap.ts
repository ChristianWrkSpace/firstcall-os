// FirstCall OS — Project Roadmap (Source of Truth)
// Update this file as work ships. Be honest about effort + status.
// "Done" = shipped + working. NOT "shipped but needs hardening."
// Last reviewed: 2026-04-28

export type Status = "done" | "in_progress" | "planned" | "idea";
export type Effort = "S" | "M" | "L" | "XL";
export type Track = "core" | "production" | "security" | "integrations";

// Effort weights in approximate hours of focused work
// S = 1-2h, M = half-day, L = 1-2 days, XL = 3+ days
export const EFFORT_WEIGHTS: Record<Effort, number> = {
  S: 1,
  M: 3,
  L: 8,
  XL: 20,
};

export const TRACK_META: Record<Track, { label: string; description: string; emoji: string }> = {
  core: {
    label: "Core Features",
    description: "Product surface area — agents, workflows, user-facing functionality.",
    emoji: "🤖",
  },
  production: {
    label: "Production Readiness",
    description: "Hardening: deployment, testing, monitoring, mobile, backups.",
    emoji: "🛠",
  },
  security: {
    label: "Security & Compliance",
    description: "Protect customer PII, claim data, photos. Auth, RLS, audit logs, rate limiting, pen testing.",
    emoji: "🔒",
  },
  integrations: {
    label: "Integrations",
    description: "Third-party syncs: Xactimate, QuickBooks, carrier portals, payments, email.",
    emoji: "🔌",
  },
};

export interface RoadmapItem {
  id: string;
  title: string;
  agent?: string;
  track: Track;
  status: Status;
  effort: Effort;
  description: string;
  shipped_at?: string;
  features?: string[];
}

export const ROADMAP: RoadmapItem[] = [
  // ═══════════════════════════════════════════════════════════════════
  // CORE FEATURES — DONE
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "foundation",
    title: "Project Foundation",
    track: "core",
    status: "done",
    effort: "L",
    shipped_at: "2026-04-27",
    description:
      "Next.js 16 + React 19 + Tailwind v4. Supabase clients split (browser/server/admin). Auth + protected route group + middleware (proxy.ts).",
    features: [
      "GitHub repo + initial commit",
      "Supabase project + service-role admin client",
      "Login/signout via Server Actions",
      "Protected route group with proxy.ts middleware",
      "Browser/server supabase clients split (no next/headers leak to client)",
    ],
  },
  {
    id: "jobs-crud",
    title: "Jobs Module",
    track: "core",
    status: "done",
    effort: "M",
    shipped_at: "2026-04-28",
    description:
      "Core unit of work. Create, view, update status, attach notes. Auto-numbered (FCM-YYYYMM-NNNN).",
    features: [
      "Customer + Job creation in one form",
      "Status flow: lead → inspection → mitigation → drying → reconstruction → completed",
      "Inline status selector with auto-save",
      "Notes & activity log",
    ],
  },
  {
    id: "athena-batch",
    title: "Athena — Batch Call Intake",
    agent: "Athena",
    track: "core",
    status: "done",
    effort: "M",
    shipped_at: "2026-04-28",
    description:
      "Browser MediaRecorder → Deepgram STT → Claude Opus 4.7 tool-use extraction → review screen → create job.",
    features: [
      "Tool-use schema for structured intake extraction",
      "Auto-creates Customer + Job + Call + urgency note",
      "Partner referral path (plumber/adjuster upserted into partners table)",
    ],
  },
  {
    id: "athena-realtime",
    title: "Athena — Conversational AI",
    agent: "Athena",
    track: "core",
    status: "done",
    effort: "L",
    shipped_at: "2026-04-28",
    description:
      "Push-to-talk browser conversation with AI dispatcher. Deepgram STT → Claude Haiku 4.5 → ElevenLabs TTS. Live voice tuning sliders. Auto-extract on End Call.",
    features: [
      "Multi-turn conversation state",
      "ElevenLabs Flash v2.5 (default voice: Sarah)",
      "Live stability/similarity/style sliders",
      "5-question intake script with empathy",
    ],
  },
  {
    id: "argus",
    title: "Argus — Photo Scoping",
    agent: "Argus",
    track: "core",
    status: "done",
    effort: "L",
    shipped_at: "2026-04-28",
    description:
      "Field photos → Claude Opus 4.7 vision → IICRC S500-compliant scope (cat/class, materials, equipment, PPE, mitigation plan, drying days). Browser-direct upload, sharp normalization, dispatch inputs, math transparency, printable loadout sheet.",
    features: [
      "Direct browser-to-Supabase upload (no 1MB cap)",
      "Sharp normalizes any image type (HEIC, large phone photos)",
      "Dispatch Inputs form locks Claude assumptions (ceiling height, year built, source secured)",
      "🧮 Show the Math panel — IICRC formulas exposed",
      "📋 Printable Loadout Sheet with check boxes + tech sign-off",
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // CORE FEATURES — PLANNED
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "ledger",
    title: "Ledger — Estimating",
    agent: "Ledger",
    track: "core",
    status: "done",
    effort: "L",
    shipped_at: "2026-04-28",
    description:
      "Converts Argus scope into Xactimate-style line items (WTR EXTB, WTR DEHU-LR, WTR EQAF, etc.) with Austin TX market pricing. Editable per-line. HITL approval gate before send. Versioned per job.",
    features: [
      "Claude Opus 4.7 generates structured estimate from scope (categories, codes, qty, units, prices)",
      "Inline edit any line item (description, qty, unit, price, code)",
      "Add custom line items, delete unwanted ones",
      "Versioned: re-generate creates v2, v3, etc.",
      "Status flow: draft → approved → sent (with sent_to recipient tracked)",
      "Print-friendly when approved",
      "AI flags assumptions for estimator to verify before approval",
    ],
  },
  {
    id: "abacus",
    title: "Abacus — Accounting & AR",
    agent: "Abacus",
    track: "core",
    status: "done",
    effort: "L",
    shipped_at: "2026-04-28",
    description:
      "Generates invoices from approved Ledger estimates. Sends to adjusters via Resend. Tracks payments and aging. Manual reminder buttons (gentle / firm / final notice with Tex. Ins. Code citations). AR aging dashboard at /ar.",
    features: [
      "Auto-numbered invoices (INV-YYYYMM-NNNN) via DB trigger",
      "One-click 'Generate Invoice' from any approved estimate (copies line items)",
      "Send via Resend (uses RESEND_FROM env var)",
      "Branded HTML email templates for invoice + 3 reminder tones",
      "Payment recording (check/ACH/wire/CC) with auto status flip (sent → partial → paid)",
      "AR aging dashboard: 0-30, 31-60, 61-90, 90+ buckets with $ at risk",
      "Reminder history per invoice",
      "Print-friendly invoice with payment terms + Tex. Ins. Code reference",
    ],
  },
  {
    id: "atlas",
    title: "Atlas — Equipment & Fleet",
    agent: "Atlas",
    track: "core",
    status: "done",
    effort: "L",
    shipped_at: "2026-04-28",
    description:
      "Track every dehu/air mover/scrubber/extractor by serial #. Hours logged. Deploy/retrieve to/from jobs. Maintenance + retired states. Full assignment history per unit.",
    features: [
      "Equipment list with type/status filters and counts",
      "Add equipment form (type, serial, model, manufacturer, purchase date)",
      "Detail view: editable info, status badge, current job, hours logged",
      "Deploy to active job (records meter reading + deployer)",
      "Retrieve from job (records return meter, computes hours worked, adds to total)",
      "Maintenance / Retired / Available state flips",
      "Last 20 assignments table with deployer/retriever names",
    ],
  },
  {
    id: "esquire",
    title: "Esquire — Legal & Compliance",
    agent: "Esquire",
    track: "core",
    status: "planned",
    effort: "L",
    description:
      "Drafts AOBs for DocuSign. Bad-faith warning letters and Notices of Appraisal with state-law citations. HITL before send.",
  },
  {
    id: "solomon",
    title: "Solomon — FP&A & Margin Analysis",
    agent: "Solomon",
    track: "core",
    status: "planned",
    effort: "L",
    description:
      "Analyzes Ledger for margin leaks. Flags low-margin zip codes. Suggests pivots and pricing adjustments.",
  },
  {
    id: "hunter",
    title: "Hunter — B2B Sales Outreach",
    agent: "Hunter",
    track: "core",
    status: "done",
    effort: "M",
    shipped_at: "2026-04-30",
    description:
      "B2B outreach pipeline at /partners/outreach. Hunter (Claude Opus 4.7) drafts personalized cold emails, voicemail scripts, follow-ups based on business type pitch angles. Lead lifecycle: new → drafted → sent → replied → converted-to-partner.",
    features: [
      "10 business-type pitch angles (hotels, plumbers, property mgmt, insurance, etc.)",
      "AI-drafted cold email + voicemail + follow-up via Claude Opus 4.7",
      "Inline editing of any draft, copy-to-clipboard for paste-into-email-client workflow",
      "Lead lifecycle tracking (9 statuses)",
      "Convert lead → Partner (auto-creates partners row)",
      "Reply tracking with notes",
    ],
  },
  {
    id: "twilio-athena",
    title: "Athena on a Real Phone Number (Twilio)",
    agent: "Athena",
    track: "core",
    status: "planned",
    effort: "XL",
    description:
      "Twilio phone number → WebSocket bridge → streaming Deepgram STT + Claude + ElevenLabs TTS. Sub-second latency. Interruption handling. After-hours only first.",
  },
  {
    id: "ops-dashboard",
    title: "Operational Dashboard",
    track: "core",
    status: "done",
    effort: "M",
    shipped_at: "2026-04-28",
    description:
      "Triage queue, kanban pipeline view, this-week stats. Replaced static counts with 'what needs my attention' view.",
    features: [
      "🚨 Triage cards: new leads (4h), missing scope, stale jobs (3+d)",
      "🔥 Kanban pipeline by status with days-in-status flagged amber when stale",
      "📊 This week: calls, jobs created, jobs completed, lead→mitigation conversion %",
      "All server-side rendered, single-file implementation",
    ],
  },
  {
    id: "calendar",
    title: "Schedule & Crew Assignments",
    track: "core",
    status: "done",
    effort: "L",
    shipped_at: "2026-04-29",
    description:
      "Schedule jobs at specific date/time. Assign multiple techs per job, mark one as Lead. Agenda view at /schedule grouped by day with prev/next week navigation. Unscheduled-active-jobs sidebar.",
    features: [
      "Schedule + Crew panel on every job detail page",
      "datetime-local picker for scheduled_at",
      "Multi-tech assignment with 'make lead' / 'remove' inline actions",
      "/schedule agenda view: group by day, today/tomorrow labels, prev/next nav",
      "Unscheduled-active-jobs sidebar so nothing falls through cracks",
    ],
  },
  {
    id: "documents",
    title: "Documents Vault",
    track: "core",
    status: "done",
    effort: "L",
    shipped_at: "2026-04-29",
    description:
      "Per-job doc vault with restoration-specific taxonomy: AOB, Direction to Pay, COIs, adjuster correspondence, drying certificates, permits, lien waivers. Browser-direct upload, drag-and-drop, inline preview, signature tracking, 7-day shareable links.",
    features: [
      "15 document types across 5 categories (Customer Auth / Insurance / Mitigation / Compliance / Misc)",
      "Required-doc checklist per job (AOB, Direction to Pay, Customer Authorization)",
      "Drag-and-drop or click-to-upload, multi-file support, any size",
      "Direct browser-to-Supabase Storage (no server bottleneck)",
      "Inline preview for PDFs and images (lightbox modal)",
      "Mark documents as signed with signer name (for AOBs)",
      "Generate 7-day shareable signed-URL links (one-click copy to clipboard)",
      "Download, delete with confirm, audit trail",
    ],
  },
  {
    id: "email-sms",
    title: "Customer Email Notifications",
    track: "core",
    status: "done",
    effort: "M",
    shipped_at: "2026-04-29",
    description:
      "Branded email touchpoints via Resend on every key job event. SMS via Twilio is a follow-up (not blocking — Twilio account needed).",
    features: [
      "7 event types: dispatched, mitigation_started, drying_started, equipment_check, work_completed, follow_up, custom",
      "Branded HTML templates with First Call letterhead + job tag",
      "Custom freeform messages wrap into the same branded layout",
      "Recipient defaults to customer email, overridable for testing",
      "Send history per job (last 10 visible)",
      "Logged to customer_notifications table for audit",
    ],
  },
  {
    id: "reporting",
    title: "Reports & KPIs",
    track: "core",
    status: "done",
    effort: "L",
    shipped_at: "2026-04-29",
    description:
      "Operational + financial reporting at /reports. KPI strip (calls, jobs, conversion %, cycle time), money strip (billed, collected, avg estimate, open AR), pipeline snapshot, jobs by type, callers by type, top zip codes, top carriers. Window selector: 7d/30d/90d/1y.",
    features: [
      "8 windowed KPI cards (operational + financial)",
      "Current pipeline distribution as percentage bars",
      "Jobs by damage type, calls by caller type",
      "Top zip codes and top insurance carriers (live data)",
      "Honesty footer disclosing measurement caveats (avg cycle proxy etc.)",
    ],
  },
  {
    id: "customer-portal",
    title: "Customer Portal (public link)",
    track: "core",
    status: "done",
    effort: "L",
    shipped_at: "2026-04-29",
    description:
      "Per-job public link via secret token (no login). Customer sees status with stage progress bar, scheduled visit time, site photos, signed documents, recent updates. Internal scope/pricing hidden. Office can regenerate or revoke the token.",
    features: [
      "One-click 'Generate Customer Link' on every job",
      "Token-protected public route at /portal/[token]",
      "Mobile-friendly customer view (no app chrome)",
      "Stage progress bar (Lead → Inspection → Mitigation → Drying → Recon → Done)",
      "Photos + signed docs visible to customer (signed URLs, 1h TTL)",
      "Internal cost data NEVER exposed to customer",
      "Regenerate (invalidate old) or Revoke (cut access)",
    ],
  },
  {
    id: "adjuster-portal",
    title: "Adjuster Portal (claim packet)",
    track: "core",
    status: "done",
    effort: "L",
    shipped_at: "2026-04-30",
    description:
      "Per-job public claim packet at /adjuster/[token] for insurance adjusters. No login needed — token is the auth. Shows scope, approved estimate, photos, signed documents (AOB etc.), moisture readings.",
    features: [
      "Generate / regenerate / revoke shareable token",
      "Full claim packet view: scope summary, approved estimate w/ line items, photos gallery, signed docs, moisture log",
      "Mobile-friendly read-only layout",
      "Internal-only data hidden (notes, partner info, etc.)",
    ],
  },
  {
    id: "tech-mobile",
    title: "Tech Mobile App / PWA",
    track: "core",
    status: "planned",
    effort: "XL",
    description:
      "Field techs aren't on laptops. Mobile-first PWA: snap photos, log moisture readings, mark jobs complete, capture signatures.",
  },

  // ═══════════════════════════════════════════════════════════════════
  // PRODUCTION READINESS — PLANNED
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "deploy-prod",
    title: "Production Deployment",
    track: "production",
    status: "done",
    effort: "L",
    shipped_at: "2026-04-29",
    description:
      "Live at https://firstcall-os.vercel.app. All env vars pushed via Vercel API. Deployment protection disabled for public access. Auto-deploy on every git push to main.",
    features: [
      "9 env vars pushed to Vercel (production + dev)",
      "GitHub-connected CI: every push deploys",
      "Aliased domain firstcall-os.vercel.app",
      "Vercel CLI + Claude Code plugin wired",
    ],
  },
  {
    id: "monitoring",
    title: "Error Monitoring",
    track: "production",
    status: "planned",
    effort: "S",
    description:
      "Sentry or similar. Catch silent server-action failures. Alert on rate spikes, API failures.",
  },
  {
    id: "backups",
    title: "Backups & Disaster Recovery",
    track: "production",
    status: "planned",
    effort: "M",
    description:
      "Automated DB backups, point-in-time recovery, storage bucket replication. Documented restore procedure.",
  },
  {
    id: "tests",
    title: "Test Suite",
    track: "production",
    status: "planned",
    effort: "L",
    description:
      "Currently zero tests. E2E for critical paths (auth, job creation, call extraction). Unit tests for extraction/scope tools.",
  },
  {
    id: "ci-cd",
    title: "CI/CD Pipeline",
    track: "production",
    status: "planned",
    effort: "M",
    description:
      "GitHub Actions: type-check, run tests, deploy preview to Vercel on PR, deploy main to production.",
  },
  {
    id: "mobile-audit",
    title: "Mobile Responsiveness Pass",
    track: "production",
    status: "done",
    effort: "M",
    shipped_at: "2026-04-29",
    description:
      "First mobile pass: hamburger drawer nav, responsive padding, table horizontal scroll, viewport meta, job detail stacks on mobile. Not perfect (Reports KPI grid + line-item editing are still desktop-y) but app is usable on phone.",
    features: [
      "Slide-out drawer nav with hamburger menu",
      "Responsive padding: p-4 md:p-8 across all dashboard pages",
      "Tables wrap in overflow-x-auto",
      "Job detail 3-col grid stacks on mobile",
      "Proper viewport meta + theme color in root layout",
    ],
  },
  {
    id: "multi-tenant",
    title: "Multi-Tenancy (if SaaS)",
    track: "production",
    status: "idea",
    effort: "XL",
    description:
      "Only matters if FirstCall OS is sold to other restoration shops. Tenant isolation, billing per org, data segregation.",
  },

  // ═══════════════════════════════════════════════════════════════════
  // SECURITY & COMPLIANCE — PLANNED
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "auth-hardening",
    title: "Auth Hardening",
    track: "security",
    status: "planned",
    effort: "M",
    description:
      "MFA via Supabase. Strong password policy. Email verification. Password reset flow. Session timeout configuration.",
  },
  {
    id: "roles-permissions",
    title: "Multi-User Roles & Permissions",
    track: "security",
    status: "done",
    effort: "L",
    shipped_at: "2026-04-30",
    description:
      "4 roles (owner/manager/office/technician) with explicit permission matrix in lib/permissions.ts. Server-side enforcement via requirePermission(). /settings/users page for role management. Money + admin actions gated.",
    features: [
      "lib/permissions.ts: 17 permissions × 4 roles matrix",
      "requirePermission() helper for server actions",
      "/settings/users with role dropdowns + activate/deactivate",
      "Self-protection: can't demote yourself from Owner or deactivate self",
      "Note: full per-action audit is a follow-up; money + role-change actions are gated now",
    ],
  },
  {
    id: "rls-audit",
    title: "RLS Policy Audit",
    track: "security",
    status: "done",
    effort: "M",
    shipped_at: "2026-04-30",
    description:
      "Tightened row-level security across customers/jobs/invoices/payments/profiles/audit_logs. Defense-in-depth: even with a stolen JWT direct to Supabase, DB blocks deletes for non-owner/manager and audit logs become append-only.",
    features: [
      "current_user_role() + is_owner_or_manager() helpers (security definer)",
      "Per-table SELECT/INSERT/UPDATE/DELETE policies replace catch-alls",
      "DELETE on customers/jobs/invoices/payments restricted to owner/manager",
      "audit_logs are append-only at DB level (no UPDATE/DELETE policies)",
      "profiles: users update themselves; owners can update anyone",
    ],
  },
  {
    id: "rate-limiting",
    title: "Rate Limiting on AI Routes",
    track: "security",
    status: "done",
    effort: "M",
    shipped_at: "2026-04-30",
    description:
      "Per-user sliding-window rate limits on /api/calls/process and /api/calls/converse. 30/min and 200/hour caps stop runaway Anthropic + Deepgram + ElevenLabs spend.",
    features: [
      "lib/rate-limit.ts: in-memory sliding window with auto-sweep",
      "Per-user keys (not just per-IP) so abuse is tied to identity",
      "Returns 429 with friendly message",
      "Note: in-memory means per-Vercel-instance; Upstash Redis recommended for scale",
    ],
  },
  {
    id: "security-headers",
    title: "Security Headers",
    track: "security",
    status: "done",
    effort: "S",
    shipped_at: "2026-04-30",
    description:
      "X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, Strict-Transport-Security applied to every response via proxy.ts middleware.",
  },
  {
    id: "webhook-signatures",
    title: "Webhook Signature Verification",
    track: "security",
    status: "planned",
    effort: "S",
    description:
      "When Stripe / Twilio / Resend send webhooks, verify the signature header. Prevents spoofed events triggering actions.",
  },
  {
    id: "secrets-rotation",
    title: "Secrets Management & Rotation",
    track: "security",
    status: "planned",
    effort: "M",
    description:
      "Currently API keys live in .env.local indefinitely. Document rotation cadence (quarterly). Move production secrets to Vercel env / Doppler / 1Password Connect. Rotate now, since keys were typed in chat.",
  },
  {
    id: "dependency-scanning",
    title: "Dependency Vulnerability Scanning",
    track: "security",
    status: "done",
    effort: "S",
    shipped_at: "2026-04-30",
    description:
      "GitHub Dependabot configured via .github/dependabot.yml. Weekly Monday scans for npm + GitHub Actions deps. Auto-PRs for security patches.",
  },
  {
    id: "audit-logs",
    title: "Audit Logs",
    track: "security",
    status: "done",
    effort: "M",
    shipped_at: "2026-04-30",
    description:
      "audit_logs table + lib/audit.ts logAudit() helper. Wired into invoice send/void, payment record, and user role/active changes. Visible at /settings/audit (Owner/Manager only).",
    features: [
      "Append-only audit_logs table with user/action/entity/details JSONB",
      "logAudit() helper — fire-and-forget, never blocks user flow",
      "Wired actions: invoice.sent, invoice.voided, payment.recorded, user.role_changed, user.activated, user.deactivated",
      "/settings/audit viewer (latest 200 events)",
      "More actions can be wired incrementally — pattern is in place",
    ],
  },
  {
    id: "pii-inventory",
    title: "PII Data Inventory & Policy",
    track: "security",
    status: "planned",
    effort: "M",
    description:
      "Document every field that holds PII (customer name, phone, email, address, claim #, photos of homes). Define retention, redaction, deletion-on-request procedures.",
  },
  {
    id: "pen-test",
    title: "Penetration Test",
    track: "security",
    status: "planned",
    effort: "M",
    description:
      "Third-party assessment before sensitive customer data lives in production. Annual cadence after that. OWASP Top 10 + Supabase-specific attack vectors.",
  },
  {
    id: "incident-response",
    title: "Incident Response Plan",
    track: "security",
    status: "planned",
    effort: "S",
    description:
      "Documented playbook: what to do if a key leaks, if a customer reports unauthorized access, if Supabase is breached. Notification timelines. State breach-notification law (TX) compliance.",
  },
  {
    id: "soc2",
    title: "SOC 2 Type II Readiness",
    track: "security",
    status: "idea",
    effort: "XL",
    description:
      "Required if selling FirstCall OS to enterprise restoration chains or franchises. Major undertaking. Defer until commercial demand proves it out.",
  },

  // ═══════════════════════════════════════════════════════════════════
  // INTEGRATIONS — PLANNED
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "xactimate",
    title: "Xactimate Sync",
    track: "integrations",
    status: "planned",
    effort: "XL",
    description:
      "Direct sync to actual Xactimate (not just generating their format). Push estimates, pull adjuster comments. Industry-standard requirement for insurance work.",
  },
  {
    id: "quickbooks",
    title: "QuickBooks Export",
    track: "integrations",
    status: "planned",
    effort: "L",
    description:
      "Push invoices, customers, payments to QBO. Avoid double-entry bookkeeping.",
  },
  {
    id: "stripe",
    title: "Stripe Payments",
    track: "integrations",
    status: "planned",
    effort: "L",
    description:
      "Accept customer deductibles online. Subscription billing if FirstCall OS becomes SaaS. Env var already set; nothing wired yet.",
  },
  {
    id: "resend",
    title: "Resend Email",
    track: "integrations",
    status: "planned",
    effort: "M",
    description:
      "Wire transactional emails: invoice sent, scope approved, drying complete. Env var set; nothing wired yet.",
  },
  {
    id: "carrier-portals",
    title: "Insurance Carrier Portals",
    track: "integrations",
    status: "idea",
    effort: "XL",
    description:
      "Many carriers (State Farm, Allstate, etc.) have proprietary vendor portals. Unified upload of docs/photos/claims would be huge but is per-carrier integration work.",
  },

  // ═══════════════════════════════════════════════════════════════════
  // IDEAS
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "subcontractor-portal",
    title: "Subcontractor Portal",
    track: "core",
    status: "idea",
    effort: "L",
    description:
      "Outside reconstruction subs claim jobs, upload progress photos, submit invoices. Reduces back-and-forth.",
  },
  {
    id: "moisture-readings",
    title: "Daily Moisture Readings (IICRC S500)",
    track: "core",
    status: "done",
    effort: "M",
    shipped_at: "2026-04-30",
    description:
      "Per-job moisture log on the job detail page. Tech captures psychrometric readings (GPP, RH, temp, material moisture %) per IICRC S500. Grouped by date, dry-standard checkbox, viewable from adjuster portal.",
    features: [
      "Inline log entry: room, location detail, material, moisture %, RH %, temp °F, GPP",
      "Grouped by date for daily-walkthrough cadence",
      "'Dry standard met' checkbox per reading",
      "Full reading history visible to adjuster via portal",
    ],
  },
  {
    id: "turing",
    title: "Turing — Self-Optimization",
    agent: "Turing",
    track: "core",
    status: "idea",
    effort: "L",
    description:
      "Audits FirstCall OS codebase. Looks for inefficient prompts, redundant code, slow queries. Suggests refactors.",
  },
];

// ─── Progress Math ────────────────────────────────────────────────────
// Weighted by effort. Ideas excluded (they're not committed work).

const STATUS_WEIGHTS = { done: 1, in_progress: 0.5, planned: 0, idea: 0 };

export function computeTrackProgress(track: Track | "all", items: RoadmapItem[] = ROADMAP) {
  const tracked = items.filter((i) => {
    if (i.status === "idea") return false;
    if (track === "all") return true;
    return i.track === track;
  });

  const total = tracked.reduce((sum, i) => sum + EFFORT_WEIGHTS[i.effort], 0);
  if (total === 0) return { percent: 0, doneWeight: 0, totalWeight: 0, items: 0 };

  const earned = tracked.reduce(
    (sum, i) => sum + EFFORT_WEIGHTS[i.effort] * STATUS_WEIGHTS[i.status],
    0
  );

  return {
    percent: Math.round((earned / total) * 100),
    doneWeight: earned,
    totalWeight: total,
    items: tracked.length,
  };
}

export function computeStatusCounts(items: RoadmapItem[] = ROADMAP) {
  return {
    done: items.filter((i) => i.status === "done").length,
    in_progress: items.filter((i) => i.status === "in_progress").length,
    planned: items.filter((i) => i.status === "planned").length,
    idea: items.filter((i) => i.status === "idea").length,
  };
}
