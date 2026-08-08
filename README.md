# First Call OS

Operations system for First Call Mitigation. The application connects intake, customers, mitigation jobs, field documentation, equipment, estimates, invoices, payments, collections, partner referrals, and supervised AI workflows.

## Stack

- Next.js 16 / React 19 / TypeScript
- Supabase Auth, Postgres, RLS, and private Storage
- Stripe Checkout and signed webhooks
- Anthropic or Vercel AI Gateway
- Deepgram transcription, ElevenLabs voice, and Resend email
- Vitest and Playwright
- Vercel deployment and cron

## Local setup

```bash
npm ci
cp .env.example .env.local # if the example file is present; otherwise create .env.local
npm run dev
```

Required core variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
CRON_SECRET
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

Feature variables:

```text
ANTHROPIC_API_KEY
AI_GATEWAY_API_KEY
AI_GATEWAY_ENABLED
AI_DAILY_SPEND_CAP_USD
AI_KILL_SWITCH_OFF
ECHO_DAILY_CAP_USD
DEEPGRAM_API_KEY
ELEVENLABS_API_KEY
ELEVENLABS_VOICE_ID
RESEND_API_KEY
RESEND_FROM
OPERATOR_EMAIL
GOOGLE_REVIEW_URL
DATA_CUTOFF
```

Never expose `SUPABASE_SERVICE_ROLE_KEY`, Stripe secrets, cron secrets, or provider API keys through `NEXT_PUBLIC_*` variables.

## Database and migrations

Migrations are under `supabase/migrations/` and must remain idempotent. Apply them in numeric order using the Supabase CLI or a database connection with DDL permission.

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

The service-role key cannot execute DDL through PostgREST. Do not mark a migration complete merely because application queries work.

After schema changes, regenerate and commit database types:

```bash
supabase gen types typescript --linked > lib/database.types.ts
```

RLS is part of the security boundary. Server-action checks do not replace database policies, because authenticated clients can call Supabase directly.

## Verification

```bash
npm run typecheck
npm test
npm run build
npm audit --omit=dev
npm run test:e2e
```

Playwright defaults to the production deployment. Override it for a preview or local server:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e
```

## Stripe

Configure Stripe to send signed events to:

```text
/api/stripe/webhook
```

Payment processing is required to be idempotent. Never remove the unique Stripe event/reference constraints or replace transactional payment reconciliation with separate best-effort writes.

## Cron

Vercel schedules are declared in `vercel.json`. Every cron endpoint requires:

```text
Authorization: Bearer <CRON_SECRET>
```

Cron routes deliberately fail closed when `CRON_SECRET` is absent. A `503` means deployment configuration is incomplete; do not weaken this behavior.

## Backups and recovery

Logical backups are written to the private `backups` Storage bucket. They supplement—not replace—Supabase point-in-time recovery.

Backups:

- page every required table,
- fail if any table cannot be read,
- record row counts and SHA-256 checksums,
- use a versioned payload envelope.

Quarterly recovery procedure:

1. Run a manual backup from owner/manager settings.
2. Use Verify to check payload counts.
3. Download the latest backup as an owner.
4. Restore into a disposable Supabase project.
5. Compare row counts and inspect representative jobs, payments, documents, and audit entries.
6. Record the drill date and outcome outside the production database.

## Security model

Roles are `owner`, `manager`, `office`, and `technician`.

- Server Functions are directly reachable POST surfaces and must authenticate internally.
- Admin/service-role operations must authenticate and authorize before creating the client.
- Inactive profiles are denied.
- Profile self-service must never permit changes to `role` or `active`.
- Public customer, adjuster, and signer links are bearer credentials. Keep them scoped, expiring, revocable, and out of logs.
- Do not place raw deleted PII in audit metadata.

## Deployment

`main` deploys to Vercel. Before merging:

1. Apply and verify migrations in a preview/staging database.
2. Run the full verification commands.
3. Confirm all required Vercel environment variables.
4. Exercise login, role restrictions, intake, upload, estimate, invoice, payment, portal, and cron rejection paths.
5. Confirm Stripe webhook delivery and no duplicate payment on replay.

## Incident response

If access or payment integrity is questioned:

1. Disable the affected Supabase account and revoke sessions.
2. Rotate exposed provider, Stripe, cron, and service-role secrets.
3. Inspect `audit_logs`, Stripe event delivery, and Vercel request logs.
4. Pause AI/provider calls using the configured kill switch.
5. Preserve evidence before correcting records.
6. Restore only after validating backup scope and timestamps.
