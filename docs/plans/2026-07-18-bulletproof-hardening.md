# First Call OS Bulletproof Hardening Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Remove confirmed authorization and financial-integrity vulnerabilities, harden core workflows, and make the production experience trustworthy, responsive, accessible, and operationally observable.

**Architecture:** Treat Supabase/Postgres as the final authorization and transaction boundary, with server actions as secure primitives that always re-verify identity and permissions. Move multi-write money and lifecycle operations into idempotent SQL RPCs, add regression tests before each fix, and simplify the UI around the core intake-to-collection workflow.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase/Postgres RLS, Stripe, Vitest, Playwright, Vercel.

---

### Task 1: Authorization foundation

**Objective:** Prevent self-promotion and inactive-user access while centralizing server-side authorization.

**Files:**
- Modify: `lib/auth-helpers.ts`
- Modify: `lib/permissions.ts`
- Create: `supabase/migrations/031_security_hardening.sql`
- Test: `tests/unit/auth-helpers.test.ts`
- Test: `tests/unit/permissions.test.ts`

**Steps:**
1. Write failing tests for inactive users and newly required destructive permissions.
2. Run targeted tests and confirm expected failures.
3. Add active-profile enforcement and centralized `requireAuthenticatedUser`/`requirePermission` helpers.
4. Add idempotent SQL that removes self-update policies, adds active-aware helper functions, and constrains profile mutation.
5. Run targeted and full unit tests.

### Task 2: Secure service-role actions and external entry points

**Objective:** Ensure every reachable service-role action/route authenticates and authorizes before accessing private data or spending money.

**Files:**
- Modify: `app/actions/documents.ts`
- Modify: `app/actions/equipment.ts`
- Modify: `app/actions/scope.ts`
- Modify: `app/actions/estimates.ts`
- Modify: `app/actions/invoices.ts`
- Modify: `app/actions/outreach.ts`
- Modify: `app/api/calls/extract/route.ts`
- Modify: `app/api/cron/*/route.ts`
- Modify: `app/auth/callback/route.ts`
- Create: `lib/cron-auth.ts`
- Test: `tests/unit/cron-auth.test.ts`
- Test: `tests/unit/safe-redirect.test.ts`

**Steps:**
1. Write failing tests for fail-closed cron authentication and safe relative redirects.
2. Add reusable secure primitives.
3. Require identity/permission in exposed server actions and validate record ownership instead of raw storage paths.
4. Require auth, body limits, transcript limits, and rate limiting for AI extraction.
5. Run targeted and full tests.

### Task 3: Idempotent transactional payments

**Objective:** Make Stripe retries and concurrent payment updates safe.

**Files:**
- Create: `supabase/migrations/032_payment_integrity.sql`
- Modify: `app/api/stripe/webhook/route.ts`
- Modify: `app/actions/invoices.ts`
- Test: `tests/unit/stripe-payment.test.ts`

**Steps:**
1. Write failing tests for duplicate Stripe events, invalid amounts, and durable failure responses.
2. Add unique event/reference constraints and an idempotent transactional RPC.
3. Route Stripe and manual payment writes through the RPC.
4. Return non-2xx on processing failure.
5. Run targeted and full tests.

### Task 4: RLS, storage, token, signing, and backup integrity

**Objective:** Enforce active-role-aware database access, safer bearer tokens, race-safe signing, and complete verified backups.

**Files:**
- Create: `supabase/migrations/033_rls_storage_token_hardening.sql`
- Modify: `app/actions/sign.ts`
- Modify: `app/adjuster/[token]/page.tsx`
- Modify: `lib/backups.ts`
- Modify: `app/actions/backups.ts`
- Test: `tests/unit/backup-integrity.test.ts`
- Test: `tests/unit/token-policy.test.ts`

**Steps:**
1. Write failing tests for backup payload verification and pagination behavior.
2. Replace broad `FOR ALL authenticated` policies with role-aware operations and active checks.
3. Restrict storage paths and remove signing credentials from adjuster data.
4. Make signing conditional and single-use.
5. Page all backup tables, fail on table errors, add counts/checksums/schema version, and verify the actual payload shape.
6. Run targeted and full tests.

### Task 5: Core workflow reliability

**Objective:** Make intake correctable, status transitions enforce readiness, and data failures visible.

**Files:**
- Modify: `app/(dashboard)/calls/new/page.tsx`
- Modify: `app/actions/calls.ts`
- Modify: `app/actions/jobs.ts`
- Modify: `app/(dashboard)/jobs/[id]/StatusSelector.tsx`
- Modify: `app/actions/jobs.ts`
- Modify: core list/financial pages that swallow query errors
- Create: `lib/job-transition.ts`
- Test: `tests/unit/job-transition.test.ts`
- Test: `tests/unit/intake-normalization.test.ts`

**Steps:**
1. Write failing transition and intake-normalization tests.
2. Add editable intake, customer matching, and required payment-route validation.
3. Add server-side readiness gates with explicit manager override/audit behavior.
4. Replace false empty states with clear localized error states and retry paths.
5. Run targeted and full tests.

### Task 6: Smooth trustworthy UX

**Objective:** Remove dead affordances, simplify production navigation, improve mobile/accessibility, and respect reduced motion.

**Files:**
- Modify: `app/(dashboard)/command-center/page.tsx`
- Modify: `lib/nav.ts`
- Modify: `app/(dashboard)/MobileNav.tsx`
- Modify: `app/(dashboard)/CommandPalette.tsx`
- Modify: `app/globals.css`
- Modify: high-frequency forms/tables
- Add shared UI primitives under `components/ui/`

**Steps:**
1. Wire or remove every dead Command Center control and repair invalid routes.
2. Hide Progress from production navigation and consolidate internal system surfaces.
3. Add labels, dialog semantics, focus behavior, live regions, and reduced-motion overrides.
4. Make field-critical forms one-column by default and tables mobile-safe.
5. Run typecheck/build and targeted E2E checks.

### Task 7: Types, dependencies, docs, CI, and observability

**Objective:** Improve maintainability and enforce quality gates.

**Files:**
- Modify: `lib/supabase.ts`
- Modify: `lib/supabase-server.ts`
- Track: `lib/database.types.ts`
- Modify: `package.json` / `package-lock.json`
- Modify: `next.config.ts`
- Replace: `README.md`
- Modify: `.github/workflows/ci.yml`
- Create: `instrumentation.ts`

**Steps:**
1. Parameterize Supabase clients with generated database types and add `server-only` protection.
2. Remove unused packages, upgrade patched dependencies, and set the Turbopack root.
3. Replace the README with setup, security, migration, cron, webhook, backup, test, and recovery documentation.
4. Add CI gates for unit tests, typecheck, build, audit, migration checks, and E2E where credentials are available.
5. Add structured server error capture hooks without exposing PII.

### Task 8: Final verification and independent review

**Objective:** Prove the hardened branch is safe to merge.

**Steps:**
1. Run unit/integration tests and coverage.
2. Run typecheck and production build.
3. Run dependency audit and resolve remaining actionable findings.
4. Run Playwright E2E against local/preview when browser installation is available.
5. Inspect migration idempotency and SQL syntax.
6. Dispatch independent security/spec and code-quality reviewers.
7. Fix all critical/important findings and rerun verification.
8. Commit the verified implementation and report any environment-dependent deployment steps separately.
