-- ================================================================
-- FirstCall OS — FRESH START
-- ================================================================
-- One-shot script: wipes ALL test/operational data and seeds ONE
-- reference job ("EXAMPLE — Maria Garcia") so you can see what a
-- complete end-to-end job looks like.
--
-- Run this MANUALLY in Supabase SQL Editor:
--   1. Open Supabase dashboard → SQL Editor → New query
--   2. Paste this entire file → Run
--   3. The verification SELECT at the bottom shows row counts
--
-- KEEPS:
--   • profiles (your user accounts)
--   • equipment (your real fleet — only deployments are wiped)
--   • cost_basis_settings, secrets_rotation_log, backups_log,
--     audit_logs (login history etc.)
--
-- WIPES:
--   • jobs and everything attached (photos, videos, notes,
--     estimates, invoices, payments, moisture readings, legal
--     docs, equipment assignments, sub invoices, etc.)
--   • customers, calls, partners, outreach, subcontractors,
--     vehicle_expenses
--   • agent_invocations, agent_outcomes, echo_conversations,
--     pending_approvals, solomon_reports
--   • All objects in job-photos and job-documents storage buckets
--
-- THIS IS DESTRUCTIVE AND IRREVERSIBLE. Take a backup first via
-- /settings/backups → "Trigger Backup Now" before running.
-- ================================================================

begin;

-- ── 1. WIPE STORAGE OBJECTS ────────────────────────────────────
delete from storage.objects
where bucket_id in ('job-photos', 'job-documents');

-- ── 2. TRUNCATE TRANSACTIONAL TABLES ───────────────────────────
-- CASCADE handles any FK paths we forgot. RESTART IDENTITY resets
-- any serial sequences (most tables use UUIDs so this is a no-op
-- for them, but harmless).
truncate table
  public.payments,
  public.invoice_reminders,
  public.invoice_line_items,
  public.invoices,
  public.estimate_line_items,
  public.estimates,
  public.legal_documents,
  public.moisture_readings,
  public.equipment_assignments,
  public.job_assignments,
  public.job_notes,
  public.job_documents,
  public.job_photos,
  public.job_videos,
  public.customer_notifications,
  public.tech_labor_entries,
  public.consumables_used,
  public.sub_invoices,
  public.subcontractors,
  public.vehicle_expenses,
  public.pending_approvals,
  public.calls,
  public.jobs,
  public.customers,
  public.outreach_messages,
  public.outreach_leads,
  public.partner_payouts,
  public.partner_investments,
  public.partners,
  public.agent_invocations,
  public.agent_outcomes,
  public.echo_conversations,
  public.solomon_reports
restart identity cascade;

-- ── 3. RESET JOB NUMBER SEQUENCE ───────────────────────────────
alter sequence if exists public.job_number_seq restart with 1;

-- ── 4. SEED REFERENCE JOB ──────────────────────────────────────
-- Wrapped in a DO block so we can use UUID variables across the
-- whole insert chain. Everything is prefixed "EXAMPLE — " so you
-- can recognize and delete it once you've taken your first real
-- call.

do $$
declare
  v_partner_id  uuid := gen_random_uuid();
  v_customer_id uuid := gen_random_uuid();
  v_job_id      uuid := gen_random_uuid();
  v_estimate_id uuid := gen_random_uuid();
  v_invoice_id  uuid := gen_random_uuid();
  v_aob_id      uuid := gen_random_uuid();
  v_workauth_id uuid := gen_random_uuid();
  v_drycert_id  uuid := gen_random_uuid();
  v_call_id     uuid := gen_random_uuid();
begin
  -- Reference referral partner
  insert into public.partners (id, name, company, phone, email, notes, active)
  values (
    v_partner_id,
    'EXAMPLE — Tony Reyes',
    'Reyes Plumbing & Drain',
    '(512) 555-0117',
    'tony@reyesplumbing.example',
    'Reference partner — sample plumber referral relationship.',
    true
  );

  -- Reference customer
  insert into public.customers (
    id, name, email, phone, address, city, state, zip,
    insurance_company, insurance_policy_number, insurance_claim_number, notes
  ) values (
    v_customer_id,
    'EXAMPLE — Maria Garcia',
    'maria.garcia@example.com',
    '(512) 555-0142',
    '5800 Manchaca Rd, Apt 12',
    'Austin', 'TX', '78745',
    'State Farm',
    'POL-EX-98765',
    'CLM-EX-12345',
    'Reference customer — kitchen supply line burst overnight, Tony from Reyes Plumbing referred us.'
  );

  -- Reference job: insurance route, completed
  insert into public.jobs (
    id, customer_id, status, type, description,
    site_address, site_city, site_state, site_zip,
    scheduled_at, completed_at, estimated_value,
    payment_route, dispatch_inputs,
    customer_share_token, adjuster_share_token,
    referred_by_id,
    scope_assessment, scope_analyzed_at
  ) values (
    v_job_id,
    v_customer_id,
    'completed',
    'water',
    'Reference job — overnight supply line burst flooded kitchen + dining room. Cat 1 / Class 2.',
    '5800 Manchaca Rd, Apt 12', 'Austin', 'TX', '78745',
    now() - interval '6 days',
    now() - interval '1 day',
    8500,
    'insurance_primary',
    jsonb_build_object(
      'ceiling_height_ft', 9,
      'property_type', 'residential',
      'year_built', '1998',
      'stories', 1,
      'water_source_secured', true,
      'access_notes', 'Gate code 4422, dog (friendly) on premises.'
    ),
    'EXAMPLE-customer-' || encode(gen_random_bytes(12), 'hex'),
    'EXAMPLE-adjuster-' || encode(gen_random_bytes(12), 'hex'),
    v_partner_id,
    jsonb_build_object(
      'water_category', '1',
      'water_class', '2',
      'affected_areas', jsonb_build_array(
        jsonb_build_object(
          'location', 'Kitchen floor + lower cabinets',
          'materials', jsonb_build_array('tile','subfloor','baseboards','cabinetry'),
          'estimated_sqft', 180,
          'severity', 'moderate',
          'notes', 'Standing water under fridge + dishwasher; baseboards wicked moisture 4-6 inches up.'
        ),
        jsonb_build_object(
          'location', 'Dining room hardwood',
          'materials', jsonb_build_array('hardwood','baseboards'),
          'estimated_sqft', 110,
          'severity', 'minor',
          'notes', 'Migration from kitchen — surface only, caught early.'
        )
      ),
      'equipment_needed', jsonb_build_object(
        'lgr_dehumidifiers', 1,
        'conventional_dehumidifiers', 0,
        'air_movers', 4,
        'air_scrubbers', 0,
        'other', jsonb_build_array('extraction wand','moisture meter')
      ),
      'safety_concerns', jsonb_build_array(
        'Slip hazard on tile',
        'Watch for under-cabinet electrical near dishwasher'
      ),
      'ppe_required', jsonb_build_array('rubber boots','nitrile gloves'),
      'estimated_dry_days', 4,
      'mitigation_steps', jsonb_build_array(
        'Extract standing water in kitchen',
        'Pull baseboards along affected walls',
        'Cut & remove wet drywall 12" up where wicking visible',
        'Drill cabinet kicks for airflow',
        'Apply antimicrobial to all exposed substrate',
        'Set drying configuration: 1 LGR + 4 air movers across kitchen + dining'
      ),
      'containment_plan', jsonb_build_array(
        jsonb_build_object(
          'area','Kitchen-to-living-room doorway',
          'type','partial_barrier',
          'reason','Keep negative pressure / dust contained during demo'
        )
      ),
      'tech_playbook', jsonb_build_array(
        'Don PPE before entering — boots + gloves',
        'Walk perimeter with moisture meter, mark wet zones with painters tape',
        'Extract standing water first (extraction wand)',
        'Pull baseboards on wet walls — bag and tag for disposal',
        'Cut drywall 12" up where wicking confirmed (>16% MC)',
        'Drill 1" cabinet kick holes every 18" for airflow',
        'Spray Concrobium on all exposed substrate; let flash 10 min',
        'Stage LGR1 in kitchen, point air movers to chase moisture toward LGR',
        'Install partial poly barrier at living room doorway',
        'Take baseline moisture readings before leaving site'
      ),
      'summary', 'Cat 1 Class 2 kitchen + dining flood from supply line. Caught quickly — likely 4 days to dry standard. Standard demo on baseboards and 12 inches of drywall, no full cabinet replacement needed.',
      'confidence', 'high',
      'additional_photos_needed', 'A few close-ups under the sink trap and behind the dishwasher would tighten the equipment count.'
    ),
    now() - interval '5 days 22 hours'
  );

  -- Reference call (Athena intake)
  insert into public.calls (
    id, customer_id, job_id, direction, duration_seconds,
    from_number, to_number, transcript, ai_summary
  ) values (
    v_call_id, v_customer_id, v_job_id, 'inbound', 187,
    '+15125550142', '+15125559999',
    E'Customer: Hi, I think my kitchen is flooded. I woke up and there is water everywhere. The line under the sink burst sometime overnight.\n' ||
    E'Operator: Okay, deep breath. Where in Austin are you?\n' ||
    E'Customer: Manchaca Rd, near Stassney. Apartment 12.\n' ||
    E'Operator: Got it. Have you shut off the water?\n' ||
    E'Customer: Yes, I turned off the valve under the sink and the main.\n' ||
    E'Operator: Perfect. Insurance — do you know who you are with?\n' ||
    E'Customer: State Farm. I have the policy number somewhere…\n' ||
    E'Operator: No worries, we can get that later. Tony Reyes referred you?\n' ||
    E'Customer: Yes, he is the one who told me to call.',
    'Cat 1 supply-line burst overnight. Customer secured water source. State Farm policy. Referred by Tony Reyes (Reyes Plumbing). Wants ASAP response.'
  );

  -- Notes / activity timeline
  insert into public.job_notes (job_id, type, content, metadata) values
    (v_job_id, 'call_transcript', 'Initial intake call with Maria Garcia. See call recording for full transcript.', jsonb_build_object('call_id', v_call_id)),
    (v_job_id, 'note',           'Tech arrived 47 min after intake. Source confirmed secured. Photos uploaded.', '{}'::jsonb),
    (v_job_id, 'ai_summary',     'Argus scope completed: Cat 1 Class 2, 290 sqft affected, 1 LGR + 4 air movers, est. 4 days dry.', '{}'::jsonb);

  -- Approved estimate
  insert into public.estimates (id, job_id, version, status, notes, approved_at)
  values (v_estimate_id, v_job_id, 1, 'approved',
          'Approved by Maria Garcia via portal e-sign.',
          now() - interval '5 days');

  insert into public.estimate_line_items (estimate_id, sort_order, category, xactimate_code, description, quantity, unit, unit_price, is_ai_drafted)
  values
    (v_estimate_id, 1, 'Water Extraction',  'WTR EXTRC',  'Water extraction — Cat 1, standing water', 290, 'SF', 0.85, true),
    (v_estimate_id, 2, 'Demolition',        'DMO BB',     'Detach + dispose baseboard',                64,  'LF', 1.95, true),
    (v_estimate_id, 3, 'Demolition',        'DMO DRYW',   'R&R drywall — 12" cuts, painted side',      48,  'LF', 7.25, true),
    (v_estimate_id, 4, 'Antimicrobial',     'WTR ANTM',   'Apply antimicrobial agent',                 290, 'SF', 0.55, true),
    (v_estimate_id, 5, 'Equipment',         'WTR DEH LG', 'LGR dehumidifier — per day',                4,   'DA', 95.00, true),
    (v_estimate_id, 6, 'Equipment',         'WTR AIR MV', 'Air mover — per day',                       16,  'DA', 28.00, true),
    (v_estimate_id, 7, 'Labor',             'LBR TECH',   'Technician hours on site',                  18,  'HR', 85.00, true),
    (v_estimate_id, 8, 'Materials',         'MAT POLY',   'Containment poly + zipper door',            1,   'EA', 78.00, true);

  -- Paid invoice (mirrors estimate)
  insert into public.invoices (id, job_id, estimate_id, invoice_number, status, issue_date, due_date, sent_to, sent_at, paid_at)
  values (
    v_invoice_id, v_job_id, v_estimate_id,
    'INV-EXAMPLE-0001',
    'paid',
    (now() - interval '1 day')::date,
    (now() + interval '29 days')::date,
    'maria.garcia@example.com',
    now() - interval '1 day',
    now() - interval '4 hours'
  );

  insert into public.invoice_line_items (invoice_id, sort_order, category, xactimate_code, description, quantity, unit, unit_price)
  select v_invoice_id, sort_order, category, xactimate_code, description, quantity, unit, unit_price
  from public.estimate_line_items
  where estimate_id = v_estimate_id;

  -- Payment received in full
  insert into public.payments (invoice_id, amount, method, reference, received_at, notes)
  values (
    v_invoice_id,
    (select sum(line_total) from public.invoice_line_items where invoice_id = v_invoice_id),
    'ach',
    'STATEFARM-EX-0001',
    (now() - interval '4 hours')::date,
    'Reference payment — State Farm direct deposit.'
  );

  -- Moisture readings — 4-day drying progression
  insert into public.moisture_readings (job_id, reading_date, room, location_detail, material, moisture_pct, rh_pct, temp_f, gpp, is_dry_standard, notes) values
    (v_job_id, (now() - interval '5 days')::date, 'Kitchen',     'Wall behind sink, 6" up',     'drywall',       42.5, 68.0, 76.0, 117.0, false, 'Baseline — saturated.'),
    (v_job_id, (now() - interval '5 days')::date, 'Kitchen',     'Subfloor at fridge cutout',   'wood_subfloor', 38.1, 68.0, 76.0, 117.0, false, 'Baseline — high.'),
    (v_job_id, (now() - interval '4 days')::date, 'Kitchen',     'Wall behind sink, 6" up',     'drywall',       29.0, 56.0, 80.0, 84.0,  false, 'Day 1 — improving.'),
    (v_job_id, (now() - interval '3 days')::date, 'Kitchen',     'Wall behind sink, 6" up',     'drywall',       19.5, 48.0, 81.0, 70.0,  false, 'Day 2 — on track.'),
    (v_job_id, (now() - interval '3 days')::date, 'Dining Room', 'Hardwood east wall',          'hardwood',      14.0, 48.0, 81.0, 70.0,  false, 'Day 2 — close to dry standard.'),
    (v_job_id, (now() - interval '2 days')::date, 'Kitchen',     'Wall behind sink, 6" up',     'drywall',       12.0, 42.0, 80.0, 58.0,  true,  'Day 3 — at dry standard.'),
    (v_job_id, (now() - interval '2 days')::date, 'Dining Room', 'Hardwood east wall',          'hardwood',      9.5,  42.0, 80.0, 58.0,  true,  'Day 3 — at dry standard.'),
    (v_job_id, (now() - interval '1 day' )::date, 'Kitchen',     'Wall behind sink, 6" up',     'drywall',       11.0, 40.0, 79.0, 54.0,  true,  'Day 4 — confirmed dry, equipment removed.');

  -- Esquire legal docs (AOB signed, Work Auth signed, Drying Cert generated)
  insert into public.legal_documents (id, job_id, doc_type, subject, body, status, approved_at, sent_at, signed_at, signed_by_name) values
    (
      v_aob_id, v_job_id, 'aob',
      'Assignment of Benefits — Garcia residence',
      E'ASSIGNMENT OF BENEFITS\n\n' ||
      E'I, Maria Garcia, owner/insured of 5800 Manchaca Rd Apt 12, Austin TX 78745, hereby assign all insurance benefits applicable to the loss occurring on or about this date to First Call Mitigation. This authorization permits the contractor to communicate directly with State Farm regarding claim CLM-EX-12345, receive payment directly, and represent my interests in the resolution of the claim.\n\n' ||
      E'[This is a reference / example document.]',
      'signed',
      now() - interval '5 days 20 hours',
      now() - interval '5 days 20 hours',
      now() - interval '5 days 19 hours',
      'Maria Garcia'
    ),
    (
      v_workauth_id, v_job_id, 'work_authorization',
      'Work Authorization — Garcia residence',
      E'WORK AUTHORIZATION\n\n' ||
      E'The undersigned authorizes First Call Mitigation to perform emergency mitigation services at 5800 Manchaca Rd Apt 12, Austin TX 78745, including water extraction, controlled demolition, antimicrobial application, and structural drying as outlined in the IICRC S500-compliant scope of work.\n\n' ||
      E'[This is a reference / example document.]',
      'signed',
      now() - interval '5 days 20 hours',
      now() - interval '5 days 20 hours',
      now() - interval '5 days 19 hours',
      'Maria Garcia'
    ),
    (
      v_drycert_id, v_job_id, 'drying_certificate',
      'Certificate of Drying — Garcia residence',
      E'CERTIFICATE OF DRYING\n\n' ||
      E'This certifies that all affected structural materials at 5800 Manchaca Rd Apt 12, Austin TX 78745 have been returned to dry standard per IICRC S500. Final readings recorded on day 4 confirm moisture content of 11.0% (drywall) and 9.5% (hardwood), both within unaffected baseline.\n\n' ||
      E'Equipment retrieved. Property released to owner.\n\n' ||
      E'[This is a reference / example document.]',
      'approved',
      now() - interval '1 day',
      null, null, null
    );

  -- Customer-facing notification log
  insert into public.customer_notifications (job_id, event_type, sent_to, subject, sent_at) values
    (v_job_id, 'job_started',         'maria.garcia@example.com', 'Your First Call team is on the way',  now() - interval '5 days 22 hours'),
    (v_job_id, 'mitigation_complete', 'maria.garcia@example.com', 'Mitigation complete — Garcia residence', now() - interval '1 day');

  raise notice 'Seeded reference job for customer % (job %)', v_customer_id, v_job_id;
end $$;

commit;

-- ── 5. VERIFY ──────────────────────────────────────────────────
-- Should show: 1 customer, 1 job, 1 estimate, 1 invoice, 1 payment,
-- 3 legal docs, 8 moisture readings, 1 call, 1 partner.
select 'Customers'         as kind, count(*) from public.customers
union all select 'Jobs',              count(*) from public.jobs
union all select 'Estimates',         count(*) from public.estimates
union all select 'Estimate items',    count(*) from public.estimate_line_items
union all select 'Invoices',          count(*) from public.invoices
union all select 'Invoice items',     count(*) from public.invoice_line_items
union all select 'Payments',          count(*) from public.payments
union all select 'Legal docs',        count(*) from public.legal_documents
union all select 'Moisture readings', count(*) from public.moisture_readings
union all select 'Notes',             count(*) from public.job_notes
union all select 'Calls',             count(*) from public.calls
union all select 'Partners',          count(*) from public.partners
union all select 'Notifications',     count(*) from public.customer_notifications;
