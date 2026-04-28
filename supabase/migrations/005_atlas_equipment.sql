-- Atlas — Equipment & Fleet Tracking
create table if not exists public.equipment (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  type            text not null check (type in ('lgr_dehumidifier','conventional_dehumidifier','air_mover','air_scrubber','extractor','other')),
  serial_number   text not null,
  model           text,
  manufacturer    text,
  status          text not null default 'available' check (status in ('available','deployed','maintenance','retired')),
  current_job_id  uuid references public.jobs(id) on delete set null,
  location_notes  text,
  hours_logged    numeric(10,2) default 0,
  purchased_at    date,
  notes           text,
  unique (type, serial_number)
);
create index if not exists idx_equipment_status on public.equipment(status);
create index if not exists idx_equipment_current_job on public.equipment(current_job_id);
alter table public.equipment enable row level security;
create policy "auth all equipment" on public.equipment for all using (auth.role() = 'authenticated');

create table if not exists public.equipment_assignments (
  id              uuid primary key default gen_random_uuid(),
  equipment_id    uuid not null references public.equipment(id) on delete cascade,
  job_id          uuid not null references public.jobs(id) on delete cascade,
  deployed_at     timestamptz default now(),
  retrieved_at    timestamptz,
  deployed_by     uuid references public.profiles(id) on delete set null,
  retrieved_by    uuid references public.profiles(id) on delete set null,
  hours_at_deploy numeric(10,2),
  hours_at_return numeric(10,2),
  notes           text
);
create index if not exists idx_equip_assign_equipment on public.equipment_assignments(equipment_id);
create index if not exists idx_equip_assign_job on public.equipment_assignments(job_id);
alter table public.equipment_assignments enable row level security;
create policy "auth all equip assignments" on public.equipment_assignments for all using (auth.role() = 'authenticated');
