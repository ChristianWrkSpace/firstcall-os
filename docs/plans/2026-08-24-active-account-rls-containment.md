# Active-Account Deactivation and Effective-RLS Containment Implementation Plan

> **For Hermes:** Use the `software-development:subagent-driven-development` skill to implement this plan task-by-task, and use strict RED-GREEN-REFACTOR for every production change.

**Goal:** Fix SEC-01 so deactivating an account immediately makes every retained JWT ineffective at the database boundary and prevents future sign-in/refresh, while replacing every effective application policy that relies only on `auth.role()`.

**Architecture:** Migration `039` removes all twelve surviving legacy policies and recreates least-privilege policies through the active-profile-aware helpers introduced by migration `031`. The application performs state changes in a fail-closed order: deactivate the profile first and then ban the Auth user; unban first and reactivate the profile last. Local migrated-Supabase tests prove the effective catalog and a role/JWT matrix, while unit/static tests protect the action sequencing and historical policy cleanup.

**Tech Stack:** Next.js 16 server actions, TypeScript, Supabase JS/Auth JS `2.105.1`, PostgreSQL RLS, Supabase CLI `2.115.0`, Vitest 4, local Docker-backed Supabase.

---

## 1. Scope, invariants, and facts established from the repository

### In scope

- `SEC-01` from `docs/audits/wave-01-security-integrity.md`.
- Deactivation/reactivation behavior in `app/actions/users.ts`.
- The invalid target-user sign-out assumption in `app/actions/sessions.ts`.
- Every policy that remains effective after migrations `001`–`038` and predicates directly on `auth.role() = 'authenticated'` without checking the profile.
- Static tests plus a migrated disposable-database role matrix.
- A dry-run-capable reconciliation command for accounts that were already inactive before this fix.

### Source-of-truth file map

- Modify `supabase/migrations/039_active_account_rls_containment.sql` (new migration; never edit `011`, `012`, `017`, `021`, `028`, `029`, `031`, `033`, or `038`).
- Modify `app/actions/users.ts`, `app/actions/sessions.ts`, `app/(dashboard)/settings/users/UserRoleEditor.tsx`, and `app/(dashboard)/settings/security/SessionsPanel.tsx`.
- Preserve `lib/auth-helpers.ts`: its active-profile lookup is already correct; `tests/unit/auth-helpers.test.ts` remains a regression test.
- Add the exact unit/integration/script/config files named in Tasks 1–6, plus the required `package.json`, `package-lock.json`, and `.github/workflows/ci.yml` changes.

### Out of scope

- SEC-02 invoice transition/ledger containment, SEC-03 document-signature authorization, SEC-04 AAL2 enforcement, and SEC-06/07 audit durability/privacy. Do not broaden migration `039` into those findings.
- Production/provider changes during implementation or review. Those remain explicit release gates.
- Deleting Auth users or rotating their passwords as a substitute for deactivation.

### Required security invariants

1. `profiles.active = false` is the immediate authorization kill switch. A retained, unexpired access JWT must lose all application-table/storage access because RLS resolves the current profile on every statement.
2. A deactivated Auth user is banned through `auth.admin.updateUserById(userId, { ban_duration: "876000h" })`, preventing password sign-in and refresh while inactive.
3. Reactivation uses `{ ban_duration: "none" }`, but the profile is not made active until the unban succeeds.
4. Provider failure may leave an account denied (inactive but not yet banned, or active=false after a failed unban); it must never leave an account authorized contrary to the requested deactivation. Retrying the same request must converge safely.
5. No application policy in the final `pg_policies` catalog may authorize solely because the JWT role is `authenticated`.
6. `service_role` remains able to perform server automation. The role matrix tests must distinguish service-role bypass from application-JWT authorization.
7. Self-deactivation remains blocked, and malformed/nonexistent profile IDs fail closed.

### Supabase SDK constraint that changes the current design

The checked-in dependency resolves to `@supabase/supabase-js`/`@supabase/auth-js` `2.105.1`. In that release, `GoTrueAdminApi.signOut` has the signature:

```ts
signOut(jwt: string, scope?: "global" | "local" | "others")
```

It requires the target user's **access JWT**, not a user UUID. Therefore this current call is invalid and must not be retained:

```ts
admin.auth.admin.signOut(userId, "global")
```

The supported UUID-addressed administrative control is:

```ts
admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
```

Banning does not make a previously issued access JWT disappear; RLS provides immediate retained-JWT containment, while Auth rejects refresh/sign-in for the banned user. Do not claim that the SDK deleted all target refresh-session rows. If the product still requires “sign out an active account everywhere while keeping it active,” that is a separate provider/API capability gate; the public SDK does not support it by UUID.

---

## 2. Effective policy inventory and exact replacements

Create `supabase/migrations/039_active_account_rls_containment.sql`. It must run after `038_boring_reliability.sql`. It must explicitly drop these exact historical names, even though some future environments may already have removed one:

| Table | Exact historical policy to drop |
|---|---|
| `public.outreach_leads` | `auth all outreach leads` |
| `public.outreach_messages` | `auth all outreach messages` |
| `public.moisture_readings` | `auth all moisture readings` |
| `public.audit_logs` | `auth read audit` |
| `public.solomon_reports` | `auth all solomon` |
| `public.backups_log` | `auth select backups` |
| `public.partner_payouts` | `auth all partner payouts` |
| `public.partner_investments` | `auth all partner investments` |
| `public.echo_conversations` | `auth read echo` |
| `public.echo_conversations` | `auth insert echo` |
| `public.echo_conversations` | `auth update echo feedback` |
| `public.job_videos` | `auth all job videos` |

Use unconditional `drop policy if exists ...` followed by deterministic `create policy ...`; this makes a full migration transaction repeatable in a disposable validation database and prevents stale permissive names from coexisting. Do not use `auth.role()` directly in a replacement policy. Use `public.is_authenticated()`, `public.current_user_role()`, and where appropriate `public.can_access_job_storage(...)`; all fail closed for missing/inactive profiles as of `031`/`033`.

### Replacement policy contract

Use these exact new policy names and semantics:

#### Outreach — active back-office users only

- `active backoffice read outreach leads`: SELECT; role in owner/manager/office.
- `active backoffice insert outreach leads`: INSERT WITH CHECK; role in owner/manager/office.
- `active backoffice update outreach leads`: UPDATE USING and WITH CHECK; role in owner/manager/office.
- `active backoffice delete outreach leads`: DELETE; role in owner/manager/office. This matches `outreach.delete`, which includes office.
- The same four names ending in `outreach messages` on `public.outreach_messages`.

Predicate:

```sql
coalesce(public.current_user_role() in ('owner', 'manager', 'office'), false)
```

#### Moisture readings — active users with job access

- `active job users read moisture readings`: SELECT.
- `active job users insert moisture readings`: INSERT WITH CHECK.
- `active job users update moisture readings`: UPDATE USING and WITH CHECK.
- `active job users delete moisture readings`: DELETE.

Predicate:

```sql
coalesce(public.can_access_job_storage(job_id::text), false)
```

This allows owner/manager/office and assigned/lead technicians, denies inactive/missing profiles, and aligns metadata access with the hardened storage path policy. Seed both assigned and unassigned technicians in integration tests to catch accidental broadening.

#### Audit logs — active owner/manager read only

- `active audit viewers read audit`: SELECT with role owner/manager.
- Preserve migration `013` policy `auth insert audit`; it already calls `public.is_authenticated()` and is not an `auth.role()`-only policy. Do not add UPDATE or DELETE policies.

Predicate:

```sql
coalesce(public.current_user_role() in ('owner', 'manager'), false)
```

#### Solomon reports — active owner/manager only

- `active management read solomon reports`: SELECT.
- `active management insert solomon reports`: INSERT WITH CHECK.
- `active management update solomon reports`: UPDATE USING/WITH CHECK only if repository behavior proves reports are edited; current code does not, so omit UPDATE.
- `active management delete solomon reports`: omit unless a current action requires it; current code only inserts/reads.

Use owner/manager role predicate. `runSolomonReport` already enforces those roles.

#### Backup log — active owner/manager read only

- `active management read backup logs`: SELECT with owner/manager.
- No authenticated insert/update/delete policy; writes continue through service role.

#### Partner payout ledger

- `active backoffice read partner payouts`: SELECT for owner/manager/office.
- `active management insert partner payouts`: INSERT WITH CHECK for owner/manager.
- `active management delete partner payouts`: DELETE for owner/manager.
- No direct UPDATE policy because there is no application update workflow.

#### Partner investment ledger

- `active backoffice read partner investments`: SELECT for owner/manager/office.
- `active backoffice insert partner investments`: INSERT WITH CHECK for owner/manager/office.
- `active management delete partner investments`: DELETE for owner/manager.
- No direct UPDATE policy.

These match `app/actions/partners.ts` and the `requireRoles(["owner", "manager", "office"])` page guards.

#### Echo conversations — active owner of row only

- `active users read own echo`: SELECT using `public.is_authenticated() and user_id = auth.uid()`.
- `active users insert own echo`: INSERT WITH CHECK using the same predicate.
- `active users update own echo`: UPDATE USING/WITH CHECK using the same predicate.

Current application persistence uses service role, so this preserves direct-client compatibility while preventing cross-user conversation access. A separate column-immutability guard would be needed to limit direct UPDATE to feedback fields; do not claim this migration solves that unrelated issue.

#### Job videos — active users with job access

- `active job users read job videos`: SELECT.
- `active job users insert job videos`: INSERT WITH CHECK.
- `active job users update job videos`: UPDATE USING/WITH CHECK.
- `active backoffice delete job videos`: DELETE for owner/manager/office **and** `can_access_job_storage(job_id::text)`.

Read/insert/update predicate:

```sql
coalesce(public.can_access_job_storage(job_id::text), false)
```

Delete predicate:

```sql
coalesce(public.current_user_role() in ('owner', 'manager', 'office'), false)
and coalesce(public.can_access_job_storage(job_id::text), false)
```

### Migration footer assertions

End the migration with a `DO` block that raises if any of the twelve historical names still exists. Do not attempt a fragile text assertion against every `auth.role()` occurrence inside helper functions. The real catalog expression assertion belongs in the migrated DB test, where `qual` and `with_check` are available.

Do not edit old migrations or `supabase/schema.sql`; historical migrations must remain immutable, and `039` is the effective-state correction.

---

## 3. Application state-transition design

Create a small internal helper in `app/actions/users.ts` rather than duplicating provider ordering between user/session actions:

```ts
const AUTH_BAN_DURATION = "876000h";

type AccountStateResult =
  | { ok: true; active: boolean }
  | { error: string; active: boolean; retryable?: boolean };

async function applyAccountActiveState(args: {
  actor: AuthedUser;
  profileId: string;
  active: boolean;
}): Promise<AccountStateResult>;
```

Keep the helper module-private unless a dedicated server-only module is required to avoid circular imports. It must:

### Deactivate (`active === false`)

1. Validate target existence and fetch `name, active`; return a generic not-found error if absent.
2. Reject self-deactivation before any write.
3. Update `profiles.active` to `false` through the admin client **first**. Treat an already-false row as success and continue to the provider call.
4. Call `admin.auth.admin.updateUserById(profileId, { ban_duration: AUTH_BAN_DURATION })`.
5. If the Auth call fails, leave the profile inactive, await an audit event named `user.deactivation_auth_sync_failed`, and return an explicit retryable result such as: `Account access is blocked, but Auth session shutdown is pending. Retry deactivation.`
6. On success, await `user.deactivated` audit logging and revalidate `/settings/users` and `/settings/security`.

This ordering guarantees retained-JWT denial even if the Auth provider is unavailable. A refresh may still be issued before the retry completes, but the new token remains ineffective because active-profile RLS denies it.

### Reactivate (`active === true`)

1. Validate target existence.
2. Call `admin.auth.admin.updateUserById(profileId, { ban_duration: "none" })` **first**.
3. If unban fails, do not update `profiles.active`; return an error with `active: false`.
4. Update `profiles.active` to `true` last.
5. If the profile update fails after unban, return an error while the profile remains inactive. Retrying activation is safe because unban is idempotent.
6. Await `user.activated` audit logging and revalidate both settings paths.

### Concurrency and response semantics

- Opposing concurrent requests can at worst create a deny-state mismatch (for example, active profile plus a still-effective ban), not an unintended allow. Document this as fail-closed availability degradation.
- Return the authoritative resulting `active` state so `UserRoleEditor.tsx` does not optimistically display the requested state after a partial failure.
- In `app/(dashboard)/settings/users/UserRoleEditor.tsx`, show the retryable containment message and refresh server state after every request.

### Sessions action correction

Modify `app/actions/sessions.ts` and `app/(dashboard)/settings/security/SessionsPanel.tsx`:

- Delete the false comment and invalid `admin.auth.admin.signOut(userId, "global")` call.
- Do not silently substitute a user UUID for a JWT.
- Rename the owner operation/UI to `deactivateAndContainUser` / “Deactivate access” and route it through the same account-state workflow, or remove the duplicate control and link owners to `/settings/users`. Prefer one canonical mutation path.
- Keep `signOutOtherSessions()` unchanged: it acts on the current server client and `scope: "others"` is supported.
- If a distinct “force sign out but remain active” action must remain, make it return a clear unsupported-capability error until the provider exposes a supported target-session API; do not ship a success audit event.

### Existing inactive accounts

Create `scripts/reconcile-inactive-auth-users.mjs`:

- Requires `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; never prints either.
- Defaults to `--dry-run`; requires explicit `--apply` to change Auth users.
- Pages through `profiles` where `active=false` and calls `updateUserById(id, { ban_duration: "876000h" })` only under `--apply`.
- Emits counts and target UUIDs, no emails or PII.
- Is idempotent and exits nonzero if any target fails.
- Does not reactivate or delete any user.

This command handles inactive profiles created before the application workflow existed. Running it against any live project is an external change-controlled release gate, not part of implementation.

---

## 4. Test matrix and disposable migrated database

### Role matrix

Seed these principals with stable test UUIDs and matching Auth users/profiles:

- active owner
- active manager
- active office
- active assigned technician
- active unassigned technician
- inactive/deactivated user whose retained access token is saved before deactivation
- authenticated Auth user with no profile
- anonymous client
- service-role client

Seed one assigned and one unassigned job, one row per affected table, and storage objects under both job paths.

For every operation below, assert both allowed and denied cases rather than merely checking row counts:

| Resource | owner | manager | office | assigned tech | unassigned tech | inactive retained JWT | missing profile | anon | service role |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| outreach read/write/delete | allow | allow | allow | deny | deny | deny | deny | deny | allow |
| moisture assigned-job CRUD | allow | allow | allow | allow | deny | deny | deny | deny | allow |
| audit read | allow | allow | deny | deny | deny | deny | deny | deny | allow |
| Solomon read/insert | allow | allow | deny | deny | deny | deny | deny | deny | allow |
| backup-log read | allow | allow | deny | deny | deny | deny | deny | deny | allow |
| partner payout read | allow | allow | allow | deny | deny | deny | deny | deny | allow |
| partner payout insert/delete | allow | allow | deny | deny | deny | deny | deny | deny | allow |
| partner investment read/insert | allow | allow | allow | deny | deny | deny | deny | deny | allow |
| partner investment delete | allow | allow | deny | deny | deny | deny | deny | deny | allow |
| own Echo read/insert/update | allow own | allow own | allow own | allow own | allow own | deny | deny | deny | allow |
| another user's Echo row | deny | deny | deny | deny | deny | deny | deny | deny | allow |
| assigned job-video read/insert/update | allow | allow | allow | allow | deny | deny | deny | deny | allow |
| job-video delete | allow | allow | allow | deny | deny | deny | deny | deny | allow |
| refresh after deactivation/ban | n/a | n/a | n/a | n/a | n/a | deny | n/a | n/a | n/a |

Also assert that an access token captured before deactivation can no longer SELECT, INSERT, UPDATE, DELETE, upload, download, or refresh after the workflow completes. Existing access tokens may remain cryptographically valid until JWT expiry; the expected result is authorization denial, not token disappearance.

### Effective-catalog assertions

Against the reset/migrated local database, query `pg_policies` and fail if:

1. Any of the twelve historical names exists.
2. Any policy in schemas `public` or `storage` has `auth.role()` in `qual`/`with_check` without also using an active-aware helper. Exclude the implementation body of `public.is_authenticated()`; `pg_policies` contains policy expressions, not function bodies.
3. Any affected table has an unexpected command/name pair or multiple permissive policies that combine into broader access.
4. RLS is disabled on an affected table.

The test must print the offending schema/table/policy/command/expression before failing.

### Local Supabase harness

Add:

- `supabase/config.toml` — generated local-only project config, no production reference.
- `tests/integration/active-account-rls-containment.test.ts` — uses local API/admin clients to create users, retain JWTs, exercise PostgREST/Auth/storage, and clean up.
- `tests/integration/sql/assert-effective-rls.sql` — catalog assertions and direct SQL role/claim checks where clearer.
- `scripts/run-security-db-tests.mjs` — checks `supabase status -o env`, refuses any non-local URL, resets migrations, then invokes Vitest for this integration file and `psql` for catalog assertions.
- `package.json` scripts:
  - `"supabase:start": "supabase start"`
  - `"supabase:stop": "supabase stop"`
  - `"test:security:db": "node scripts/run-security-db-tests.mjs"`
- dev dependency `supabase` pinned to `2.115.0`; commit the lockfile update.

The harness must refuse hosts other than `127.0.0.1`, `localhost`, or the Docker service name explicitly emitted by local `supabase status`. It must never read the repository's production `.env.local` implicitly.

---

## 5. Implementation tasks (strict TDD)

### Task 1: Lock the policy contract with a failing static test

**Files:**
- Create: `tests/unit/active-account-rls-containment.test.ts`
- Future create: `supabase/migrations/039_active_account_rls_containment.sql`

**RED:** Write tests that require all twelve exact `DROP POLICY IF EXISTS` statements, every exact replacement name above, active-aware predicates, and absence of a replacement expression containing direct `auth.role()`.

Run:

```bash
npm test -- --run tests/unit/active-account-rls-containment.test.ts
```

Expected: FAIL because migration `039` does not exist.

**GREEN:** Add only the migration described in sections 2–3.

Run the same command. Expected: PASS.

Then run:

```bash
npm test -- --run tests/unit/security-migration.test.ts tests/unit/rls-storage-token-migration.test.ts tests/unit/active-account-rls-containment.test.ts
```

Expected: all tests PASS.

### Task 2: Prove deactivation sequencing before changing the action

**Files:**
- Create: `tests/unit/users-active-state.test.ts`
- Modify: `app/actions/users.ts`
- Modify: `app/(dashboard)/settings/users/UserRoleEditor.tsx`

**RED tracer 1:** Mock the authenticated owner, profile update, Auth admin API, audit, and revalidation. Assert deactivation writes `profiles.active=false` before `updateUserById(...ban...)` and reports success.

**GREEN tracer 1:** Implement the minimum deactivation path.

**RED tracer 2:** Make provider ban fail. Assert the profile remains inactive, success is not reported, retryable containment status is returned, and no `user.deactivated` success audit is emitted.

**GREEN tracer 2:** Add partial-failure handling.

**RED tracer 3:** Assert activation unbans first and writes `profiles.active=true` only after provider success. Add provider-failure and profile-failure cases.

**GREEN tracer 3:** Add activation path.

**RED tracer 4:** Assert self-deactivation/nonexistent target make no writes, and repeating deactivate/activate converges without error.

**GREEN tracer 4:** Add validation/idempotency.

Run after each tracer:

```bash
npm test -- --run tests/unit/users-active-state.test.ts
```

Then:

```bash
npm run typecheck
npm test -- --run tests/unit/auth-helpers.test.ts tests/unit/users-active-state.test.ts
```

Expected: PASS with no type errors.

### Task 3: Remove the unsupported target UUID sign-out path

**Files:**
- Create: `tests/unit/sessions.test.ts` or extend the user-state test if the canonical helper is imported from a server-only module.
- Modify: `app/actions/sessions.ts`
- Modify: `app/(dashboard)/settings/security/SessionsPanel.tsx`

**RED:** Assert source/runtime behavior never calls `auth.admin.signOut` with a UUID, never emits `session.force_signout` on failure, and the owner control either deactivates via the canonical workflow or links to user administration.

**GREEN:** Remove/rename the invalid path and update UI text so it does not promise active-account global sign-out.

Run:

```bash
npm test -- --run tests/unit/sessions.test.ts tests/unit/users-active-state.test.ts
npm run typecheck
```

Expected: PASS.

### Task 4: Add inactive-account reconciliation in dry-run mode first

**Files:**
- Create: `scripts/reconcile-inactive-auth-users.mjs`
- Create: `tests/unit/reconcile-inactive-auth-users.test.ts`

Design the script so core pagination/planning logic is exported and dependency-injected; the executable wrapper performs environment validation.

**RED:** Test dry-run default, pagination, `--apply`, idempotent ban request, redacted output, nonzero aggregate failure, and missing-env refusal.

**GREEN:** Implement only those behaviors.

Run:

```bash
npm test -- --run tests/unit/reconcile-inactive-auth-users.test.ts
node scripts/reconcile-inactive-auth-users.mjs --dry-run
```

The second command should fail clearly without local credentials or print a local dry-run; it must not contact any configured production project during automated tests.

### Task 5: Build the migrated disposable-DB test harness

**Files:**
- Create: `supabase/config.toml`
- Create: `tests/integration/active-account-rls-containment.test.ts`
- Create: `tests/integration/sql/assert-effective-rls.sql`
- Create: `scripts/run-security-db-tests.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`

Install the pinned CLI:

```bash
npm install --save-dev --save-exact supabase@2.115.0
```

**RED:** Start local Supabase with migrations only through `038`, run the integration test, and confirm the retained JWT can exercise at least one legacy policy and the catalog assertion reports the historical name. This proves the test catches SEC-01; do not weaken assertions to manufacture RED.

```bash
npx supabase start
# Temporarily exclude 039 only in the disposable test setup; never rename/delete the tracked migration.
npm run test:security:db
```

Expected RED: legacy access/catalog assertion FAILS for the intended reason.

**GREEN:** Reset with `039` included and run:

```bash
npx supabase db reset
npm run test:security:db
```

Expected: all role, retained-JWT, refresh, storage, and catalog assertions PASS.

Mutation-check the test once by restoring one old policy manually in the disposable database; expected: the suite fails and names that policy. Reset immediately afterward.

### Task 6: Add CI as a separate required job

**Files:**
- Modify: `.github/workflows/ci.yml`

Do not inflate the existing 15-minute unit/build job. Add a `security-db` job on Ubuntu with Docker available:

1. checkout
2. Node 20
3. `npm ci`
4. `npx supabase start`
5. `npm run test:security:db`
6. `npx supabase stop --no-backup` under `if: always()`

Use only local keys printed by `supabase status`; no repository production secrets.

Run a local workflow-equivalent sequence:

```bash
npm ci
npx supabase start
npm run test:security:db
npx supabase stop --no-backup
```

Expected: PASS and clean shutdown.

### Task 7: Full regression and migration-order verification

Run:

```bash
npm run typecheck
npm test
npm run build
npm audit --omit=dev --audit-level=high
```

Then verify migration ordering and scope:

```bash
git status --short
git diff --check
git diff -- supabase/migrations/039_active_account_rls_containment.sql app/actions/users.ts app/actions/sessions.ts app/'(dashboard)'/settings/users/UserRoleEditor.tsx app/'(dashboard)'/settings/security/SessionsPanel.tsx tests scripts package.json package-lock.json .github/workflows/ci.yml supabase/config.toml
```

Expected:

- `039` is the only new migration number and follows `038`.
- No old migration or `supabase/schema.sql` changed.
- Full tests/build/audit pass.
- No production URL, service key, JWT, email, or test credential appears in the diff.

---

## 6. Deployment order, compatibility, and rollback

### Required release order

1. Merge and deploy migration `039` first. It is compatible with the current application because active allowed roles retain the paths used by current server/user clients; inactive users immediately fail closed.
2. Run the migrated disposable DB suite against the exact release commit.
3. Deploy the application workflow/UI correction.
4. In a non-production Supabase project, run the reconciliation script dry-run, apply, and test retained JWT plus refresh denial.
5. Under production change control, inventory already-inactive profiles, run reconciliation dry-run, approve/apply, and record counts.
6. Query deployed migration history and live `pg_policies`; compare with test expectations.
7. Mark the `security-db` CI job required in branch protection.

Coordinate with SEC-02 work: this branch owns migration number `039`. If another approved branch lands a `039` first, renumber this migration to the next free number without changing its contents, and rerun `supabase db reset`. Do not reorder it before `031` or `033`, whose helpers it requires.

### Compatibility notes

- Current application writes to outreach/moisture/video/Echo partly through service role, so server behavior remains available while direct client access becomes least privilege.
- Office users retain partner-ledger reads and investment inserts but lose direct payout inserts/deletes, matching `app/actions/partners.ts`.
- Technicians must be assigned/lead techs to access moisture/video metadata, matching storage containment. Verify existing jobs have assignments before release; missing assignments cause safe denial and may need data repair.
- Existing inactive profiles are contained by `039` even before they are Auth-banned; reconciliation prevents refresh/sign-in and aligns provider state.

### Rollback policy

Do **not** roll back by recreating any historical `auth.role()`-only policy. If a replacement breaks legitimate work:

1. Keep `039` deployed.
2. Add a new forward migration that widens only the documented active role/job predicate required by the failed test.
3. Keep `profiles.active=false` and Auth ban behavior unchanged.
4. If the application release must be rolled back, leave `039` in place; the old app remains compatible for active permitted roles.
5. If Auth banning causes provider-specific problems, leave the profile inactive (RLS containment remains effective), stop reactivation, and resolve the provider gate before retrying.

---

## 7. External/live gates that repository implementation cannot close

The release owner must verify all of the following outside this read-only planning task:

1. **Supabase provider behavior:** in a non-production project matching production Auth version/config, prove `ban_duration` rejects password sign-in and refresh for an existing session, and `none` restores sign-in only after profile reactivation.
2. **Deployed migration state:** query the production migration table and `pg_policies` under change control; repository reconstruction is not evidence of deployment.
3. **Existing inactive-user reconciliation:** approve the dry-run target count before applying Auth bans; investigate missing Auth/profile counterparts rather than skipping them.
4. **JWT lifetime:** record production access-token expiry. RLS denial is immediate, but provider logs/UI must not claim cryptographic token revocation before expiry.
5. **Target-user session API:** decide whether “sign out everywhere while remaining active” is a product requirement. Supabase JS `2.105.1` cannot do that by user UUID; obtain a documented provider capability before restoring such a UI.
6. **Technician assignment data:** verify all technicians who legitimately need moisture/video access are represented by `jobs.lead_tech_id` or `job_assignments`.
7. **Branch protection:** make the migrated `security-db` job required after observing stable runtime in CI.
8. **SEC-02 sequencing:** coordinate migration numbering/release order with the separate invoice-RLS fix; do not declare the audit's combined release gate complete from SEC-01 alone.

---

## 8. Definition of done

- [ ] Migration `039` drops all twelve exact historical policy names and creates only active-aware replacements.
- [ ] A retained JWT loses all affected table/storage operations immediately after `profiles.active=false`.
- [ ] Refresh and fresh sign-in fail while the Auth user is banned.
- [ ] Activation unbans first and sets `active=true` last.
- [ ] Provider failure leaves the account denied and produces a retryable operator-visible result.
- [ ] No code calls `auth.admin.signOut(userId, ...)`.
- [ ] The migrated local catalog contains no application policy relying only on `auth.role()`.
- [ ] The full owner/manager/office/assigned-tech/unassigned-tech/inactive/missing-profile/anon/service-role matrix passes.
- [ ] Unit tests, typecheck, build, dependency audit, and local migrated DB suite pass.
- [ ] No old migration/schema file or production environment is modified.
- [ ] Every external gate above has named evidence before release sign-off.
