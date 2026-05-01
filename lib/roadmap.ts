// FirstCall OS — Project Roadmap (Source of Truth)
// Update this file as work ships. Be honest about effort + status.
// "Done" = shipped + working. NOT "shipped but needs hardening."
// Last reviewed: 2026-04-30

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
    status: "done",
    effort: "L",
    shipped_at: "2026-04-30",
    description:
      "AI-drafts five restoration legal templates with TX-statute citations: AOB, Direction to Pay, Demand Letter (§ 542.058 prompt-pay), Notice of Appraisal, IICRC S500 Drying Certificate. Approval gate before send/sign. Audit-logged at every status flip.",
    features: [
      "5 templates: AOB, Direction to Pay, Demand Letter, Notice of Appraisal, Drying Certificate",
      "Claude Opus 4.7 with adaptive thinking drafts each one",
      "Pulls live job/customer/insurance/invoice/moisture data into the prompt",
      "Status flow: draft → approved → sent / signed (no editing post-approval)",
      "Inline editor on the doc page; print-friendly white-paper layout",
      "Audit-logged: legal_doc.generated, .approved, .sent, .signed, .deleted",
      "RLS: only owner/manager can delete; everyone authenticated can draft + edit drafts",
    ],
  },
  {
    id: "solomon",
    title: "Solomon — FP&A & Margin Analysis",
    agent: "Solomon",
    track: "core",
    status: "done",
    effort: "L",
    shipped_at: "2026-04-30",
    description:
      "FP&A agent at /solomon. Aggregates jobs/invoices/payments by zip, type, and carrier. Claude Opus 4.7 with structured tool-use returns categorized insights (revenue/carrier/geography/type/operations/pricing) and prioritized recommendations. Owner/manager only. Reports persisted in solomon_reports.",
    features: [
      "/solomon dashboard with windowed analysis (30d / 60d / 90d / 6mo / 1yr)",
      "Aggregates by zip, job type, and insurance carrier with avg-days-to-pay",
      "AR aging buckets fed into prompt (0-30/31-60/61-90/90+)",
      "Claude Opus 4.7 + adaptive thinking + tool_use schema → structured insights",
      "Severity-coded insights (info/watch/alert) and priority-coded recommendations",
      "Honest about COGS gap — doesn't claim gross margin without cost data",
      "Saves history; past reports listed for trend tracking",
    ],
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
    id: "ai-gateway-multi-provider",
    title: "AI Gateway BYOK — Multi-Provider Routing (HIGH PRIORITY)",
    track: "integrations",
    status: "planned",
    effort: "M",
    description:
      "Wire Vercel AI Gateway with Bring-Your-Own-Key for Anthropic, OpenAI, Gemini, DeepSeek. Per-task model tiering: FAST=Gemini Flash (or Haiku), BALANCED=DeepSeek-V3 (or Sonnet), SMART=Opus for vision/reasoning. Plumbing already in lib/ai.ts — gated behind AI_GATEWAY_ENABLED env var. Need: BYOK keys added in Vercel AI Gateway UI, then flip flag + re-tier model strings. Estimated 30-50% AI cost reduction + automatic provider fallbacks + observability dashboard.",
  },
  {
    id: "adjuster-scoring",
    title: "Adjuster Scoring Dashboard",
    track: "core",
    status: "done",
    effort: "M",
    shipped_at: "2026-04-30",
    description:
      "/reports/adjusters grades each insurance carrier A/B/C/F by avg DSO and collection rate. Per-carrier breakdown of jobs count, billed, collected, open balance, oldest unpaid. Surfaces the moonshot Phase D play — turn the system from tracker into decision engine for which carriers to prioritize.",
    features: [
      "Per-carrier aggregation across all sent (non-void) invoices",
      "Avg DSO computed only over fully-paid invoices for fairness",
      "A/B/C/F grading: A = ≤30d DSO + ≥95% collected, scaling down to F",
      "Portfolio summary: total billed, collected, open balance, weighted DSO",
      "Default sort: worst grades first (so problems surface)",
      "Linked from /reports header",
    ],
  },
  {
    id: "tech-camera-capture",
    title: "Native Camera Capture for Techs",
    track: "core",
    status: "done",
    effort: "S",
    shipped_at: "2026-04-30",
    description:
      "PhotoUploader now offers two buttons on mobile: '📷 Take Photo' (capture=\"environment\" opens rear camera directly) and 'Upload' (file picker / library multi-select). On desktop both behave like file pickers.",
  },
  {
    id: "job-economics",
    title: "Job Economics — Live P&L",
    track: "core",
    status: "done",
    effort: "XL",
    shipped_at: "2026-04-30",
    description:
      "Real P&L per job + portfolio. Tracks tech labor + consumables + equipment days × daily cost + van allocation, then allocates monthly overhead proportionally to revenue. Per-job live P&L card on every job page with inline labor + consumables entry. Portfolio /reports/job-economics with 7d/30d/90d/YTD windows, filter by water/fire/mold/storm, by-type breakdown, top + bottom net-profit performers, 'what you have to work with' headline (collected − COGS − overhead), and a Principles Applied footer that surfaces generational business wisdom (Pay-Yourself-First, Honor-Obligations-Early, Honest-Weights-and-Measures, Plant-Trees-You-Won't-Sit-Under) tied to the actual numbers.",
    features: [
      "Migration 025: tech_labor_entries, consumables_used, vehicle_expenses, cost_basis_settings, equipment.daily_cost",
      "/settings/cost-basis: configure default hourly rate, van $/job, equipment daily, monthly overhead",
      "lib/job-pnl.ts: computeJobPnl + computePortfolioPnl with proportional overhead allocation",
      "Per-job P&L card: revenue → cost waterfall (labor/consumables/equip/van) → gross profit + margin",
      "Inline entry forms: log labor (tech, hours, rate, date) + consumables (item, qty, unit cost) without leaving the job",
      "Portfolio P&L: 4 KPI tiles, by-type table, top + bottom 3 by net profit, full per-job table",
      "'What you have to work with' callout: cash collected minus COGS minus overhead",
      "Principles footer applies wisdom (Babylonian / Hadith / Torah / Talmud / Ecclesiastes) to actual data",
    ],
  },
  {
    id: "system-health",
    title: "System Health Dashboard",
    track: "production",
    status: "done",
    effort: "M",
    shipped_at: "2026-04-30",
    description:
      "/settings/system-health — 30-second health check that reads from existing tables (audit_logs, legal_documents, agent_outcomes, pending_approvals, backups_log) without any new monitoring infrastructure. Six checks: auto-triggers firing, email delivery, drying-cert audit cron, approvals queue, backups, recursive feedback fuel.",
    features: [
      "Overall status badge: 'all healthy' / 'minor issue' / 'multiple issues'",
      "Per-check cards with fix hints when red",
      "Agent feedback breakdown: outcomes per agent in last 7 days",
      "Failed-send detector reads last_send_attempt jsonb",
      "Backup staleness check (>8d = stale)",
      "Approvals queue size + oldest-pending age",
    ],
  },
  {
    id: "vehicle-expenses",
    title: "Vehicle & Shared Expenses Log",
    track: "core",
    status: "done",
    effort: "M",
    shipped_at: "2026-04-30",
    description:
      "/expenses page logs van/truck costs by category (fuel, maintenance, insurance, lease, registration, tolls, parking, other) with date + vehicle + notes. Window picker + per-category breakdown + monthly burn projection. Closes the P&L story — monthly_overhead in cost-basis is now backed by real data.",
    features: [
      "8 expense categories with emoji + color-coded badges",
      "Window picker: 7d / 30d / 90d / 1y",
      "Daily avg + monthly burn projection",
      "By-category percentage breakdown",
      "Owner/manager can delete; office can log",
      "Linked from main nav as 🚐 Expenses (STAFF role)",
    ],
  },
  {
    id: "tech-performance",
    title: "Per-Tech Performance Dashboard",
    track: "core",
    status: "done",
    effort: "M",
    shipped_at: "2026-04-30",
    description:
      "/reports/tech-performance — hours, jobs touched, labor cost, revenue contribution per tech. Sorted by $/hour (efficiency proxy). Window picker, color-coded efficiency tiers.",
    features: [
      "Aggregates tech_labor_entries + job invoice revenue",
      "$/hour color tiers: green ≥$100, yellow ≥$60, red below",
      "Avg hours per job + jobs touched as context",
      "Honest caveat about proxy nature in footer",
    ],
  },
  {
    id: "csp-headers",
    title: "Content Security Policy + Hardened Headers",
    track: "security",
    status: "done",
    effort: "S",
    shipped_at: "2026-04-30",
    description:
      "Comprehensive CSP in proxy.ts blocking script injection, clickjacking, and side-channel attacks. Allowlists: Supabase (auth + REST + WS), Photon (address autocomplete), Deepgram (STT), Stripe (checkout), Vercel (analytics). frame-ancestors 'none' supersedes X-Frame-Options on modern browsers.",
    features: [
      "default-src 'self' baseline",
      "Provider allowlists for every external service we actually call",
      "frame-ancestors 'none' — clickjacking blocked",
      "form-action 'self' + base-uri 'self'",
      "upgrade-insecure-requests + Cross-Origin-Opener-Policy: same-origin",
      "unsafe-eval gated to dev only (Turbopack requirement)",
    ],
  },
  {
    id: "mfa-2fa",
    title: "Two-Factor Auth (TOTP)",
    track: "security",
    status: "done",
    effort: "M",
    shipped_at: "2026-04-30",
    description:
      "/settings/security — enroll an authenticator app (Google Authenticator, 1Password, Authy) via Supabase auth.mfa. QR code scan + 6-digit verification. List + remove factors. No SMS — vulnerable to SIM-swap. All enrollment + unenrollment events flow into audit_logs.",
    features: [
      "TOTP enrollment with QR code (server-side via Supabase auth.mfa)",
      "Manual secret display for password-manager paste-in",
      "Verify with 6-digit code, friendly status badges",
      "Remove factor with confirmation",
      "Audit-logged: mfa.enrolled / mfa.unenrolled",
    ],
  },
  {
    id: "backup-verify-drill",
    title: "Backup Verify Drill (one-click)",
    track: "security",
    status: "done",
    effort: "S",
    shipped_at: "2026-04-30",
    description:
      "Backups page now has a 🔍 Verify Latest Backup button that downloads the latest successful backup, parses the JSON, counts rows, and confirms they match backups_log.row_counts. Logs result to audit_logs as backup.drill_verify. 'A backup you've never restored is a backup you don't have' — this gives you the answer in 30s without a sandbox.",
    features: [
      "verifyLatestBackup() server action: download + parse + row-count compare",
      "Mismatch detection per table",
      "Auto-logged drill: action=backup.drill_verify, ok bool + total_rows + mismatches",
      "UI shows green '✓ intact' or red mismatch list",
      "Full quarterly sandbox drill still documented as belt-and-suspenders",
    ],
  },
  {
    id: "job-activity-timeline",
    title: "Job Activity Timeline",
    track: "core",
    status: "done",
    effort: "M",
    shipped_at: "2026-04-30",
    description:
      "Collapsible 'Activity Timeline' section on every job detail page. Unifies events from 9 sources (audit_logs, customer_notifications, legal_documents create/send/sign, moisture_readings, equipment_assignments deploy/retrieve, estimates create/approve, invoices create/send, payments) into one chronological feed with actor attribution. No new schema — all reads from existing tables.",
    features: [
      "13 distinct event kinds with color-coded borders",
      "Actor attribution: 'by Esquire' / 'by Christian' / 'by Tech'",
      "Capped at 460px scroll height + 50 audit log rows + 20 moisture readings to keep render fast",
      "Collapsed by default so it doesn't bloat the page",
      "Scrolls-to anchor (#timeline) so future links can deep-link to it",
    ],
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
    id: "global-search",
    title: "Global Search (⌘K)",
    track: "core",
    status: "done",
    effort: "M",
    shipped_at: "2026-04-30",
    description:
      "Cmd+K command palette searches across jobs, customers, equipment, partners, and outreach leads. Triggered by keyboard or by the search button in sidebar / mobile header.",
    features: [
      "⌘K / Ctrl+K from anywhere opens the palette",
      "Searches: jobs (number/address/desc), customers (name/email/phone/insurance), equipment (serial/model/manufacturer), partners, outreach leads",
      "Debounced (200ms) live results grouped by type",
      "Arrow-key navigation, Enter to open, Esc to close",
      "Search button in desktop sidebar + mobile header",
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
    status: "done",
    effort: "XL",
    shipped_at: "2026-04-30",
    description:
      "Field techs run the system from their phone. Installable PWA + tech-only landing page + every field action (photos, moisture, signatures, equipment, status flips) works one-handed on iPhone.",
    features: [
      "PWA manifest + iOS Add-to-Home-Screen meta + InstallPrompt for Android/Chrome",
      "iOS safe-area-inset handling on top bar + drawer (notch / Dynamic Island clearance)",
      "/my-day landing page bucketed by Today / Tomorrow / Upcoming / Unscheduled",
      "Tap-to-call + tap-for-Maps deep links on every job card",
      "Native rear-camera capture (capture=\"environment\") on PhotoUploader",
      "Voice notes — record-in-browser → Deepgram transcription → job_notes",
      "JobChecklist at top of every job — derived from real state, not manual checkboxes",
      "Equipment On Site with one-tap Deploy / Retrieve buttons (no meter hours)",
      "Moisture log with psychrometric capture (RH, temp, GPP, MC, dry-standard checkbox)",
      "E-signature flow on /sign/[token] — typed name + ESIGN/TX UETA audit trail",
      "Role-based nav — techs see only what they need, no cognitive overload",
      "Auth routes technicians to /my-day on sign-in (not /dashboard)",
    ],
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
    title: "Web Analytics + Speed Insights",
    track: "production",
    status: "done",
    effort: "S",
    shipped_at: "2026-04-30",
    description:
      "Vercel-native analytics + speed monitoring (free with the Vercel deploy). Visible at vercel.com/christianwrkspaces-projects/firstcall-os/analytics. Sentry-style error tracking is a separate item if needed later.",
    features: [
      "@vercel/analytics — page views, top pages, referrers",
      "@vercel/speed-insights — Core Web Vitals (LCP, CLS, INP) per route",
      "No signup, free with the Vercel plan",
    ],
  },
  {
    id: "backups",
    title: "Backups & Disaster Recovery",
    track: "production",
    status: "done",
    effort: "M",
    shipped_at: "2026-04-30",
    description:
      "Three-layer backup story: (L1) Supabase PITR, (L2) Supabase daily auto-snapshots, (L3) weekly cron exports operational tables to private Storage bucket as JSON. /settings/backups shows status + history + manual trigger + restore drill checklist.",
    features: [
      "Vercel Cron Sundays 03:00 UTC → /api/cron/backup",
      "Logical export of 17 operational tables to private 'backups' bucket",
      "Manual trigger button (owner/manager only) for ad-hoc snapshots",
      "Owner-only signed-URL download from history",
      "backups_log table + audit-logged manual triggers",
      "Quarterly restore-drill checklist embedded on the page",
    ],
  },
  {
    id: "tests",
    title: "Test Suite",
    track: "production",
    status: "done",
    effort: "L",
    shipped_at: "2026-04-30",
    description:
      "Vitest unit tests + Playwright E2E smoke. 29 unit tests across permissions matrix, rate-limiter sliding window, payment-routing deductible cap, Esquire doc-type invariants, webhook HMAC verification. Smoke tests hit live prod for public surfaces, redirect logic, 404s, and webhook signature rejection.",
    features: [
      "Vitest config with @ alias resolution",
      "5 unit-test files covering permissions / rate-limit / payment-route / esquire-types / verify-webhook",
      "Playwright config defaulting to firstcall-os.vercel.app, override via PLAYWRIGHT_BASE_URL",
      "Smoke spec covers login + forgot-password + auth redirects + portal/adjuster 404s + webhook 400s",
      "npm scripts: typecheck / test / test:watch / test:e2e",
    ],
  },
  {
    id: "ci-cd",
    title: "CI/CD Pipeline",
    track: "production",
    status: "done",
    effort: "M",
    shipped_at: "2026-04-30",
    description:
      "GitHub Actions: typecheck + Vitest on every push/PR. Separate workflow runs Playwright smoke daily at 06:00 UTC and on manual dispatch (avoiding cost + flakiness on every PR). Vercel still owns deploys.",
    features: [
      ".github/workflows/ci.yml — typecheck + unit tests, in-progress cancel on new pushes",
      ".github/workflows/e2e.yml — Playwright smoke daily + workflow_dispatch with optional base_url input",
      "Failure artifacts uploaded for E2E runs (playwright-report)",
      "Already had Dependabot weekly scans in place",
    ],
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
    title: "Auth Hardening (password reset + min length)",
    track: "security",
    status: "done",
    effort: "M",
    shipped_at: "2026-04-30",
    description:
      "Forgot/reset password flow via Supabase email magic link. /forgot-password requests a reset link, /reset-password accepts the new password (8+ chars, confirmation). 'Forgot?' link added to login. MFA + email verification enforcement are follow-ups.",
    features: [
      "/forgot-password page with email enumeration protection",
      "/reset-password page with confirmation field",
      "8-char minimum password enforced server-side",
      "Auto-redirect to /dashboard after successful reset",
      "Note: MFA via Supabase TOTP is a follow-up item",
    ],
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
    status: "done",
    effort: "S",
    shipped_at: "2026-04-30",
    description:
      "Stripe webhook already verifies via SDK constructEvent. Added lib/verify-webhook.ts as a generic HMAC-SHA256 helper for future Twilio / Resend / partner integrations — supports raw, sha256= prefix, and base64 modes. Constant-time compare via crypto.timingSafeEqual. Unit-tested against tampered bodies and wrong secrets.",
  },
  {
    id: "secrets-rotation",
    title: "Secrets Management & Rotation",
    track: "security",
    status: "done",
    effort: "M",
    shipped_at: "2026-04-30",
    description:
      "/settings/secrets-rotation lists every secret with vendor, blast radius, target cadence, last-rotated date, and current status (ok / soon / overdue / never). 'Mark rotated' button resets the clock on each. Rotation procedure for every secret + vendor link inline.",
    features: [
      "lib/secrets-catalog.ts — single source of truth for the 9 secrets in the app",
      "secrets_rotation_log table (append-only, owner/manager scoped via RLS)",
      "Status flags overdue/soon/ok/never against per-secret cadence (90-180 days)",
      "Audit-logged via secret.rotated action",
      "Step-by-step rotation procedure embedded on the page",
    ],
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
    status: "done",
    effort: "M",
    shipped_at: "2026-04-30",
    description:
      "/settings/pii-inventory documents every PII column across customers/jobs/invoices/photos/calls/legal/auth/outreach with classification (direct/contact/claim/financial/biometric/auth) and retention. Customer-deletion request flow with PII redaction (preserves financial records for IRS § 6001). Cross-border + vendor data movement table.",
    features: [
      "Data inventory: 26 PII columns mapped across 13 tables",
      "Classification system: direct / contact / claim / financial / biometric / auth",
      "Retention policy with TX § 521 + IRS § 6001 references",
      "Customer-search + Owner-only PII redaction (keeps financials, blanks identifiers)",
      "audit-logged as customer.pii_redacted with original values for trace",
      "Vendor data movement section (Anthropic/Deepgram/ElevenLabs/Stripe/Resend/Supabase/Vercel)",
    ],
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
    status: "done",
    effort: "S",
    shipped_at: "2026-04-30",
    description:
      "/settings/incident-response runbook. Severity matrix, leaked-key playbook (Anthropic/Supabase/Stripe/Deepgram/ElevenLabs/Resend rotations), customer breach playbook citing Tex. Bus. & Com. Code § 521.053 (60-day notification, 250+ AG threshold), vendor compromise procedure, contact tree, drill cadence.",
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
    status: "done",
    effort: "L",
    shipped_at: "2026-04-30",
    description:
      "CSV exports of customers, invoices, and payments at /reports/quickbooks. Date-range picker, RFC 4180-compliant CSV, QBO-import-ready column headers (Customer Name, InvoiceNo, ItemAmount, etc.). One-way export — bidirectional OAuth sync is a separate future item.",
    features: [
      "/reports/quickbooks page (owner/manager only)",
      "3 separate CSV downloads: customers / invoices / payments",
      "Invoices flatten to one row per line item for QBO multi-line import",
      "Date range selector (defaults to last 30 days)",
      "Audit-logged on every export",
      "How-to-import instructions inline (Customers → Invoices → Payments order)",
    ],
  },
  {
    id: "stripe",
    title: "Stripe Online Payments",
    track: "integrations",
    status: "done",
    effort: "L",
    shipped_at: "2026-04-30",
    description:
      "Customers pay invoices online from their portal. Stripe Checkout flow, webhook records payment + flips invoice status to paid/partial automatically. No manual payment entry needed for online payments.",
    features: [
      "lib/stripe.ts client + lib/stripe-checkout.ts server action",
      "💳 Pay $X Online button on customer portal (per unpaid invoice)",
      "Stripe Checkout hosted checkout (PCI compliance handled by Stripe)",
      "Webhook at /api/stripe/webhook with signature verification",
      "Auto-records payment + flips invoice status (sent → partial → paid)",
      "Audit-logged as payment.recorded_via_stripe",
    ],
  },
  {
    id: "payment-routing",
    title: "Payment Routing (customer-pay vs insurance vs deductible)",
    track: "core",
    status: "done",
    effort: "M",
    shipped_at: "2026-04-30",
    description:
      "Every job is now classified at intake as customer-pay, insurance-primary, or insurance-with-deductible. Customer portal branches accordingly: full Pay button, 'insurer billed directly' panel, or deductible-only Pay button. Stripe charge is server-side capped at the deductible. Insurance routes get an 'Email Adjuster' draft button on the job page with prefilled carrier/policy/claim + adjuster portal link.",
    features: [
      "jobs.payment_route + jobs.deductible_amount columns (migration 014)",
      "Radio-group route picker on job intake form, conditional deductible field",
      "Editable PaymentRoutePanel on job detail (right column) with badge in header",
      "Customer portal hides Pay button for insurance_primary, caps at deductible for insurance_with_deductible",
      "Stripe Checkout server action enforces the cap (defense in depth)",
      "AdjusterContactCard with mailto-prefilled draft email + Copy Info button",
    ],
  },
  {
    id: "resend",
    title: "Resend Email — Auto Event Emails",
    track: "integrations",
    status: "done",
    effort: "M",
    shipped_at: "2026-04-30",
    description:
      "Customer-facing auto-emails on job status transitions. Mitigation/Drying/Completed each fire a branded email exactly once per job (deduped against customer_notifications). Per-customer opt-out toggle. Manual sends and password-reset emails were already wired previously; this closes the auto-event gap.",
    features: [
      "lib/auto-notify.ts fire-and-forget helper, never blocks the user response",
      "STATUS_TO_EVENT map: mitigation→started / drying→started / completed→done",
      "Dedupe via existing customer_notifications row check (no spam on re-flip)",
      "Per-customer auto_notify_emails toggle (default on; opt-out via job page)",
      "Audit-logged via customer.auto_notify_set",
    ],
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
