# Durable Account Active Transition State Machine Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Make account activation and deactivation race-safe, idempotent, auditable, and honest across PostgreSQL and Supabase Auth.

**Architecture:** PostgreSQL owns a durable per-target transition ledger, serialization, profile state, leases, compare-and-set, and append-only evidence. Supabase Auth remains an external idempotent provider step coordinated through narrow service-role RPCs and a bounded recovery worker.

**Tech Stack:** Next.js 16, Supabase Auth/Postgres/RLS, PL/pgSQL SECURITY DEFINER RPCs, Vitest, Testing Library, Playwright, pg.

---

## Revised Task 2 outcome

Replace the current direct `profiles`/Auth writes with a **dedicated PostgreSQL transition ledger plus narrow `SECURITY DEFINER` RPCs**. PostgreSQL owns transition serialization, profile state, leases, compare-and-set, and durable audit. Supabase Auth remains an idempotently retried external step.

This removes:

- zero-row false success;
- cross-Vercel-instance activation/deactivation races;
- inferred or dishonest “authoritative” state;
- non-durable partial-failure audit;
- source-text-only UI tests.

The existing uncommitted `users.ts`, `UserRoleEditor.tsx`, and test changes should be replaced rather than incrementally repaired.

---

## Migration sequence

Preserve `039_active_account_rls_containment.sql`.

Create:

```text
040_account_active_transitions.sql
```

Renumber planned migrations and **all references to them**:

```text
040_invoice_lifecycle_rbac_expand.sql   → 041_invoice_lifecycle_rbac_expand.sql
041_invoice_lifecycle_rbac_contract.sql → 042_invoice_lifecycle_rbac_contract.sql
042_signature_mfa_containment.sql       → 043_signature_mfa_containment.sql
```

Update references in:

```text
docs/plans/2026-08-24-invoice-lifecycle-rbac.md
docs/plans/2026-08-24-signature-mfa-containment.md
docs/plans/2026-08-24-active-account-rls-containment.md
```

Required final order:

```text
039 active-account RLS containment
040 durable account-active transitions
041 invoice expand
042 invoice contract
043 signature/MFA containment
```

---

## Exact database design

### `public.account_active_transitions`

Use a dedicated table rather than profile columns. It preserves transition history without bloating `profiles` or conflating requested state with authoritative profile state.

```sql
create table public.account_active_transitions (
  id uuid primary key default gen_random_uuid(),
  target_profile_id uuid not null
    references public.profiles(id) on delete restrict,
  actor_id uuid
    references public.profiles(id) on delete set null,
  idempotency_key uuid not null,
  desired_active boolean not null,

  status text not null check (status in (
    'provider_pending',
    'provider_in_progress',
    'provider_failed',
    'provider_applied',
    'succeeded',
    'closed_inactive'
  )),

  provider_state text not null default 'unknown' check (provider_state in (
    'unknown',
    'banned',
    'unbanned',
    'missing'
  )),
  provider_observed_at timestamptz,

  attempt_count integer not null default 0 check (attempt_count >= 0),
  lease_token uuid,
  lease_expires_at timestamptz,

  last_error_code text check (
    last_error_code is null
    or last_error_code ~ '^[a-z0-9_]{1,64}$'
  ),

  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,

  unique (target_profile_id, idempotency_key),

  check (
    (status = 'provider_in_progress')
    = (lease_token is not null and lease_expires_at is not null)
  ),
  check (
    status not in ('provider_applied', 'succeeded')
    or (
      (desired_active and provider_state = 'unbanned')
      or (not desired_active and provider_state = 'banned')
    )
  ),
  check (
    (status in ('succeeded', 'closed_inactive'))
    = (completed_at is not null)
  ),
  check (
    status <> 'closed_inactive' or desired_active = false
  )
);
```

Indexes:

```sql
create unique index account_active_transitions_one_open_target
on public.account_active_transitions(target_profile_id)
where status not in ('succeeded', 'closed_inactive');

create index account_active_transitions_recovery
on public.account_active_transitions(status, lease_expires_at, updated_at);

create index account_active_transitions_target_history
on public.account_active_transitions(target_profile_id, created_at desc);
```

`closed_inactive` is the only manually closeable exceptional outcome. It may be used only when the profile is verified inactive and the provider is verified banned or the Auth user is confirmed missing. There must be no generic “cancel” that could silently abandon an unbanned account.

### `public.account_active_transition_events`

This is the append-only durable outcome audit. Do not use `logAudit()`, which intentionally swallows failures.

```sql
create table public.account_active_transition_events (
  id uuid primary key default gen_random_uuid(),
  transition_id uuid not null
    references public.account_active_transitions(id) on delete restrict,
  event_type text not null check (event_type in (
    'claimed',
    'profile_deactivated',
    'provider_attempt_started',
    'provider_attempt_failed',
    'provider_confirmed',
    'profile_activated',
    'transition_succeeded',
    'recovery_resumed',
    'closed_inactive'
  )),
  attempt_number integer check (
    attempt_number is null or attempt_number > 0
  ),
  provider_state text check (provider_state in (
    'unknown',
    'banned',
    'unbanned',
    'missing'
  )),
  error_code text check (
    error_code is null or error_code ~ '^[a-z0-9_]{1,64}$'
  ),
  occurred_at timestamptz not null default clock_timestamp()
);
```

Add `(transition_id, occurred_at, id)` index and an unconditional `BEFORE UPDATE OR DELETE` trigger that raises `42501`.

Events contain UUIDs, stages, attempt numbers, sanitized error codes, and provider state only—no email, name, raw provider error, token, IP, or metadata payload.

Also insert a redacted `audit_logs` row in each transition RPC transaction:

```json
{
  "transition_id": "<uuid>",
  "desired_active": false,
  "transition_status": "provider_failed",
  "provider_state": "unknown",
  "error_code": "provider_unavailable"
}
```

Set `user_name = null`; never put target or actor names/emails in details.

### Privileges and immutability

For both tables:

```sql
alter table ... enable row level security;
revoke all on ... from public, anon, authenticated, service_role;
```

Grant only RPC execution to `service_role`; optionally grant table `SELECT` to a dedicated definer function, not application roles.

Add a `BEFORE UPDATE OF active ON public.profiles` guard:

- `true → false` is allowed only while an open transition for that target has `desired_active=false` and status `provider_pending`;
- `false → true` is allowed only while an open transition has `desired_active=true`, status `provider_applied`, and `provider_state='unbanned'`;
- otherwise raise `42501`.

This trigger applies to service-role direct updates too. The transition rows cannot be forged through PostgREST because direct table privileges are revoked.

---

## RPC contract

Every RPC must be:

```sql
security definer
set search_path = ''
```

Revoke from `PUBLIC`, `anon`, and `authenticated`; grant only to `service_role`.

### 1. Claim/idempotently resume

```sql
public.claim_account_active_transition(
  p_target_profile_id uuid,
  p_desired_active boolean,
  p_idempotency_key uuid,
  p_actor_id uuid
)
returns table (
  transition_id uuid,
  desired_active boolean,
  transition_status text,
  profile_active boolean,
  provider_state text,
  attempt_count integer,
  retryable boolean
)
```

Behavior:

1. Validate active owner actor and reject self-deactivation.
2. Acquire `pg_advisory_xact_lock(hashtextextended(p_target_profile_id::text, 0))`.
3. `SELECT ... FROM profiles WHERE id = ... FOR UPDATE`; raise `P0002` if absent.
4. If `(target,idempotency_key)` exists:
   - reject if its desired state differs;
   - otherwise return it without creating another transition.
5. If another open transition exists:
   - same desired state: return conflict/resume information;
   - opposite desired state: raise a typed `account_transition_conflict`.
6. Insert transition and `claimed` event.
7. For deactivation, atomically set profile inactive before returning:
   - `UPDATE profiles SET active=false WHERE id=p_target AND active IS DISTINCT FROM false RETURNING id`;
   - require exactly one returned row, or explicitly verify the locked row is already false;
   - append `profile_deactivated`.
8. For activation, leave the profile unchanged.
9. Append the matching redacted `audit_logs` event.
10. Return a database snapshot.

No provider call may occur until this RPC commits.

### 2. Acquire a provider-call lease

```sql
public.acquire_account_provider_work(
  p_transition_id uuid,
  p_worker_token uuid,
  p_lease_seconds integer default 60
)
returns table (
  transition_id uuid,
  target_profile_id uuid,
  desired_active boolean,
  attempt_number integer,
  transition_status text
)
```

Lock transition and target rows. Permit acquisition from:

- `provider_pending`;
- `provider_failed`;
- expired `provider_in_progress`.

Reject active leases and terminal transitions. Increment `attempt_count`, set `provider_in_progress`, lease token/expiry, and append `provider_attempt_started`. An expired lease appends `recovery_resumed` first.

This is the cross-instance worker claim. Only one Vercel instance receives the lease.

### 3. Record provider result

```sql
public.record_account_provider_result(
  p_transition_id uuid,
  p_worker_token uuid,
  p_succeeded boolean,
  p_provider_state text,
  p_error_code text default null
)
returns table (
  transition_id uuid,
  transition_status text,
  profile_active boolean,
  provider_state text,
  retryable boolean
)
```

Require the matching unexpired lease and `provider_in_progress`.

On success:

- require `banned` for deactivation or `unbanned` for activation;
- set `provider_applied`, clear lease/error, set `provider_observed_at`;
- append `provider_confirmed` and atomic redacted audit.

On failure:

- allow only the error-code allowlist:
  `provider_timeout`, `provider_unavailable`, `provider_rate_limited`,
  `provider_rejected`, `provider_user_missing`, `provider_response_unverified`;
- set `provider_failed`, clear lease, preserve truthful provider state;
- append `provider_attempt_failed` and atomic partial-failure audit.

Never store the provider’s raw message.

### 4. Finalize profile state

```sql
public.finalize_account_active_transition(
  p_transition_id uuid
)
returns table (
  transition_id uuid,
  desired_active boolean,
  transition_status text,
  profile_active boolean,
  provider_state text,
  retryable boolean
)
```

Acquire target advisory lock, transition row lock, and profile row lock.

Require `provider_applied` and matching confirmed provider state.

- Deactivation: assert profile is false; do not rewrite it.
- Activation: CAS update `profiles.active=true`; require one affected row or explicitly verify it was already true under the lock.
- Append `profile_activated` when applicable.
- Set `succeeded`, `completed_at`, clear lease/error.
- Append `transition_succeeded` and redacted audit atomically.

### 5. Read authoritative snapshot

```sql
public.get_account_active_transition(
  p_transition_id uuid
)
returns table (
  transition_id uuid,
  target_profile_id uuid,
  desired_active boolean,
  transition_status text,
  profile_active boolean,
  provider_state text,
  provider_observed_at timestamptz,
  attempt_count integer,
  last_error_code text,
  retryable boolean
)
```

### 6. Recovery listing

```sql
public.list_recoverable_account_active_transitions(
  p_limit integer default 25
)
returns table (
  transition_id uuid,
  transition_status text,
  updated_at timestamptz
)
```

Return `provider_pending`, `provider_failed`, `provider_applied`, and expired `provider_in_progress`, oldest first. Actual ownership still requires `acquire_account_provider_work`, so multiple workers may safely receive the same candidate list.

---

## Application call order

Create shared server-only orchestration in:

```text
lib/account-active-transitions.ts
```

`setUserActive` becomes:

```ts
setUserActive(
  profileId: string,
  desiredActive: boolean,
  idempotencyKey: string
): Promise<AccountActiveResult>
```

Result shape must keep the systems separate:

```ts
type AccountActiveResult = {
  outcome: "completed" | "pending" | "conflict" | "error";
  transitionId: string | null;
  desiredActive: boolean;
  profileActive: boolean | null;
  providerState: "banned" | "unbanned" | "missing" | "unknown";
  transitionStatus:
    | "provider_pending"
    | "provider_in_progress"
    | "provider_failed"
    | "provider_applied"
    | "succeeded"
    | "closed_inactive"
    | "unavailable";
  retryable: boolean;
  message: string;
};
```

Never return a single ambiguous `active`.

Exact request flow:

1. `requirePermission("users.manage")`.
2. Validate UUIDs/boolean and reject self-deactivation.
3. Call `claim_account_active_transition`.
4. If terminal, return its snapshot.
5. If `provider_applied`, skip provider and call finalize.
6. Otherwise acquire provider lease with a fresh worker UUID.
7. Call Auth:
   - deactivate: `updateUserById(id, { ban_duration: "876000h" })`;
   - activate: `updateUserById(id, { ban_duration: "none" })`.
8. Validate the returned user ID and `banned_until`; do not infer provider state from the requested operation.
9. Record success/failure using `record_account_provider_result`.
10. On success call `finalize_account_active_transition`.
11. Read and return the database snapshot.
12. `revalidatePath("/settings/users")` and `revalidatePath("/settings/security")`.
13. In the client, call `router.refresh()` in `finally` after every settled action, including errors/conflicts.

If Auth succeeds but the database confirmation call fails, return:

> Provider change may have completed, but database confirmation is pending. The profile remains inactive; retry this transition.

The durable row remains leased or `provider_applied`; after expiry the recovery worker repeats the idempotent provider operation or finalizes. A hard database outage cannot durably record the outage while it is unavailable; the already-durable preceding stage and expired lease are the recovery evidence, and the next worker must append `recovery_resumed`.

Safe operator messages:

- Deactivation complete: “Account is inactive and sign-in is blocked.”
- Deactivation pending: “Account is inactive in the application. Sign-in blocking is not yet confirmed; retry this transition.”
- Activation pending: “Account remains inactive. Sign-in restoration is not confirmed; retry this transition.”
- Conflict: “Another account transition is in progress. Refresh and retry that transition.”
- Unknown provider state: “Auth state is not confirmed. Do not treat this transition as complete.”

---

## Recovery semantics

Add:

```text
app/api/cron/reconcile-account-active-transitions/route.ts
scripts/reconcile-account-active-transitions.mjs
```

Both use the same orchestration module.

- Cron authentication must fail closed on absent/mismatched `CRON_SECRET`.
- Process a bounded batch, e.g. 25.
- Listing does not claim work; each item must acquire its provider lease.
- `provider_applied` finalizes without another Auth call.
- Expired `provider_in_progress` repeats the idempotent Auth update.
- `provider_failed` retries with bounded exponential scheduling based on `updated_at`/attempt count.
- No automatic opposite transition, cancellation, profile reactivation, or deletion.
- After a configured attempt threshold, continue to leave the profile inactive and surface for manual retry; do not declare success.
- Manual retry accepts the existing `transitionId`/idempotency key, never creates a competing opposite transition.
- `closed_inactive` requires explicit owner/operator resolution after provider verification and cannot make a profile active.

The CLI defaults to `--dry-run`; `--apply` is mandatory. It prints transition UUIDs, statuses, and counts only.

---

## UI requirements

Modify:

```text
app/(dashboard)/settings/users/page.tsx
app/(dashboard)/settings/users/UserRoleEditor.tsx
```

Render independently:

```text
Application: Active | Inactive | Unknown
Auth: Blocked | Unblocked | Not confirmed
Transition: Complete | Pending | Retry required
```

UI behavior:

- Generate `crypto.randomUUID()` before the first request.
- Retain the same key and transition ID for retries/timeouts.
- Disable the opposite-state control while an open transition exists.
- Never optimistically flip the displayed profile state.
- Use the action’s database snapshot until `router.refresh()` rerenders server state.
- Errors use `role="alert"`.
- non-error progress/success uses `role="status" aria-live="polite"`.
- Pending buttons use `aria-busy`, descriptive labels, and visible text.
- Refresh after success, provider failure, DB uncertainty, and conflict.

Remove the unsupported target UUID `auth.admin.signOut` control from:

```text
app/actions/sessions.ts
app/(dashboard)/settings/security/SessionsPanel.tsx
```

Either link to user administration or invoke the same canonical deactivation transition.

---

## Required tests

### Static migration contract

Create:

```text
tests/unit/account-active-transition-migration.test.ts
```

Assert schema, checks, partial unique index, advisory/row locks, exact-row verification, grants, immutable events, active-column guard, atomic audit, and absence of PII/raw error fields.

### Action orchestration

Replace the current mocks with RPC/provider-boundary tests in:

```text
tests/unit/users-active-state.test.ts
```

Cover:

- deactivation claim commits profile inactive before provider invocation;
- activation provider confirmation precedes finalize/profile activation;
- exact zero-row/not-found behavior;
- provider failure is recorded and never reports success;
- provider success plus DB confirmation failure returns unknown/pending;
- same idempotency key resumes;
- opposite transition conflict does not call provider;
- active lease does not call provider twice;
- expired lease safely retries;
- `provider_applied` only finalizes;
- no raw provider error or PII reaches result/audit;
- both revalidation paths run.

### Real concurrent database integration

Create:

```text
tests/integration/account-active-transitions.db.test.ts
```

Use two independent PostgreSQL connections against disposable local Supabase and a synchronization barrier. Do not mock the database.

Prove:

1. simultaneous activate/deactivate claims for one target yield one open transition and one typed conflict;
2. opposite transitions cannot both reach `succeeded`;
3. repeated same-key claims return one transition;
4. only one worker acquires a live provider lease;
5. expired lease can be recovered;
6. stale/wrong worker tokens cannot record results;
7. activation cannot finalize before `provider_state='unbanned'`;
8. profile cannot be directly activated without a matching `provider_applied` transition;
9. nonexistent targets and stale CAS paths fail rather than returning success;
10. events exist for partial failures and are immutable.

### Rendered/accessibility UI

Add dependencies:

```text
@testing-library/react
@testing-library/user-event
@testing-library/jest-dom
jsdom
pg
@types/pg
```

Update `vitest.config.ts` to include `tests/unit/**/*.test.tsx`, using per-file jsdom environment.

Create:

```text
tests/unit/UserRoleEditor.test.tsx
```

Actually render and interact with the component. Assert:

- application/Auth/transition states are independently visible;
- partial deactivation remains visibly inactive with Auth “Not confirmed”;
- partial activation remains inactive;
- retries reuse the same idempotency key;
- opposite control is disabled during an open transition;
- `router.refresh()` runs after success, failure, and conflict;
- errors are announced by `role=alert`;
- progress/success uses an accessible live status;
- no requested state is shown optimistically.

A source-string assertion is not sufficient.

---

## Bite-sized RED/GREEN implementation order

1. **RED:** migration contract test.
   **GREEN:** add `040_account_active_transitions.sql`.
2. **RED:** same-key and opposite-claim DB tests.
   **GREEN:** implement table, advisory lock, claim RPC.
3. **RED:** competing lease/stale-token tests.
   **GREEN:** implement acquire/result RPCs.
4. **RED:** premature activation/direct-update/zero-row tests.
   **GREEN:** implement finalize RPC and profile trigger.
5. **RED:** partial-failure audit immutability tests.
   **GREEN:** add events, redacted atomic audit, grants.
6. **RED:** action ordering and honest-result tests.
   **GREEN:** add `lib/account-active-transitions.ts` and replace `setUserActive`.
7. **RED:** rendered UI/accessibility/router tests.
   **GREEN:** replace optimistic editor state and add status rendering.
8. **RED:** recovery lease-expiry tests.
   **GREEN:** add cron/manual reconciler.
9. Remove unsupported UUID sign-out path and test it cannot recur.
10. Renumber invoice/signature plan references and regenerate local database types.

Commands:

```bash
npm test -- --run tests/unit/account-active-transition-migration.test.ts
npm test -- --run tests/unit/users-active-state.test.ts
npm test -- --run tests/unit/UserRoleEditor.test.tsx
npm run test:security:db -- tests/integration/account-active-transitions.db.test.ts
npm run typecheck
npm test
npm run build
git diff --check
```

---

## Runtime gates

- Database integration must run only against a disposable local Supabase database. The harness must reject non-local hosts and must not load production `.env.local`.
- Provider behavior requires an isolated preview Supabase project and fixture user:
  - verify ban blocks password sign-in and refresh;
  - verify unban restores provider access;
  - verify `banned_until` semantics for the pinned Auth version;
  - run simultaneous requests through separate Vercel preview invocations.
- Do not run reconciliation with `--apply` in preview until dry-run targets are approved.
- Production migration, provider calls, reconciliation, cron enablement, and feature rollout remain explicit change-controlled release gates.
- Deploy `039`, then `040`, verify the disposable DB and preview provider gates, and only then deploy the application transition code.

## Repository impact

- **Files modified:** none; design was read-only.
- **Observed working tree:** existing uncommitted changes remain in `app/actions/users.ts`, `UserRoleEditor.tsx`, and `tests/unit/users-active-state.test.ts`.
- **Issue found:** the rejected implementation has no durable cross-instance claim, treats some unverified writes as authoritative, and omits durable partial-failure audit and rendered concurrency/accessibility tests.