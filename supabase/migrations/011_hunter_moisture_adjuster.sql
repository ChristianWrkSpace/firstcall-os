-- Hunter (B2B outreach), Moisture Readings (IICRC S500), Adjuster Portal

create table if not exists public.outreach_leads (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  company_name    text not null,
  contact_name    text,
  contact_title   text,
  contact_email   text,
  contact_phone   text,
  business_type   text not null check (business_type in ('hotel','property_management','plumber','insurance_office','restaurant','medical_facility','school','retail','office_building','other')),
  city            text default 'Austin',
  state           text default 'TX',
  website         text,
  status          text not null default 'new' check (status in ('new','researching','drafted','sent','followed_up','replied','converted','no_response','disqualified')),
  source          text,
  notes           text,
  next_action_at  date,
  converted_to_partner_id uuid references public.partners(id) on delete set null,
  created_by      uuid references public.profiles(id) on delete set null
);
create index if not exists idx_outreach_leads_status on public.outreach_leads(status);
alter table public.outreach_leads enable row level security;

create table if not exists public.outreach_messages (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz default now(),
  lead_id        uuid not null references public.outreach_leads(id) on delete cascade,
  channel        text not null check (channel in ('email','sms','voicemail','linkedin')),
  subject        text,
  draft_content  text not null,
  final_content  text,
  status         text not null default 'draft' check (status in ('draft','approved','sent')),
  generated_by   uuid references public.profiles(id) on delete set null,
  sent_at        timestamptz,
  reply_received boolean default false,
  reply_notes    text
);
create index if not exists idx_outreach_msgs_lead on public.outreach_messages(lead_id);
alter table public.outreach_messages enable row level security;

create table if not exists public.moisture_readings (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  job_id          uuid not null references public.jobs(id) on delete cascade,
  reading_date    date default current_date,
  room            text not null,
  location_detail text,
  material        text check (material in ('drywall','wood_subfloor','hardwood','concrete','carpet_pad','plaster','baseboard','insulation','tile','other')),
  moisture_pct    numeric(5,2),
  rh_pct          numeric(5,2),
  temp_f          numeric(5,1),
  gpp             numeric(6,2),
  is_dry_standard boolean default false,
  notes           text,
  recorded_by     uuid references public.profiles(id) on delete set null
);
create index if not exists idx_moisture_job on public.moisture_readings(job_id);
create index if not exists idx_moisture_date on public.moisture_readings(reading_date);
alter table public.moisture_readings enable row level security;

alter table public.jobs add column if not exists adjuster_share_token text unique;
create index if not exists idx_jobs_adjuster_token on public.jobs(adjuster_share_token);

do $$ begin
  if not exists (select 1 from pg_policies where tablename='outreach_leads' and policyname='auth all outreach leads') then
    create policy "auth all outreach leads" on public.outreach_leads for all using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where tablename='outreach_messages' and policyname='auth all outreach messages') then
    create policy "auth all outreach messages" on public.outreach_messages for all using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where tablename='moisture_readings' and policyname='auth all moisture readings') then
    create policy "auth all moisture readings" on public.moisture_readings for all using (auth.role() = 'authenticated');
  end if;
end $$;
