# Invoice Lifecycle RBAC and Database Integrity Implementation Plan

> **For Hermes:** Use the `subagent-driven-development` skill to implement this plan task-by-task. Do not run production mutations until the production gates in Task 9 are explicitly approved.

**Goal:** Remove direct browser-role invoice mutations and enforce draft editing, send, payment, and void transitions through narrow, role-checked, transactional database functions without regressing the existing manual/Stripe payment paths.

**Architecture:** Use an expand/application/contract rollout. Migration `041` adds role-checked service-role RPCs, a send claim/evidence mechanism, and lifecycle triggers while preserving compatibility with the currently deployed actions. The application then routes every invoice parent/line mutation through those RPCs. Migration `042` removes all remaining direct INSERT/UPDATE/DELETE policies and retires the old payment-delete signature only after the new application is healthy. Triggers enforce financial evidence even for service-role mistakes; RPCs lock the invoice row and validate an active actor for human operations.

**Tech Stack:** PostgreSQL 15 / Supabase migrations and RLS, PL/pgSQL security-definer functions, Next.js 16 server actions, Supabase JS, Resend idempotency keys, Vitest, pgTAP via `supabase test db`.

---

## 0. Confirmed baseline and security objective

### Repository evidence

- `lib/permissions.ts` grants:
  - owner: edit/send/void/record payment/delete payment;
  - manager: edit/send/void/record payment/delete payment;
  - office: edit/send/record payment, but **not** void or delete payment;
  - technician: none of those permissions.
- `app/actions/invoices.ts` checks application permissions but uses the service-role client for broad direct line INSERT/UPDATE/DELETE, parent metadata UPDATE, send-status UPDATE, and void-status UPDATE.
- Migration `033_rls_storage_and_token_hardening.sql` introduced broad `FOR ALL` back-office invoice and line policies.
- Migration `038_boring_reliability.sql` split the parent policy but still leaves `backoffice insert invoices` and `backoffice update invoices`; invoice lines still have `backoffice access invoice lines FOR ALL` from `033`.
- Migration `032_payment_integrity.sql` already serializes payment and Stripe reconciliation with `SELECT ... FOR UPDATE`; preserve those transaction boundaries and signatures where possible.
- Migration `032` prevents line changes outside draft, `036` makes billing origin immutable, `037` reuses the active manual invoice, and `038` prevents deletion of committed invoices. New triggers/functions must compose with, not replace, those protections.
- Existing static tests cover migration text but there is no migrated-database role-matrix suite. Add pgTAP coverage so policy/function behavior is exercised after all migrations.

### SEC-02 mapping

The delegated task identifies SEC-02 as broad direct invoice parent UPDATE plus lifecycle states that can be asserted without durable evidence. The canonical audit artifact/text is not present in this worktree or git history. Before implementation, the security owner must compare this mapping with the authoritative SEC-02 wording and acceptance criteria; do not silently broaden or narrow the finding.

### Non-goals

- Do not redesign estimates, invoice numbering, manual invoice cardinality, reminders, customer portals, or payment routing.
- Do not make service-role credentials safe against a fully compromised server. The objective is least-privilege browser RLS, narrow application mutation surfaces, actor checks, and invariant enforcement.
- Do not rewrite historical invoice/payment rows merely to satisfy new evidence fields.
- Do not combine email delivery and PostgreSQL into a fictitious distributed transaction. Use a durable claim plus Resend idempotency instead.

## 1. Final authorization and lifecycle contract

### Role matrix

| Operation | owner | manager | office | technician | anon/inactive/unknown | Stripe system |
|---|---:|---:|---:|---:|---:|---:|
| Read invoices/lines/payments | allow | allow | allow | deny | deny | service only |
| Create/reopen manual invoice through existing RPC | allow | allow | allow | deny | deny | n/a |
| Edit draft meta/lines | allow | allow | allow | deny | deny | n/a |
| Claim/complete/release invoice send | allow | allow | allow | deny | deny | n/a |
| Record manual payment | allow | allow | allow | deny | deny | n/a |
| Delete payment/reconcile | allow | allow | deny | deny | deny | n/a |
| Void unpaid invoice | allow | allow | deny | deny | deny | n/a |
| Process Stripe payment | n/a | n/a | n/a | n/a | n/a | allow via existing service-only RPC |
| Direct parent or line INSERT/UPDATE/DELETE as authenticated JWT | deny | deny | deny | deny | deny | RLS bypass is not an application API |

### State/evidence rules

1. `draft`: editable only through draft RPCs; no active send claim is allowed during edits.
2. Send claim: invoice remains `draft`; one UUID claim freezes parent draft metadata and line items. Same recipient retries return the existing claim; a different recipient conflicts. A stale claim is **not** automatically stolen. An authorized actor must release it after a confirmed send failure, or operations must resolve it manually after checking Resend.
3. `sent`: transition only through completion of the matching claim and requires nonblank `sent_to`, nonnull `sent_at`, and nonblank `sent_message_id` (Resend provider ID). Existing pre-041 sent rows are grandfathered; the trigger enforces evidence on new transitions or changed evidence.
4. `partial`: requires `0 < SUM(payments.amount) < SUM(invoice_line_items.line_total)`. It may originate from draft or sent so current manual/Stripe payment behavior remains compatible.
5. `paid`: requires positive total due, `SUM(payments.amount) >= total due`, and nonnull `paid_at`.
6. Payment deletion reconciliation returns to `sent` only when valid send evidence exists; otherwise it returns to `draft`. This avoids manufacturing sent evidence.
7. `overdue`: requires valid sent evidence; only automation explicitly introduced later should transition it. This plan does not add an overdue transition RPC.
8. `void`: terminal; requires nonnull `voided_at`, active owner/manager `voided_by`, nonblank `void_reason`, zero payment rows, and no active send claim. Paid/partial invoices cannot be voided until payments are handled through the authorized payment workflow. A void invoice cannot return to another status.
9. Parent identity/provenance remains immutable under migration `036`: `job_id`, `estimate_id`, `is_manual_billing`, `invoice_number`, and `created_by` are never accepted by edit RPCs.
10. Line changes continue to require parent status `draft`; additionally they fail while `send_claim_id` is nonnull.

## 2. Exact database API and object names

### Migration files

- Create: `supabase/migrations/041_invoice_lifecycle_rbac_expand.sql`
- Create: `supabase/migrations/042_invoice_lifecycle_rbac_contract.sql`

Both migrations must be replay-safe for a database that already has migrations `001`–`038`. Use `ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS` followed by `CREATE TRIGGER`, `DROP POLICY IF EXISTS`, and guarded constraint creation through `pg_constraint`. Never wrap `CREATE POLICY` in a create-if-missing branch when its definition may need replacement; drop and recreate by exact name.

### New columns on `public.invoices`

```sql
sent_message_id text,
send_claim_id uuid,
send_claimed_to text,
send_claimed_at timestamptz,
send_claimed_by uuid references public.profiles(id) on delete set null,
voided_at timestamptz,
voided_by uuid references public.profiles(id) on delete set null,
void_reason text
```

Do not backfill provider IDs or void actors. Trigger logic must grandfather unchanged legacy states using `OLD` versus `NEW`, while enforcing evidence whenever status/evidence is newly changed after `041`.

### Shared actor helper

Create service-only:

```sql
public.require_invoice_actor(
  p_actor_id uuid,
  p_allowed_roles text[]
) returns text
```

Behavior: query `public.profiles` for `id = p_actor_id AND active IS TRUE`; reject null/missing/inactive/role-not-in-array with SQLSTATE `42501`; return the role. Use `SECURITY DEFINER SET search_path = ''`; schema-qualify all objects and builtins where practical. Revoke from `PUBLIC`, `anon`, and `authenticated`; grant only `service_role`.

### Draft parent and line RPCs

All are `SECURITY DEFINER SET search_path = ''`, service-role only, call `require_invoice_actor(..., ARRAY['owner','manager','office'])`, lock the parent with `FOR UPDATE`, reject non-draft or claimed invoices, use exact parent/line linkage predicates, and raise `P0002` on zero affected rows.

```sql
public.update_invoice_draft_meta(
  p_invoice_id uuid,
  p_due_date date,
  p_notes text,
  p_actor_id uuid
) returns uuid

public.add_invoice_draft_line(
  p_invoice_id uuid,
  p_category text,
  p_xactimate_code text,
  p_description text,
  p_quantity numeric,
  p_unit text,
  p_unit_price numeric,
  p_notes text,
  p_actor_id uuid
) returns uuid

public.update_invoice_draft_line(
  p_invoice_id uuid,
  p_line_item_id uuid,
  p_category text,
  p_xactimate_code text,
  p_description text,
  p_quantity numeric,
  p_unit text,
  p_unit_price numeric,
  p_notes text,
  p_actor_id uuid
) returns uuid

public.delete_invoice_draft_line(
  p_invoice_id uuid,
  p_line_item_id uuid,
  p_actor_id uuid
) returns uuid
```

Validation: trim required description/unit; require quantity `> 0`; require unit price `>= 0`; preserve numeric column bounds; compute add `sort_order` under the locked parent as `COALESCE(MAX(sort_order), -1) + 1`; never trust `jobId` from the client for mutation scope. The app may retain `jobId` only for revalidation after the RPC returns the canonical invoice/job linkage.

### Send claim/evidence RPCs

```sql
public.claim_invoice_send(
  p_invoice_id uuid,
  p_recipient text,
  p_actor_id uuid
) returns uuid

public.complete_invoice_send(
  p_invoice_id uuid,
  p_claim_id uuid,
  p_provider_message_id text,
  p_actor_id uuid
) returns text

public.release_invoice_send_claim(
  p_invoice_id uuid,
  p_claim_id uuid,
  p_actor_id uuid
) returns void
```

- `claim`: owner/manager/office; lock parent; require draft, no payments, at least one line, total due `> 0`, and valid trimmed recipient. If no claim, create `gen_random_uuid()` and store recipient/time/actor. If a claim exists for the same normalized recipient, return it. If recipient differs, raise `55000`.
- `complete`: owner/manager/office; lock parent; require matching claim and nonblank provider ID. If already sent with the same provider ID, return `sent` idempotently. Otherwise require draft and atomically set `status='sent'`, `sent_to=send_claimed_to`, `sent_at=clock_timestamp()`, `sent_message_id`, clear claim fields, and update `updated_at`.
- `release`: owner/manager/office; lock parent; clear only a matching claim on a draft. This function is called only after `sendEmail` returns an error. On timeout/unknown delivery, keep the claim and return an operational error instructing staff to verify Resend before release.
- Application delivery uses `idempotencyKey: invoice-send:${invoiceId}:${claimId}`. A process crash after provider acceptance but before completion safely retries the same provider request and then completes the same claim.

### Void RPC

```sql
public.void_invoice(
  p_invoice_id uuid,
  p_reason text,
  p_actor_id uuid
) returns text
```

Require active owner/manager, lock parent, idempotently return `void` only when already void with the same actor/reason semantics, reject paid/partial, any payment row, and any send claim, then set status/evidence atomically. Do not expose a browser-executable function.

### Existing payment RPC compatibility

1. `CREATE OR REPLACE public.record_payment_and_reconcile(uuid,numeric,text,text,date,text,uuid)` and add `require_invoice_actor(p_recorded_by, ARRAY['owner','manager','office'])`. Keep its exact signature and grant so the application call remains compatible during rollout.
2. Leave `public.process_stripe_payment(text,uuid,numeric,text,text)` service-only and actorless. Keep its event deduplication and invoice-row lock. Update only its status/evidence calculations so `paid` and `partial` satisfy the new trigger.
3. Add overload:

```sql
public.delete_payment_and_reconcile(
  p_payment_id uuid,
  p_invoice_id uuid,
  p_deleted_by uuid
) returns text
```

Require owner/manager and preserve the current invoice lock, exact payment linkage delete, total recomputation, and atomic parent update. When no payments remain, choose `sent` only if `sent_at`, nonblank `sent_to`, and nonblank `sent_message_id` are present; otherwise choose `draft`.
4. Keep the old two-argument delete function only through expand/application rollout. `042` revokes and drops `public.delete_payment_and_reconcile(uuid,uuid)` after the application has switched.
5. Do not change Stripe event keys, amount-positive constraint, overpayment rejection, or transaction boundaries.

### Trigger functions and exact trigger names

Create/replace:

```sql
public.enforce_invoice_lifecycle_evidence() returns trigger
public.require_editable_invoice_for_line_change() returns trigger
```

Exact triggers:

```sql
trg_enforce_invoice_lifecycle_evidence
  BEFORE INSERT OR UPDATE ON public.invoices

require_draft_invoice_for_line_change
  BEFORE INSERT OR UPDATE OR DELETE ON public.invoice_line_items
```

Reuse the existing line trigger name so replay replaces migration `032` behavior instead of stacking a second lock trigger. The line function locks both old and new parents on re-parent attempts, rejects re-parenting, requires draft, and rejects active send claims. The lifecycle trigger enforces the state/evidence rules in Section 1 and rejects changes away from `void`. It must not authorize by `auth.uid()` because approved mutations execute as service role; actor authorization belongs inside human RPCs.

### Final RLS policy names

`041` may add RPCs/triggers without removing policies. `042` must idempotently drop every known direct-write policy name:

```sql
DROP POLICY IF EXISTS "auth all invoices" ON public.invoices;
DROP POLICY IF EXISTS "auth write invoices" ON public.invoices;
DROP POLICY IF EXISTS "auth update invoices" ON public.invoices;
DROP POLICY IF EXISTS "backoffice access invoices" ON public.invoices;
DROP POLICY IF EXISTS "backoffice insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "backoffice update invoices" ON public.invoices;
DROP POLICY IF EXISTS "owner_mgr delete invoices" ON public.invoices;
DROP POLICY IF EXISTS "auth all invoice lines" ON public.invoice_line_items;
DROP POLICY IF EXISTS "backoffice access invoice lines" ON public.invoice_line_items;
```

Drop/recreate exact read policies:

```sql
CREATE POLICY "backoffice read invoices"
ON public.invoices FOR SELECT TO authenticated
USING (public.current_user_role() IN ('owner','manager','office'));

CREATE POLICY "backoffice read invoice lines"
ON public.invoice_line_items FOR SELECT TO authenticated
USING (
  public.current_user_role() IN ('owner','manager','office')
  AND EXISTS (
    SELECT 1 FROM public.invoices i WHERE i.id = invoice_id
  )
);
```

There must be no authenticated INSERT, UPDATE, or DELETE policy on either table after `042`. Do not add service-role policies; service role bypasses RLS and is limited by server-only credentials plus RPC grants.

## 3. Task 1 — Write RED static migration/application contract tests

**Files:**
- Create: `tests/unit/invoice-lifecycle-rbac.test.ts`
- Test references (read-only): `tests/unit/security-migration.test.ts`, `tests/unit/rls-storage-token-migration.test.ts`, `tests/unit/stripe-webhook.test.ts`, `tests/unit/manual-invoice-flow.test.ts`, `tests/unit/permissions.test.ts`

**Steps:**
1. Assert `041` defines all exact signatures, locks parent rows, checks active actor roles, validates claim/evidence, reuses `require_draft_invoice_for_line_change`, grants only service role, and preserves `process_stripe_payment` plus `record_payment_and_reconcile` signatures.
2. Assert `042` drops every policy listed above, creates only the two exact read policies, drops the old two-argument delete RPC, and does not create any direct invoice/line write policy.
3. Parse individual function bodies with statement-bounded regex (`[^;]+`) so comments/later functions cannot satisfy mutation assertions.
4. Assert `app/actions/invoices.ts` contains calls to the new RPCs and no `.from("invoices").update`, `.from("invoice_line_items").insert/update/delete`, or old two-argument payment-delete call.
5. Assert send order is `claim_invoice_send` → `sendEmail` with the exact idempotency key → `complete_invoice_send`, and release occurs only on confirmed provider error.
6. Run RED:

```bash
npm test -- tests/unit/invoice-lifecycle-rbac.test.ts
```

Expected: FAIL because `041`, `042`, and application RPC calls do not yet exist.

## 4. Task 2 — Implement migration 041 expand objects and lifecycle invariants

**Files:**
- Create: `supabase/migrations/041_invoice_lifecycle_rbac_expand.sql`
- Modify only after tests are red: `tests/unit/invoice-lifecycle-rbac.test.ts`

**Steps:**
1. Add nullable evidence/claim columns without table rewrite/backfill.
2. Add the service-only actor helper and all draft/send/void RPCs with exact revokes/grants.
3. Replace the line trigger function under the existing trigger name.
4. Add the lifecycle evidence trigger with legacy-row grandfathering.
5. Replace the manual payment function body with active back-office actor validation.
6. Add the three-argument delete payment overload; retain the old function temporarily.
7. Update Stripe/manual/delete reconciliation status calculations while preserving row locks and idempotency.
8. Run:

```bash
npm test -- tests/unit/invoice-lifecycle-rbac.test.ts tests/unit/stripe-webhook.test.ts tests/unit/manual-invoice-flow.test.ts tests/unit/reliability-hardening.test.ts
```

Expected: migration assertions PASS; application-switch assertions remain RED until Task 4.

## 5. Task 3 — Add migrated-database pgTAP role/concurrency tests

**Files:**
- Create: `supabase/tests/invoice_lifecycle_rbac.test.sql`
- Create if needed: `supabase/config.toml` only if the repository intentionally adopts checked-in local Supabase configuration; otherwise use the team-standard project config supplied externally.

**Fixture discipline:** Run only against `supabase start` local containers or an approved disposable preview project. Create UUID-fixed profiles for owner, manager, office, technician, inactive owner, and unknown actor; create isolated jobs/invoices/lines/payments inside a transaction and roll back. Use `SET LOCAL ROLE authenticated` plus request JWT claims for RLS probes; use `SET LOCAL ROLE service_role` for service RPC probes.

**Required matrix assertions:**

1. owner/manager/office can read parent/lines; technician/anon/inactive cannot.
2. After `042`, authenticated owner/manager/office direct parent/line INSERT/UPDATE/DELETE affect zero rows or raise RLS denial.
3. Draft meta and all three line RPCs allow owner/manager/office and reject technician/inactive/unknown/null actor.
4. Line ID from another invoice cannot be updated/deleted even when caller supplies a valid target invoice.
5. Draft RPCs reject sent/paid/void and claimed invoices.
6. Send claim is stable for same recipient, conflicts for another recipient, freezes draft edits, rejects empty/zero-total invoices, and completion rejects wrong claim/blank provider ID.
7. New sent transition without recipient/time/provider evidence fails; valid completion succeeds and persists all evidence.
8. Legacy sent fixture created before enabling the trigger remains readable/updatable in unrelated fields only if its status/evidence are unchanged; it cannot be moved through a new evidence-requiring transition without evidence.
9. Manual payment allows owner/manager/office, rejects tech/inactive, rejects void and overpayment, and reaches partial/paid with payment evidence.
10. Stripe event replay remains one payment and returns `already_processed=true`.
11. Payment delete allows owner/manager only; office is rejected. Reconciliation returns to sent only with send evidence, otherwise draft.
12. Void allows owner/manager only, rejects office/tech/inactive, rejects invoices with payments or claims, records actor/time/reason, and is terminal.
13. Concurrent sessions:
    - two claims on the same invoice serialize on parent lock and return one claim for same recipient;
    - different recipients produce one winner and one conflict;
    - payment plus void serialize, with void failing once payment exists;
    - concurrent manual payments cannot exceed balance;
    - line edit cannot commit after a send claim wins the parent lock.

For concurrency, add a SQL helper using `dblink` if available in local Supabase, or a Node integration harness under `tests/integration/invoice-lifecycle-concurrency.test.ts` using two Postgres connections. Do not fake concurrency with sequential statements.

**Commands:**

```bash
supabase start
supabase db reset
supabase test db supabase/tests/invoice_lifecycle_rbac.test.sql
```

Expected: `db reset` applies `001`–`041`; pgTAP passes expand-phase assertions. Run again after `042` for final direct-write denial assertions.

## 6. Task 4 — Switch server actions to narrow RPCs

**Files:**
- Modify: `app/actions/invoices.ts`
- Modify: `app/(dashboard)/jobs/[id]/invoices/[invoiceId]/InvoiceActions.tsx`
- Test: `tests/unit/invoice-lifecycle-rbac.test.ts`
- Modify mocks as needed: `tests/unit/stripe-webhook.test.ts`

**Steps:**
1. Keep every existing `requirePermission` call. Pass `auth.user.id`/`user.id` as `p_actor_id`; do not trust an actor ID from FormData.
2. Replace parent metadata UPDATE with `update_invoice_draft_meta`.
3. Replace line INSERT/UPDATE/DELETE with the exact line RPCs. Stop calculating `sort_order` in JavaScript.
4. For every action, load or return canonical `job_id` from the RPC/database before revalidation; reject a caller-supplied mismatched `jobId` instead of using it as authorization scope.
5. Change `sendInvoice`:
   - claim first;
   - load immutable claimed invoice context;
   - call `sendEmail` with `idempotencyKey: \`invoice-send:${invoiceId}:${claimId}\``;
   - require `data?.id` as provider evidence;
   - complete the matching claim;
   - release only on a definitive Resend error; preserve the claim on timeout/unknown outcome;
   - write the audit log only after completion.
6. Change `deletePayment` to call the three-argument overload with `p_deleted_by: auth.user.id`.
7. Change `voidInvoice` to require a reason, call `void_invoice`, and pass actor. Update the client to collect a nonblank reason rather than a yes/no confirmation only.
8. Preserve `recordPayment` and Stripe webhook RPC names. Improve returned error messages for `42501`, `55000`, and evidence conflicts without exposing SQL internals.
9. Run GREEN:

```bash
npm test -- tests/unit/invoice-lifecycle-rbac.test.ts tests/unit/stripe-webhook.test.ts tests/unit/manual-invoice-flow.test.ts tests/unit/payment-routing.test.ts tests/unit/permissions.test.ts
npm run typecheck
```

Expected: all targeted tests and typecheck PASS.

## 7. Task 5 — Implement migration 042 contract and final RLS

**Files:**
- Create: `supabase/migrations/042_invoice_lifecycle_rbac_contract.sql`
- Test: `tests/unit/invoice-lifecycle-rbac.test.ts`
- Test: `supabase/tests/invoice_lifecycle_rbac.test.sql`

**Prerequisite:** Do not apply `042` until the deployed application version from Task 4 is healthy and no prior application instances call direct invoice writes or the old payment-delete signature.

**Steps:**
1. Drop every historical/broad policy name listed in Section 2.
2. Drop/recreate only `backoffice read invoices` and `backoffice read invoice lines` with `TO authenticated` and active-role-aware helper predicates.
3. Revoke and drop `public.delete_payment_and_reconcile(uuid,uuid)`.
4. Reassert revokes for every service-only invoice/payment RPC because function replacement resets neither all historical grants nor default PUBLIC execution assumptions safely enough to leave implicit.
5. Query `pg_policies` in a migration guard/verification block and raise if any INSERT/UPDATE/DELETE policy remains on `invoices` or `invoice_line_items`.
6. Reset local DB and run final role matrix:

```bash
supabase db reset
supabase test db supabase/tests/invoice_lifecycle_rbac.test.sql
npm test -- tests/unit/invoice-lifecycle-rbac.test.ts tests/unit/rls-storage-token-migration.test.ts tests/unit/reliability-hardening.test.ts
```

Expected: no direct write policies, all role/RPC tests PASS.

## 8. Task 6 — Full local verification

Run without truncating/piping output:

```bash
npm test
npm run typecheck
npm run build
supabase db reset
supabase test db
```

Then inspect migration state and grants on the local migrated DB:

```bash
supabase migration list --local
supabase db lint --local --level warning
```

Acceptance:

- all tests, typecheck, build, reset, pgTAP, and DB lint pass;
- migration replay from empty applies exactly once and a second `supabase db reset` also passes;
- static tests prove no direct parent/line mutations remain in `app/actions/invoices.ts`;
- direct authenticated role probes deny writes for every role;
- payment webhook replay and concurrent balance tests remain green;
- no source/migration outside the paths named in this plan changes incidentally.

## 9. Production rollout and verification gates

### Gate A — External approvals and preflight (read-only)

Required before any hosted DB action:

1. Security owner confirms the canonical SEC-02 text matches this plan.
2. Product/finance owner explicitly approves: office cannot void/delete payments; invoices with any payment cannot be voided; payment deletion may return an unsent invoice to draft.
3. Operations owner approves stale-send-claim recovery procedure and confirms Resend idempotency/provider-ID behavior in the configured account.
4. Database owner confirms a recent restorable backup and successful restore drill.
5. Read-only production inventory:

```sql
select status, count(*) from public.invoices group by status order by status;
select count(*) filter (where status in ('sent','overdue') and (sent_at is null or nullif(btrim(sent_to),'') is null)) as legacy_sent_without_metadata,
       count(*) filter (where status='paid' and paid_at is null) as paid_without_paid_at,
       count(*) filter (where status='void') as legacy_void
from public.invoices;
select count(*) from public.invoices i where i.status='paid' and
  coalesce((select sum(p.amount) from public.payments p where p.invoice_id=i.id),0) <
  coalesce((select sum(li.line_total) from public.invoice_line_items li where li.invoice_id=i.id),0);
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname='public' and tablename in ('invoices','invoice_line_items','payments')
order by tablename, policyname;
```

Any paid invoice without payment evidence is a stop-the-line reconciliation issue; do not auto-fix it in the migration.

### Gate B — Preview/staging expand

1. Apply `041` only to preview/staging using the repository’s approved migration pipeline (not ad-hoc SQL paste).
2. Deploy the application switch.
3. Exercise owner/manager/office/technician matrix, send failure/retry, manual partial/full payment, delete reconciliation, void rejection, and Stripe replay.
4. Observe at least one complete send claim with persisted provider ID and no duplicate email.
5. Confirm old application version still functions during `041` expand window.

### Gate C — Production expand/application

1. Apply `041` in a low-traffic window.
2. Verify columns, triggers, function definitions/checksums, grants, and migration ledger.
3. Deploy the application immediately; retain rollback to the pre-switch application while old signatures/policies still exist.
4. Smoke-test with a designated test job/invoice only. Do not send customer email; use an approved internal recipient and clearly marked test invoice.
5. Observe logs for SQLSTATE `42501`, `55000`, claim conflicts, payment errors, and provider errors. Stop if unexplained.

### Gate D — Contract

After all old application instances are drained and at least one successful human path plus Stripe replay is verified:

1. Apply `042`.
2. Run read-only policy/grant probes and authenticated role matrix probes.
3. Confirm no INSERT/UPDATE/DELETE policy exists on invoice parents/lines.
4. Confirm the two-argument delete payment function no longer exists.
5. Repeat owner draft edit/send, office draft edit/send/manual payment, manager payment delete/void, technician denial, and Stripe replay.

### Gate E — Post-deploy monitoring and rollback

- Monitor for one full billing cycle or at least 24 hours, whichever is longer: failed claims, stuck claims, duplicate provider IDs, payment reconciliation errors, and RLS denials.
- Application rollback is safe between `041` and `042`. After `042`, rollback requires the new application or an explicit forward-fix migration; do **not** recreate broad write policies as an emergency shortcut.
- Database rollback is forward-only: disable/fix new functions with a new migration. Never remove evidence columns or rewrite historical state during incident response.

## 10. Implementation completion checklist

- [ ] Canonical SEC-02 wording reviewed.
- [ ] Finance decisions on void/payment semantics approved.
- [ ] Static tests observed RED before SQL/application implementation.
- [ ] `041` is idempotent and locally replayed.
- [ ] pgTAP role matrix and real concurrency tests pass.
- [ ] Application uses only narrow mutation RPCs.
- [ ] Resend claim/idempotency/provider evidence path is tested.
- [ ] Existing manual and Stripe payment transaction tests pass.
- [ ] `042` removes all direct parent/line writes and old delete signature.
- [ ] Full test/typecheck/build/DB reset/lint pass.
- [ ] Backup/restore, preview, production expand, and production contract gates approved and recorded.
