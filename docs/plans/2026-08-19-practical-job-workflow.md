# Practical Job Workflow Simplification Plan

> **For Hermes:** Execute task-by-task with TDD and independent final review.

**Goal:** Make New Job and Job Detail practical for live restoration work without deleting capabilities or changing production data.

**Architecture:** Preserve existing actions, database fields, components, and direct routes. Change only information hierarchy: essential intake first, optional administration collapsed, phase-relevant job sections opened, and advanced tools placed in one closed section.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind, Supabase, Vitest.

---

### Task 1: Lock the intended workflow with failing tests

**Files:**
- Create: `tests/unit/practical-job-workflow.test.ts`

**Acceptance:**
- Essential intake appears before optional payment/referral fields.
- Optional administration uses one native `details` disclosure.
- Job Detail has four plain-language sections: Job setup, Field work, Billing & paperwork, More & history.
- Setup opens for lead/inspection; field work opens only for mitigation/drying/reconstruction.
- Advanced P&L, portals, notifications, automation, and timeline live in More & history.
- Primary checklist contains no Argus or Esquire terminology.

**Verification:** Run the new test and observe failure before production edits.

### Task 2: Simplify New Job

**Files:**
- Modify: `app/(dashboard)/jobs/new/NewJobForm.tsx`

**Acceptance:**
- One primary card asks for customer, contact, loss address, damage type, and description.
- Phone/email requirement is explained before submit.
- Payment, insurance, referral, and test-job controls remain available inside one closed optional section.
- Existing form field names and server action contract remain unchanged.

**Verification:** New targeted test passes; existing reliability and UX tests pass.

### Task 3: Reorganize Job Detail

**Files:**
- Modify: `app/(dashboard)/jobs/[id]/page.tsx`
- Modify: `app/(dashboard)/jobs/[id]/JobChecklist.tsx`

**Acceptance:**
- Header, one-tap actions, phase rail, and checklist remain.
- Job setup contains editable job/customer details and scheduling/crew.
- Field work contains photos/scope, moisture, and equipment.
- Billing & paperwork contains amount/invoices and documents.
- P&L/costs, subcontractors, payment-route controls, portals, notifications, notes, and timeline remain available but collapsed under More & history.
- No database migration or record mutation is introduced.

**Verification:** Targeted test, full tests, typecheck, and production build pass.

### Task 4: Independent review

Review the diff for lost capabilities, broken anchors, authorization changes, financial behavior changes, incorrect default-open states, and mobile usability. Fix blockers, rerun verification, and leave changes uncommitted for user approval.
