# Signature Evidence and MFA/AAL2 Containment Implementation Plan

> **For Hermes:** Use the `subagent-driven-development` skill to implement this plan task-by-task. Keep database and application changes in the order below; do not enable enforcement until the owner enrollment/challenge gate passes.

**Goal:** Close SEC-03 and SEC-04 by making uploaded-document signature evidence permissioned, object-scoped, append-only, and transactionally audited, and by requiring current/recent AAL2 for privileged identity, session, MFA, backup, bearer-token, PII, secret, and financial operations.

**Architecture:** Replace mutable `job_documents.signed*` state with an immutable event ledger and a derived current-state view. All signature transitions go through authenticated, role-checking, job-scoping PostgreSQL RPCs that lock the document and atomically append both evidence and audit. Centralize Supabase assurance checks in `lib/auth-helpers.ts`, expose a reusable TOTP challenge route, classify permission-backed actions by assurance requirement, and add explicit guards to sensitive actions that currently use ad-hoc role checks. Roll out behind an off-by-default server feature flag, first proving the owner can enroll and challenge before enforcing sensitive actions and only later privileged-login routing.

**Tech Stack:** Next.js 16 server actions/proxy, React 19, Supabase Auth MFA and SSR cookies, PostgreSQL migrations/RLS/SECURITY DEFINER RPCs/triggers, Vitest, Playwright, Supabase CLI disposable local stack.

---

## Security decisions and acceptance criteria

1. Add `documents.sign` to `Permission`; grant it to `owner`, `manager`, and `office`, never `technician`. Both recording and correcting signature evidence require this permission. This preserves the current back-office workflow while closing authentication-only access.
2. A signature action accepts `documentId`, not a caller-authoritative `jobId`. The database loads and locks `job_documents`, obtains the canonical `job_id`, and authorizes it. `owner`/`manager`/`office` may access any organization job; a future role granted `documents.sign` must also be `jobs.lead_tech_id = auth.uid()` or have a `job_assignments` row. The caller-supplied job ID is removed from authorization and used only after returning the canonical job ID for revalidation.
3. `job_document_signature_events` is the source of truth. Rows are never updated or deleted. `signed` creates initial evidence; `voided` invalidates the current evidence with a mandatory reason; `superseded` simultaneously replaces current evidence with corrected signer data and a mandatory reason. “Unmark signed” and clearing `job_documents.signed`, `signed_at`, or `signed_by_name` cease to exist.
4. Each RPC locks the parent document (`FOR UPDATE`), validates an optional/required expected current event ID to reject stale tabs, appends exactly one event, and appends a redacted `audit_logs` record in the same transaction. RPC failure, including audit insert failure, rolls the transition back. The immutable event row is also the durable authoritative audit evidence.
5. A trigger rejects `UPDATE`/`DELETE` on signature events for every role, including service role. A second trigger rejects changes to legacy `job_documents.signed*` columns; after backfill those columns are read-only compatibility data and application reads move to a view. Do not use a session GUC bypass: service-role callers could forge it.
6. `requireAal2()` verifies the authenticated user through `auth.getUser()`, calls `auth.mfa.getAuthenticatorAssuranceLevel()`, and fails closed unless `currentLevel === "aal2"`. `requireRecentAal2()` additionally verifies a TOTP/MFA entry in the access-token `amr` claim is no older than 10 minutes. Decode claims only after Supabase has verified the user/token; validate the claim shape and timestamp and fail closed on absence, future skew over 60 seconds, or parse errors.
7. Assurance errors are structured: `{ error, code: "AAL2_REQUIRED" | "AAL2_RECENT_REQUIRED" | "MFA_ENROLLMENT_REQUIRED", challengeUrl }`. `challengeUrl` is `/mfa-challenge?next=<encoded safe internal path>`; never accept an external or protocol-relative return URL.
8. Current AAL2 is required for viewing privileged security/session lists and starting sensitive flows. Recent AAL2 (10 minutes) is required at mutation time for user administration, password change, global/other-session revocation, MFA enrollment when another verified factor exists, MFA unenrollment, backup trigger/download/verification, portal/adjuster token generation/rotation/revocation, PII search/deletion, secret-rotation attestations, document signing/correction, and all permission-backed estimate/invoice/payment/settings/customer-delete financial or administrative mutations.
9. First-factor enrollment is allowed at AAL1 so an owner cannot be trapped. Verifying enrollment establishes AAL2. Adding another factor requires recent AAL2. Removing any factor requires recent AAL2; removing the last verified factor is additionally owner-only during containment and requires an explicit typed confirmation. Provider policy should eventually disallow owner/manager AAL1 entry, but repository enforcement must work independently.
10. Rollout modes are `off`, `sensitive`, and `privileged-login`, read only from server environment as `MFA_AAL2_ENFORCEMENT`. Unknown/missing values mean `off`. `sensitive` gates actions/pages without globally redirecting owners. `privileged-login` additionally redirects AAL1 owner/manager requests to challenge only if a verified factor exists. `/mfa-challenge`, `/settings/security`, `/auth/*`, `/login`, and static/API routes must never enter a redirect loop.

Definition of done:

- Every role/action matrix test passes; technicians and unassigned future scoped roles cannot forge/correct evidence.
- Direct PostgREST and service-role attempts cannot clear legacy signature fields or mutate/delete evidence.
- AAL1 receives no side effect and a challenge response on every listed sensitive action; AAL2 succeeds; stale AAL2 is rejected where recency is required.
- Challenge verification refreshes SSR cookies and returns only to a safe internal URL.
- High-risk mutation and audit evidence commit together or neither commits.
- Owner enrollment and challenge are proven in preview before `sensitive`; no production enforcement occurs until live provider gates are signed off.

---

### Task 1: Freeze the role and assurance contracts with failing unit tests

**Objective:** Establish the exact RBAC/AAL policy before changing implementation.

**Files:**
- Modify: `tests/unit/permissions.test.ts`
- Create: `tests/unit/assurance-policy.test.ts`
- Modify later in this task: `lib/permissions.ts`
- Create later in this task: `lib/assurance-policy.ts`

**Steps:**

1. Add failing matrix tests proving `documents.sign` is true for owner/manager/office and false for technician/unknown/inactive inputs.
2. Add table-driven tests for a pure `getPermissionAssurance(permission)` contract. Classify these as `recent-aal2`: `users.manage`, `settings.edit`, `customers.delete`, `estimates.edit`, `estimates.send`, `estimates.approve`, `estimates.delete`, `invoices.edit`, `invoices.send`, `invoices.void`, `invoices.record_payment`, `payments.delete`, `portals.manage`, `documents.sign`, `reports.view_financial`, and `ar.view`. Keep operational non-sensitive permissions unchanged.
3. Run `npm test -- --run tests/unit/permissions.test.ts tests/unit/assurance-policy.test.ts`; expect failures for the missing permission/module.
4. Add `"documents.sign"` in the Documents section of `lib/permissions.ts`; grant it to owner/manager/office only.
5. Create `lib/assurance-policy.ts` with typed `AssuranceRequirement = "none" | "aal2" | "recent-aal2"`, a total default of `none`, the explicit set above, and `RECENT_AAL2_MINUTES = 10`.
6. Re-run the targeted tests; expect pass.
7. Commit only during implementation: `git add lib/permissions.ts lib/assurance-policy.ts tests/unit/permissions.test.ts tests/unit/assurance-policy.test.ts && git commit -m "test: define signature and AAL2 policy"`.

---

### Task 2: Specify the immutable signature migration with TDD

**Objective:** Create a source-level migration contract before writing SQL.

**Files:**
- Create: `tests/unit/signature-evidence-migration.test.ts`
- Create later: `supabase/migrations/042_signature_mfa_containment.sql` (if another migration lands first, preserve the suffix and use the next available numeric prefix everywhere)

**Steps:**

1. Write failing migration tests asserting the SQL contains:
   - `job_document_signature_events` with event check `signed|voided|superseded`, `document_id`, `prior_event_id`, actor ID/name/role, signer name, reason, DB-generated `occurred_at`, and a unique event ID;
   - a backfill from every legacy row where `signed IS TRUE OR signed_at IS NOT NULL`, preserving legacy signer/time and marking actor as nullable migration provenance;
   - indexes on `(document_id, occurred_at desc, id desc)` and `prior_event_id`;
   - an immutable update/delete trigger;
   - a legacy-signature-column update guard;
   - a `job_document_signature_state` view deriving current signed state and current evidence ID from the latest event;
   - authenticated-only grants and no direct INSERT/UPDATE/DELETE grants on the event table;
   - `record_job_document_signature`, `void_job_document_signature`, `supersede_job_document_signature`, and `update_job_document_metadata` SECURITY DEFINER RPCs with `search_path = ''`;
   - explicit `auth.uid()`, active-profile role, canonical document/job lookup, row lock, expected-event concurrency check, mandatory reason checks, and atomic `audit_logs` insert.
2. Run `npm test -- --run tests/unit/signature-evidence-migration.test.ts`; expect missing-file failure.
3. Do not accept regex-only tests as final proof; Task 8 adds migrated-database behavior tests.

---

### Task 3: Implement the append-only signature ledger, scope, RPCs, and durable audit

**Objective:** Make signature integrity a database invariant even against service-role application mistakes.

**Files:**
- Create: `supabase/migrations/042_signature_mfa_containment.sql`
- Regenerate after migration: `lib/database.types.ts`
- Test: `tests/unit/signature-evidence-migration.test.ts`

**Migration design:**

1. Create `public.job_document_signature_events`:
   - `id uuid primary key default gen_random_uuid()`;
   - `document_id uuid not null references public.job_documents(id) on delete restrict`;
   - `event_type text not null check (...)`;
   - `prior_event_id uuid null references ... on delete restrict`;
   - `signed_by_name text null`, `reason text null`;
   - `actor_id uuid null references public.profiles(id) on delete set null`, snapshot `actor_name text`, `actor_role text`;
   - `occurred_at timestamptz not null default clock_timestamp()`;
   - `request_id uuid not null default gen_random_uuid()`;
   - checks: signer is nonblank for signed/superseded; reason is nonblank for voided/superseded; initial signed has no prior; correction has prior.
2. Enable RLS. Add SELECT policy using the same object scope helper as the RPC. Grant SELECT to authenticated. Revoke table mutation from `public`, `anon`, `authenticated`; service role still bypasses RLS, so enforce immutability with a `BEFORE UPDATE OR DELETE` trigger that always raises `42501`.
3. Create `public.can_manage_job_document_signature(p_document_id uuid)` as stable SECURITY DEFINER. It requires `auth.uid()`, active profile, role in owner/manager/office, and an existing document joined to its job. Include assignment logic for defense/future role extension, but do not grant technicians in the current role branch.
4. Backfill one `signed` event per legacy signed document before enabling the legacy guard. Use legacy `signed_at` when present, otherwise document `created_at`; use `signed_by_name`; actor fields are null and reason/provenance identifies migration without inventing an actor.
5. Create `public.job_document_signature_state` with one row per document, latest event by deterministic `(occurred_at DESC, id DESC)`, `signed = latest.event_type IN ('signed','superseded')`, current signer/time/evidence ID, and latest correction reason. Treat no event as unsigned.
6. Create a trigger on `job_documents` rejecting any `UPDATE` where `signed`, `signed_at`, or `signed_by_name` is distinct. It applies to service role. Keep existing signed-document delete protection; change it in this migration to consult existence of any signature event, so a void does not make the evidence/document deletable.
7. Drop `"active users update job documents"`. Create `update_job_document_metadata(document_id, doc_type, notes)` for only mutable metadata with object-scope authorization. Do not expose any signature columns. This prevents direct PostgREST from bypassing the guard while preserving `updateDocumentMeta`.
8. RPC transaction behavior:
   - resolve actor from active `profiles` and reject roles outside owner/manager/office;
   - select parent document/job `FOR UPDATE` and fail `P0002` if absent/out of scope;
   - select current event deterministically;
   - initial record requires no effective signature and no unexpected current event;
   - void/supersede requires `p_expected_current_event_id` equal to current event, current effective state signed, and nonblank reason;
   - append event with actor snapshots and canonical document ID;
   - insert `audit_logs` with action `job_document.signature_recorded|voided|superseded`, entity ID, event/prior/job IDs and reason but no document contents or secrets;
   - if audit insert fails, raise and roll back;
   - return `{ event_id, document_id, job_id, signed }` as a typed row.
9. Revoke all RPC execution from `PUBLIC`/`anon`, grant only to `authenticated`. The application must call these RPCs with the cookie-bound server client, never `createAdminClient()`, so `auth.uid()` and AAL JWT claims remain available.
10. Run the unit migration test, then regenerate types against the disposable database using `npx supabase gen types typescript --local > /tmp/database.types.ts` and replace `lib/database.types.ts` only after reviewing the diff.
11. Commit: `git add supabase/migrations/042_signature_mfa_containment.sql lib/database.types.ts tests/unit/signature-evidence-migration.test.ts && git commit -m "feat: make document signature evidence append-only"`.

---

### Task 4: Replace document actions and UX with explicit correction workflows

**Objective:** Remove mutable signature calls and make stale/cross-object calls fail closed.

**Files:**
- Modify: `app/actions/documents.ts:153-213`
- Modify: `app/(dashboard)/jobs/[id]/DocumentsVault.tsx:307-470`
- Create: `tests/unit/document-signature-actions.test.ts`
- Modify: `tests/unit/permissions.test.ts`

**Steps:**

1. Mock `requirePermission`, `requireRecentAal2`, the cookie-bound Supabase RPC client, and revalidation. Add failing tests for every role, unauthenticated, AAL1, stale AAL2, missing/cross-job document, mismatched expected event, RPC/audit failure, and success. Assert denied calls never invoke RPC/revalidation.
2. Replace `markDocumentSigned(documentId, signedByName, jobId)` with `recordDocumentSignature(documentId, signedByName)` and require `documents.sign` plus recent AAL2 before validation/RPC.
3. Delete `unmarkDocumentSigned`. Add `voidDocumentSignature(documentId, expectedCurrentEventId, reason)` and `supersedeDocumentSignature(documentId, expectedCurrentEventId, signedByName, reason)`, both using `documents.sign` + recent AAL2 and the authenticated RPC. Return structured assurance errors unchanged.
4. Change `updateDocumentMeta` to call `update_job_document_metadata`; remove its admin update.
5. Use the RPC-returned canonical `job_id` for `revalidatePath`; never trust a UI `jobId` for authorization.
6. Update the document query/type feeding `DocumentsVault.tsx` to join/select `job_document_signature_state` (locate the page loader before editing) and expose `currentEvidenceId`, effective signer/time, and latest event type.
7. Replace “Unmark signed” with a correction dialog offering:
   - **Void evidence**: mandatory reason, warning that evidence remains permanently visible;
   - **Supersede evidence**: mandatory corrected signer name and reason.
   Show pending/error state, never silently ignore action errors, and display a compact history/status note. Hide sign/correct controls when `canSignDocuments` (computed server-side via `hasPermission`) is false; this is UX only, not the enforcement boundary.
8. Run `npm test -- --run tests/unit/document-signature-actions.test.ts tests/unit/permissions.test.ts` and `npm run typecheck`; expect pass.
9. Commit: `git add app/actions/documents.ts 'app/(dashboard)/jobs/[id]/DocumentsVault.tsx' tests/unit/document-signature-actions.test.ts tests/unit/permissions.test.ts && git commit -m "feat: enforce scoped signature correction workflow"`.

---

### Task 5: Build centralized current/recent AAL2 guards

**Objective:** Provide one fail-closed assurance boundary for pages and server actions.

**Files:**
- Modify: `lib/auth-helpers.ts`
- Create: `lib/aal2.ts`
- Modify: `tests/unit/auth-helpers.test.ts`
- Create: `tests/unit/aal2.test.ts`

**Steps:**

1. Add failing tests for `currentLevel` aal1/aal2, `nextLevel`, provider errors, absent user, malformed/missing/future/stale/fresh `amr`, exact 10-minute boundary with a fake clock, safe challenge URLs, and rollout modes including unknown/missing=`off`.
2. Implement pure helpers in `lib/aal2.ts`: claim validation, `isRecentMfaClaim`, `safeChallengeUrl`, `getAal2EnforcementMode`, and structured error constructors. Never treat `nextLevel === "aal2"` as proof that the current session is AAL2.
3. In `lib/auth-helpers.ts`, add uncached internal `getVerifiedAuthContext()` that uses one cookie-bound client, `auth.getUser()`, `auth.mfa.getAuthenticatorAssuranceLevel()`, and the verified session/JWT claims. Preserve active-profile loading.
4. Add `requireAal2({ next? })` and `requireRecentAal2({ next?, maxAgeMinutes? })`. When mode is `off`, return authenticated context but emit a server-side observation without PII/token; when mode is enforcing, return structured errors. Do not cache assurance across requests or after challenge verification.
5. Modify `requirePermission` to consult `getPermissionAssurance`; after authentication and permission checks, enforce the classified assurance. Keep role denial before challenge disclosure. Add an optional `next` parameter for the calling page.
6. Avoid a double user lookup by passing the verified context internally; tests should assert one `getUser()` call per guard.
7. Run `npm test -- --run tests/unit/auth-helpers.test.ts tests/unit/aal2.test.ts tests/unit/assurance-policy.test.ts`; expect pass.
8. Commit: `git add lib/auth-helpers.ts lib/aal2.ts tests/unit/auth-helpers.test.ts tests/unit/aal2.test.ts && git commit -m "feat: centralize current and recent AAL2 guards"`.

---

### Task 6: Add the challenge flow and honest security UX

**Objective:** Let an AAL1 session elevate safely without redirect loops or losing its destination.

**Files:**
- Modify: `app/actions/mfa.ts`
- Create: `app/(auth)/mfa-challenge/page.tsx`
- Create: `app/(auth)/mfa-challenge/MfaChallengeForm.tsx`
- Modify: `app/(dashboard)/settings/security/page.tsx`
- Modify: `app/(dashboard)/settings/security/MfaEnrollment.tsx`
- Modify: `app/(dashboard)/settings/security/UnenrollButton.tsx`
- Modify: `app/(dashboard)/settings/security/SessionsPanel.tsx`
- Create: `tests/unit/mfa-actions.test.ts`
- Create: `tests/e2e/mfa-challenge.spec.ts`

**Steps:**

1. Add action tests for listing only the current user’s verified TOTP factors, challenge creation/verification, bad IDs/codes, safe return URL, cookie/session refresh, first-factor enrollment at AAL1, second-factor enrollment requiring recent AAL2, and all unenrollment rules.
2. Add `beginMfaChallenge(factorId)` and `verifyMfaChallenge(prev, formData)` to `app/actions/mfa.ts`. Verify the submitted factor ID belongs to the current user’s verified factor list before challenge. On success, call `getAuthenticatorAssuranceLevel()` again and require `currentLevel === "aal2"` before returning `{ ok, redirectTo }`.
3. Keep `verifyMfaEnrollment` as the first-factor path, but after verify confirm AAL2 and await durable audit. If another verified factor exists, `enrollMfa` first requires recent AAL2.
4. `unenrollMfa` requires recent AAL2, verifies ownership/status, validates typed confirmation for last-factor removal, and awaits audit. In `sensitive`/`privileged-login`, last-factor removal is owner-only; document support recovery as a provider-console break-glass operation, not an app bypass.
5. Build `/mfa-challenge` as an authenticated page showing verified factors and a six-digit `autocomplete="one-time-code"` form. If no verified factor exists, link to `/settings/security` with “Enrollment required”; if already AAL2, safely redirect to `next`. Add retry/error state without logging codes/challenge IDs.
6. Correct security-page copy: distinguish “factor enrolled” from “this session is verified”; never claim every login is protected unless privileged-login mode is enabled. Show current AAL and last-MFA age, an “Verify this session” link for AAL1, and the enforcement stage.
7. Add a small reusable client helper/component (create `components/Aal2ActionError.tsx` if more than one page needs it) that recognizes structured AAL errors and renders a challenge link rather than `alert()`.
8. Playwright preview tests: AAL1 owner reaches challenge, wrong TOTP remains challenged, valid TOTP returns to safe `next`, external/protocol-relative `next` is rejected, refresh retains AAL2, and sign-out/session expiry returns to login. TOTP seed must come from an isolated CI fixture account/secret, never repository source.
9. Run targeted unit tests, `npm run typecheck`, then `PLAYWRIGHT_BASE_URL=<preview> npm run test:e2e -- tests/e2e/mfa-challenge.spec.ts` only after fixture/provider gates exist.
10. Commit: `git add app/actions/mfa.ts 'app/(auth)/mfa-challenge' 'app/(dashboard)/settings/security' components/Aal2ActionError.tsx tests/unit/mfa-actions.test.ts tests/e2e/mfa-challenge.spec.ts && git commit -m "feat: add MFA step-up challenge"` (omit the component path if not needed).

---

### Task 7: Gate every sensitive operation and its UI entry point

**Objective:** Apply recent AAL2 consistently without relying on proxy/UI checks.

**Files:**
- Modify: `app/actions/users.ts`
- Modify: `app/actions/sessions.ts`
- Modify: `app/actions/mfa.ts`
- Modify: `app/actions/backups.ts`
- Modify: `app/actions/portal.ts`
- Modify: `app/actions/adjuster-portal.ts`
- Modify: `app/actions/pii.ts`
- Modify: `app/actions/secrets-rotation.ts`
- Modify: `app/actions/auth.ts`
- Modify through centralized permission classification: `app/actions/invoices.ts`, `app/actions/estimates.ts`, `app/actions/customers.ts`, `app/actions/jobs.ts`, `app/actions/cost-basis.ts`, `app/actions/expenses.ts`, `app/actions/job-costs.ts`, `app/actions/partners.ts`, `app/actions/subs.ts`
- Modify UI callers under `app/(dashboard)/settings/users`, `settings/security`, `settings/backups`, `settings/pii-inventory`, `settings/secrets-rotation`, `jobs/[id]/CustomerShareCard.tsx`, `jobs/[id]/AdjusterShareCard.tsx`, and invoice/estimate action panels
- Create: `tests/unit/sensitive-action-aal2.test.ts`

**Steps:**

1. Build a table-driven action test that imports each exported sensitive mutation and asserts AAL1/stale-AAL2 causes no admin/RPC/email/storage side effect. Include all user invite/role/active mutations; session actions and owner session listing; MFA changes; all three backup actions; all six portal/adjuster token actions; PII search/delete; secret rotation; password change; document signature transitions; invoice send/reminder/record/delete/void; estimate send/approve/delete/edit; and all actions using the classified financial/admin permissions.
2. For actions already using `requirePermission`, pass an appropriate safe `next`; centralized classification supplies recent AAL2. Do not add duplicated ad-hoc role checks.
3. Convert ad-hoc role checks to explicit permission where an existing permission fits: users/session owner operations use `users.manage`; backups use `settings.edit` plus explicit owner-only download; PII deletion uses `customers.delete` plus owner-only; secret rotation uses `settings.edit`. Add `requireRecentAal2` after role/permission for actions whose permission cannot represent the narrower role.
4. `updatePassword` requires recent AAL2 for an established session. Preserve password-recovery behavior by distinguishing the verified Supabase recovery flow; require a provider-issued recovery assurance/nonce and do not route recovery users through an unavailable TOTP factor.
5. Require current AAL2 for sensitive read/list functions (`listAllUserSessions`, backup listing/page loader, PII search, secrets history). Require recent AAL2 at mutation/download time to prevent TOCTOU.
6. Change each UI caller to render the structured challenge URL and preserve form state where practical. UI hiding is secondary; action denial remains authoritative.
7. Ensure external side effects occur only after the AAL guard. For email/backup/token actions, assert tests that no email, backup, signed URL, or token mutation occurs on assurance failure.
8. Run `npm test -- --run tests/unit/sensitive-action-aal2.test.ts tests/unit/mfa-actions.test.ts tests/unit/document-signature-actions.test.ts` and `npm run typecheck`.
9. Commit: `git add app/actions app/'(dashboard)' tests/unit/sensitive-action-aal2.test.ts && git commit -m "feat: require recent AAL2 for sensitive operations"`.

---

### Task 8: Add proxy containment without locking out the owner

**Objective:** Add optional owner/manager step-up routing only after sensitive-action enforcement is proven.

**Files:**
- Modify: `proxy.ts`
- Create: `tests/unit/proxy-aal2.test.ts`

**Steps:**

1. Extract/test a pure route decision helper. Cases: unauthenticated protected route→login; challenge/security/auth exemptions; AAL2→continue; owner/manager AAL1 with verified factor + `privileged-login`→challenge; owner/manager without factor→security enrollment (not challenge); office/technician behavior unchanged; `off`/`sensitive` never globally redirect; unsafe `next` rejected.
2. In proxy, after verified `getUser()`, only perform assurance lookup for protected routes in `privileged-login`. Do not infer factor state from unverified cookies. Preserve refreshed cookies on redirects.
3. Exempt `/mfa-challenge`, `/settings/security`, `/auth`, `/login`, password recovery, public token routes, API routes, and assets. Cap encoded `next` length and preserve only pathname/query, never origin.
4. Do not enable this mode in production as part of the code change. It is the final rollout stage after owner/backup factor verification.
5. Run `npm test -- --run tests/unit/proxy-aal2.test.ts tests/unit/aal2.test.ts` and `npm run typecheck`.
6. Commit: `git add proxy.ts tests/unit/proxy-aal2.test.ts && git commit -m "feat: add staged privileged-login AAL2 routing"`.

---

### Task 9: Prove role, object-scope, append-only, audit, and AAL behavior on a migrated disposable stack

**Objective:** Replace source-text confidence with live database/Auth behavior.

**Files:**
- Create: `tests/integration/security/signature-evidence.test.ts`
- Create: `tests/integration/security/aal2-actions.test.ts`
- Create: `tests/integration/security/helpers.ts`
- Modify: `package.json` (add `test:security:integration`)
- Add Supabase local config/seed only if the repository’s chosen integration harness requires it; do not commit credentials.

**Steps:**

1. Install/use a pinned Supabase CLI version in the implementation PR. Start a disposable stack and apply all migrations: `npx supabase start`, `npx supabase db reset`. Never point integration variables at production; helpers must abort unless URL host is localhost/127.0.0.1.
2. Seed owner, manager, office, technician, inactive user, assigned/unassigned jobs, unsigned/signed documents, and TOTP fixture factors through local admin APIs. Keep fixture secrets ephemeral in test setup.
3. Signature role matrix:
   - owner/manager/office can sign an in-scope document at fresh AAL2;
   - technician, inactive, anonymous, AAL1, and stale-AAL2 fail;
   - an unassigned future scoped role fails even if test-granted permission/application helper is bypassed;
   - arbitrary caller job ID cannot affect scope because RPC resolves canonical job;
   - concurrent same-expected-event corrections yield exactly one success;
   - direct authenticated PostgREST cannot alter legacy signature fields or insert/mutate/delete events;
   - service-role SQL/PostgREST cannot update/delete events or clear legacy signature fields;
   - void/supersede leaves prior rows intact and current-state view is correct;
   - signed/voided document remains undeletable.
4. Audit atomicity:
   - each success creates exactly one matching event and one audit row with actor/job/prior IDs;
   - force an audit insert failure in a disposable transaction and prove no evidence event commits;
   - verify no signer secret, TOTP code, bearer token, document body, or unnecessary PII is in audit details.
5. AAL matrix for every representative action category: AAL1 denied/no side effect; fresh AAL2 allowed by role; stale AAL2 denied for mutation; role denial remains denial at AAL2; refresh/session downgrade returns to challenge. Include last-factor removal and first-factor enrollment.
6. Inspect live catalogs, not migration text: assert no mutation grants/policies exist on signature events; triggers are enabled; RPC execute is authenticated-only; view/policies are active. Query `pg_policies`, `information_schema.role_table_grants`, `information_schema.routine_privileges`, and `pg_trigger`.
7. Add script: `"test:security:integration": "vitest run --config vitest.security-integration.config.ts"` and create that config if needed so unit tests remain fast.
8. Run `npm run test:security:integration`; expect all role/AAL/catalog tests pass. Deliberately remove one RPC role check, disable one immutable trigger, and bypass one AAL guard locally; prove each mutation makes CI fail, then revert the mutations.
9. Stop the disposable stack: `npx supabase stop --no-backup`.
10. Commit: `git add tests/integration package.json vitest.security-integration.config.ts supabase/config.toml && git commit -m "test: exercise signature and AAL2 containment"` (include only files actually required).

---

### Task 10: Full verification, staged release, rollback, and evidence capture

**Objective:** Ship without an owner lockout and retain verifiable release evidence.

**Files:**
- Modify if present/create: `docs/runbooks/mfa-aal2-rollout.md`
- Modify: deployment environment configuration through approved provider process only (not from local tests)

**Pre-merge commands:**

```bash
npm ci
npm test
npm run test:security:integration
npm run typecheck
npm run build
npm audit --omit=dev
npx supabase db lint --local
npx supabase migration list --local
```

Expected: all tests/typecheck/build/lint pass, zero production dependency vulnerabilities, and migration `042` applied locally. Review `git diff --check` and `git status --short`; only intended source/tests/docs/migration/type changes should appear.

**Staged rollout:**

1. **Stage 0 — code + schema, enforcement off:** deploy migration first, then application with `MFA_AAL2_ENFORCEMENT=off`. Migration is additive except direct document update narrowing; verify metadata RPC and signature view before app cutover. Observe structured guard decisions without token/PII logging.
2. **Stage 1 — owner readiness:** in preview, owner enrolls and verifies a primary TOTP plus a second recovery authenticator. Confirm recovery codes/provider recovery policy if supported. Test a new AAL1 session→challenge→AAL2, refresh, sign out, and re-entry. Ensure another named break-glass administrator/provider-console operator is available.
3. **Stage 2 — sensitive enforcement:** set preview to `sensitive`; run Playwright and manual smoke across user/session/MFA/backup/token/PII/secret/document/financial actions as AAL1 and AAL2. Then set production to `sensitive` in an announced low-traffic window. Keep `/settings/security` and challenge reachable. Monitor assurance failures and support contacts for at least one business cycle.
4. **Stage 3 — privileged login:** only after every owner/manager has a verified factor and successful challenge evidence, set preview then production to `privileged-login`. Confirm users without factor are routed to enrollment, not a dead-end challenge. Do not force office/technician login AAL2 unless a separately approved policy expands scope.
5. Record release SHA, migration history, environment mode, test output, factor-readiness counts (not secrets), owner challenge timestamp, and rollback owner in the change ticket.

**Rollback:**

- Immediate lockout containment: change `MFA_AAL2_ENFORCEMENT` from `privileged-login`→`sensitive` or `off` and redeploy/rollback environment configuration. This disables app/proxy gates but does not delete factors or evidence.
- Application rollback: roll back to the prior app build only after setting mode `off`. Because the migration makes legacy signature fields immutable, an old build’s mark/unmark action will fail safely; do not claim signature editing works during rollback.
- Database rollback is forward-only: do **not** drop/truncate signature events or re-enable field clearing. Ship a corrective migration restoring only metadata RPC/policy compatibility. Preserve the ledger, immutable triggers, and audit rows. If absolutely required by incident command, revoke signature RPC execute to freeze changes rather than weakening evidence.
- MFA provider outage: mode `off`, revoke privileged sessions as appropriate, preserve factors, and follow the provider-console recovery runbook. Never add a hidden code bypass or service-role “mark AAL2” path.

**Post-deploy verification:**

```bash
# Against an approved preview/local target only
npm run test:security:integration
PLAYWRIGHT_BASE_URL="$PREVIEW_URL" npm run test:e2e -- tests/e2e/mfa-challenge.spec.ts
```

Manually verify production catalogs under read-only change control, challenge/login behavior, audit/event counts for synthetic records, and no unexpected AAL1 success. Remove synthetic data through approved cleanup that preserves evidence events.

---

## Provider and live-console gates (must remain unresolved until independently verified)

1. Supabase project has TOTP MFA enabled; JWT `amr` claim shape/timestamp semantics and refresh behavior match the implementation’s recency parser for the deployed GoTrue version.
2. Supabase project session lifetime, refresh-token rotation/reuse detection, password-recovery assurance, factor recovery, and admin factor-removal procedures are documented and tested; repository code cannot prove these settings.
3. At least one owner has two verified factors and has completed a fresh AAL2 challenge in preview; every owner/manager is inventoried before `privileged-login`.
4. A named break-glass operator can access Supabase and Vercel consoles without relying on the affected FirstCall account, and the off-mode redeploy procedure has been timed/tested.
5. Deployed migration history and live `pg_policies`, grants, routines, triggers, and view definitions match the reviewed migration; no drift or manual permissive policy remains.
6. Vercel preview/production environment separation is confirmed; `MFA_AAL2_ENFORCEMENT` is server-only, defaults off, and environment changes are audited. Preview E2E fixture credentials/TOTP secrets are isolated from production and stored only in approved CI secrets.
7. Provider/CDN/application logs redact access tokens, challenge IDs, TOTP codes, QR secrets, bearer URLs, and unsafe query strings; retention/access controls are confirmed.
8. Alerting exists for repeated AAL failures, audit/event transaction failures, factor changes, global session revocations, and unexpected mode changes, without alert payloads containing secrets/PII.
9. Backup/download storage remains private and signed-URL TTL is enforced; a fresh-AAL2 owner download is validated in preview and provider access logs are retained.
10. Production enablement/change window, owner notification, support contact, rollback owner, and post-enable observation period are approved.

## Plan review checklist

- [ ] Exact action list and role/AAL matrix reviewed by product/security owner.
- [ ] `documents.sign` roles and future assignment-scope behavior approved.
- [ ] Event semantics (`signed`, `voided`, `superseded`) and legacy backfill sampled.
- [ ] No service-role path can mutate/delete evidence or clear legacy fields.
- [ ] Audit and signature transition are one database transaction.
- [ ] First-factor enrollment remains reachable at AAL1; last-factor removal is protected.
- [ ] Recovery/password flow does not deadlock users without a usable factor.
- [ ] Every UI guard has an equivalent server/database guard.
- [ ] Disposable migrated-stack tests exercise real roles, AALs, policies, grants, triggers, and concurrency.
- [ ] Owner readiness and external provider gates are signed off before enforcement.
