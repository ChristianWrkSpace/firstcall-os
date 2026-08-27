-- Durable, serialized account activation/deactivation transitions.

create table if not exists public.account_active_transitions (
  id uuid not null default gen_random_uuid(),
  target_profile_id uuid not null,
  actor_id uuid,
  idempotency_key uuid not null,
  desired_active boolean not null,
  status text not null,
  provider_state text not null default 'unknown',
  provider_observed_at timestamptz,
  attempt_count integer not null default 0,
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  constraint account_active_transitions_pkey primary key (id),
  constraint account_active_transitions_target_profile_fkey foreign key (target_profile_id)
    references public.profiles(id) on delete restrict,
  constraint account_active_transitions_actor_fkey foreign key (actor_id)
    references public.profiles(id) on delete set null,
  constraint account_active_transitions_target_idempotency_key unique (target_profile_id, idempotency_key),
  constraint account_active_transitions_status_check check (status in (
    'provider_pending', 'provider_in_progress', 'provider_failed',
    'provider_applied', 'succeeded', 'closed_inactive'
  )),
  constraint account_active_transitions_provider_state_check check (provider_state in (
    'unknown', 'banned', 'unbanned', 'missing'
  )),
  constraint account_active_transitions_attempt_count_check check (attempt_count >= 0),
  constraint account_active_transitions_error_code_check check (
    last_error_code is null or last_error_code ~ '^[a-z0-9_]{1,64}$'
  ),
  constraint account_active_transitions_lease_check check (
    (status = 'provider_in_progress') = (lease_token is not null and lease_expires_at is not null)
  ),
  constraint account_active_transitions_provider_applied_check check (
    status not in ('provider_applied', 'succeeded') or (
      (desired_active and provider_state = 'unbanned') or
      (not desired_active and provider_state = 'banned')
    )
  ),
  constraint account_active_transitions_completed_check check (
    (status in ('succeeded', 'closed_inactive')) = (completed_at is not null)
  ),
  constraint account_active_transitions_closed_inactive_check check (
    status <> 'closed_inactive' or desired_active = false
  )
);

create unique index if not exists account_active_transitions_one_open_target
  on public.account_active_transitions(target_profile_id)
  where status not in ('succeeded', 'closed_inactive');
create index if not exists account_active_transitions_recovery
  on public.account_active_transitions(status, lease_expires_at, updated_at);
create index if not exists account_active_transitions_target_history
  on public.account_active_transitions(target_profile_id, created_at desc);

create table if not exists public.account_active_transition_events (
  id uuid not null default gen_random_uuid(),
  transition_id uuid not null,
  event_type text not null,
  attempt_number integer,
  provider_state text,
  error_code text,
  occurred_at timestamptz not null default clock_timestamp(),
  constraint account_active_transition_events_pkey primary key (id),
  constraint account_active_transition_events_transition_fkey foreign key (transition_id)
    references public.account_active_transitions(id) on delete restrict,
  constraint account_active_transition_events_type_check check (event_type in (
    'claimed', 'profile_deactivated', 'provider_attempt_started',
    'provider_attempt_failed', 'provider_confirmed', 'profile_activated',
    'transition_succeeded', 'recovery_resumed', 'closed_inactive'
  )),
  constraint account_active_transition_events_attempt_check check (
    attempt_number is null or attempt_number > 0
  ),
  constraint account_active_transition_events_provider_state_check check (
    provider_state in ('unknown', 'banned', 'unbanned', 'missing')
  ),
  constraint account_active_transition_events_error_code_check check (
    error_code is null or error_code ~ '^[a-z0-9_]{1,64}$'
  )
);

create index if not exists account_active_transition_events_history
  on public.account_active_transition_events(transition_id, occurred_at, id);

alter table public.account_active_transitions enable row level security;
alter table public.account_active_transition_events enable row level security;
revoke all on table public.account_active_transitions from public, anon, authenticated, service_role;
revoke all on table public.account_active_transition_events from public, anon, authenticated, service_role;

drop trigger if exists account_active_transition_events_immutable on public.account_active_transition_events;
drop function if exists public.prevent_account_active_transition_event_mutation();
create or replace function public.prevent_account_active_transition_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  raise exception 'account_active_transition_events are append-only'
    using errcode = '42501';
end;
$function$;
revoke all on function public.prevent_account_active_transition_event_mutation() from public, anon, authenticated, service_role;
create trigger account_active_transition_events_immutable
  before update or delete on public.account_active_transition_events
  for each row execute function public.prevent_account_active_transition_event_mutation();

drop trigger if exists profiles_active_transition_guard on public.profiles;
drop function if exists public.guard_profile_active_transition();
create or replace function public.guard_profile_active_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.active is not distinct from old.active then
    return new;
  end if;
  if old.active is true and new.active is false then
    if exists (
      select 1 from public.account_active_transitions t
      where t.target_profile_id = old.id
        and t.desired_active = false
        and t.status = 'provider_pending'
        and t.status not in ('succeeded', 'closed_inactive')
    ) then
      return new;
    end if;
  elsif old.active is false and new.active is true then
    if exists (
      select 1 from public.account_active_transitions t
      where t.target_profile_id = old.id
        and t.desired_active = true
        and t.status = 'provider_applied'
        and t.provider_state = 'unbanned'
        and t.status not in ('succeeded', 'closed_inactive')
    ) then
      return new;
    end if;
  end if;
  raise exception 'profile active changes require a valid account transition'
    using errcode = '42501';
end;
$function$;
revoke all on function public.guard_profile_active_transition() from public, anon, authenticated, service_role;
create trigger profiles_active_transition_guard
  before update of active on public.profiles
  for each row execute function public.guard_profile_active_transition();

drop function if exists public.claim_account_active_transition(uuid, boolean, uuid, uuid);
create or replace function public.claim_account_active_transition(
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
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_transition public.account_active_transitions%rowtype;
  v_profile record;
  v_profile_active boolean;
  v_actor_role text;
  v_actor_active boolean;
  v_target_found boolean := false;
  v_actor_found boolean := false;
  v_updated_id uuid;
  v_latest_transition_id uuid;
begin
  if p_target_profile_id is null or p_desired_active is null
     or p_idempotency_key is null or p_actor_id is null then
    raise exception 'account_transition_invalid_argument' using errcode = '22004';
  end if;
  if not p_desired_active and p_actor_id = p_target_profile_id then
    raise exception 'account_transition_self_deactivation' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_target_profile_id::text, 0)
  );

  for v_profile in
    select p.id, p.role, p.active
    from public.profiles p
    where p.id in (p_actor_id, p_target_profile_id)
    order by p.id asc
    for update
  loop
    if v_profile.id = p_actor_id then
      v_actor_found := true;
      v_actor_role := v_profile.role;
      v_actor_active := v_profile.active;
    end if;
    if v_profile.id = p_target_profile_id then
      v_target_found := true;
      v_profile_active := v_profile.active;
    end if;
  end loop;

  if not v_target_found then
    raise exception 'account_transition_target_not_found' using errcode = 'P0002';
  end if;
  if not v_actor_found or v_actor_role is distinct from 'owner'
     or v_actor_active is distinct from true then
    raise exception 'account_transition_actor_forbidden' using errcode = '42501';
  end if;

  select t.* into v_transition
  from public.account_active_transitions t
  where t.target_profile_id = p_target_profile_id
    and t.idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_transition.desired_active is distinct from p_desired_active then
      raise exception 'account_transition_idempotency_conflict' using errcode = 'P0001';
    end if;
    if v_transition.status in ('succeeded', 'closed_inactive') then
      select t.id into v_latest_transition_id
      from public.account_active_transitions t
      where t.target_profile_id = p_target_profile_id
      order by (t.status not in ('succeeded', 'closed_inactive')) desc,
        t.created_at desc, t.id desc
      limit 1;
      if v_latest_transition_id is distinct from v_transition.id then
        raise exception 'account_transition_stale_replay' using errcode = 'P0001';
      end if;
    end if;
  else
    select t.* into v_transition
    from public.account_active_transitions t
    where t.target_profile_id = p_target_profile_id
      and t.status not in ('succeeded', 'closed_inactive')
    for update;

    if found then
      if v_transition.desired_active is distinct from p_desired_active then
        raise exception 'account_transition_conflict' using errcode = 'P0001';
      end if;
    else
      insert into public.account_active_transitions (
        target_profile_id, actor_id, idempotency_key, desired_active, status
      ) values (
        p_target_profile_id, p_actor_id, p_idempotency_key,
        p_desired_active, 'provider_pending'
      ) returning * into v_transition;

      insert into public.account_active_transition_events (
        transition_id, event_type, provider_state
      ) values (v_transition.id, 'claimed', v_transition.provider_state);

      if not p_desired_active and v_profile_active is distinct from false then
        update public.profiles
           set active = false
         where id = p_target_profile_id
           and active is distinct from false
        returning id into v_updated_id;
        if not found then
          raise exception 'account_transition_profile_deactivation_failed'
            using errcode = 'P0001';
        end if;
        v_profile_active := false;
        insert into public.account_active_transition_events (
          transition_id, event_type, provider_state
        ) values (v_transition.id, 'profile_deactivated', v_transition.provider_state);
      end if;

      insert into public.audit_logs (
        user_id, user_name, action, entity_type, entity_id, details
      ) values (
        p_actor_id, null, 'account_active_transition_claimed',
        'account_active_transition', v_transition.id,
        jsonb_build_object(
          'transition_id', v_transition.id,
          'desired_active', v_transition.desired_active,
          'transition_status', v_transition.status,
          'provider_state', v_transition.provider_state,
          'error_code', v_transition.last_error_code
        )
      );
    end if;
  end if;

  select p.active into v_profile_active
  from public.profiles p
  where p.id = p_target_profile_id;

  return query select v_transition.id, v_transition.desired_active,
    v_transition.status, v_profile_active, v_transition.provider_state,
    v_transition.attempt_count,
    v_transition.status in ('provider_pending', 'provider_failed', 'provider_in_progress', 'provider_applied');
end;
$function$;

drop function if exists public.acquire_account_provider_work(uuid, uuid, integer);
create or replace function public.acquire_account_provider_work(
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
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_transition public.account_active_transitions%rowtype;
  v_target_profile_id uuid;
  v_transition_actor_id uuid;
  v_profile record;
  v_target_found boolean := false;
  v_was_expired boolean := false;
begin
  if p_transition_id is null or p_worker_token is null then
    raise exception 'account_transition_invalid_argument' using errcode = '22004';
  end if;
  if p_lease_seconds is null or p_lease_seconds < 1 or p_lease_seconds > 900 then
    raise exception 'account_transition_invalid_lease' using errcode = '22023';
  end if;

  select t.target_profile_id, t.actor_id into v_target_profile_id, v_transition_actor_id
  from public.account_active_transitions t where t.id = p_transition_id;
  if not found then
    raise exception 'account_transition_not_found' using errcode = 'P0002';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_target_profile_id::text, 0)
  );
  for v_profile in
    select p.id, p.active from public.profiles p
    where p.id in (v_transition_actor_id, v_target_profile_id)
    order by p.id asc for update
  loop
    if v_profile.id = v_target_profile_id then
      v_target_found := true;
    end if;
  end loop;
  if not v_target_found then
    raise exception 'account_transition_target_not_found' using errcode = 'P0002';
  end if;
  select t.* into v_transition from public.account_active_transitions t
  where t.id = p_transition_id for update;
  if not found or v_transition.target_profile_id is distinct from v_target_profile_id
     or v_transition.actor_id is distinct from v_transition_actor_id then
    raise exception 'account_transition_snapshot_changed' using errcode = '55000';
  end if;

  if v_transition.status = 'provider_in_progress'
     and v_transition.lease_expires_at > clock_timestamp() then
    raise exception 'account_transition_lease_active' using errcode = '55P03';
  end if;
  if v_transition.status in ('succeeded', 'closed_inactive', 'provider_applied') then
    raise exception 'account_transition_not_leaseable' using errcode = '55000';
  end if;
  if v_transition.status = 'provider_in_progress'
     and v_transition.lease_expires_at <= clock_timestamp() then
    v_was_expired := true;
    insert into public.account_active_transition_events (
      transition_id, event_type, attempt_number, provider_state
    ) values (
      v_transition.id, 'recovery_resumed', v_transition.attempt_count,
      v_transition.provider_state
    );
  elsif v_transition.status not in ('provider_pending', 'provider_failed') then
    raise exception 'account_transition_not_leaseable' using errcode = '55000';
  end if;

  update public.account_active_transitions
     set status = 'provider_in_progress', attempt_count = attempt_count + 1,
         lease_token = p_worker_token,
         lease_expires_at = clock_timestamp() + pg_catalog.make_interval(secs => p_lease_seconds),
         updated_at = clock_timestamp()
   where id = p_transition_id
  returning * into v_transition;

  insert into public.account_active_transition_events (
    transition_id, event_type, attempt_number, provider_state
  ) values (
    v_transition.id, 'provider_attempt_started', v_transition.attempt_count,
    v_transition.provider_state
  );
  insert into public.audit_logs (
    user_id, user_name, action, entity_type, entity_id, details
  ) values (
    v_transition.actor_id, null,
    case when v_was_expired then 'account_active_transition_recovered'
         else 'account_active_transition_provider_started' end,
    'account_active_transition', v_transition.id,
    jsonb_build_object(
      'transition_id', v_transition.id, 'desired_active', v_transition.desired_active,
      'transition_status', v_transition.status, 'provider_state', v_transition.provider_state,
      'error_code', v_transition.last_error_code
    )
  );
  return query select v_transition.id, v_transition.target_profile_id,
    v_transition.desired_active, v_transition.attempt_count, v_transition.status;
end;
$function$;

drop function if exists public.record_account_provider_result(uuid, uuid, boolean, text, text);
create or replace function public.record_account_provider_result(
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
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_transition public.account_active_transitions%rowtype;
  v_target_profile_id uuid;
  v_transition_actor_id uuid;
  v_profile_active boolean;
  v_profile record;
  v_target_found boolean := false;
begin
  if p_transition_id is null or p_worker_token is null
     or p_succeeded is null or p_provider_state is null then
    raise exception 'account_transition_invalid_argument' using errcode = '22004';
  end if;
  if p_provider_state not in ('unknown', 'banned', 'unbanned', 'missing') then
    raise exception 'account_transition_invalid_provider_state' using errcode = '22023';
  end if;

  select t.target_profile_id, t.actor_id into v_target_profile_id, v_transition_actor_id
  from public.account_active_transitions t where t.id = p_transition_id;
  if not found then
    raise exception 'account_transition_not_found' using errcode = 'P0002';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_target_profile_id::text, 0)
  );
  for v_profile in
    select p.id, p.active from public.profiles p
    where p.id in (v_transition_actor_id, v_target_profile_id)
    order by p.id asc for update
  loop
    if v_profile.id = v_target_profile_id then
      v_target_found := true;
      v_profile_active := v_profile.active;
    end if;
  end loop;
  if not v_target_found then
    raise exception 'account_transition_target_not_found' using errcode = 'P0002';
  end if;
  select t.* into v_transition from public.account_active_transitions t
  where t.id = p_transition_id for update;
  if not found or v_transition.target_profile_id is distinct from v_target_profile_id
     or v_transition.actor_id is distinct from v_transition_actor_id then
    raise exception 'account_transition_snapshot_changed' using errcode = '55000';
  end if;

  if v_transition.status <> 'provider_in_progress'
     or v_transition.lease_token is distinct from p_worker_token
     or v_transition.lease_expires_at <= clock_timestamp() then
    raise exception 'account_transition_invalid_or_expired_lease' using errcode = '55000';
  end if;

  if p_succeeded then
    if p_error_code is not null then
      raise exception 'account_transition_success_has_error' using errcode = '22023';
    end if;
    if v_transition.desired_active and p_provider_state <> 'unbanned' then
      raise exception 'account_transition_provider_state_mismatch' using errcode = '22023';
    end if;
    if not v_transition.desired_active and p_provider_state <> 'banned' then
      raise exception 'account_transition_provider_state_mismatch' using errcode = '22023';
    end if;
    update public.account_active_transitions
       set status = 'provider_applied', provider_state = p_provider_state,
           provider_observed_at = clock_timestamp(), lease_token = null,
           lease_expires_at = null, last_error_code = null,
           updated_at = clock_timestamp()
     where id = p_transition_id returning * into v_transition;
    insert into public.account_active_transition_events (
      transition_id, event_type, attempt_number, provider_state
    ) values (
      v_transition.id, 'provider_confirmed', v_transition.attempt_count,
      v_transition.provider_state
    );
  else
    if p_error_code is null or p_error_code not in (
      'provider_timeout', 'provider_unavailable', 'provider_rate_limited',
      'provider_rejected', 'provider_user_missing', 'provider_response_unverified'
    ) then
      raise exception 'account_transition_invalid_error_code' using errcode = '22023';
    end if;
    update public.account_active_transitions
       set status = 'provider_failed', provider_state = p_provider_state,
           provider_observed_at = clock_timestamp(), last_error_code = p_error_code,
           lease_token = null, lease_expires_at = null, updated_at = clock_timestamp()
     where id = p_transition_id returning * into v_transition;
    insert into public.account_active_transition_events (
      transition_id, event_type, attempt_number, provider_state, error_code
    ) values (
      v_transition.id, 'provider_attempt_failed', v_transition.attempt_count,
      v_transition.provider_state, v_transition.last_error_code
    );
  end if;

  insert into public.audit_logs (
    user_id, user_name, action, entity_type, entity_id, details
  ) values (
    v_transition.actor_id, null,
    case when p_succeeded then 'account_active_transition_provider_confirmed'
         else 'account_active_transition_provider_failed' end,
    'account_active_transition', v_transition.id,
    jsonb_build_object(
      'transition_id', v_transition.id, 'desired_active', v_transition.desired_active,
      'transition_status', v_transition.status, 'provider_state', v_transition.provider_state,
      'error_code', v_transition.last_error_code
    )
  );
  return query select v_transition.id, v_transition.status, v_profile_active,
    v_transition.provider_state, v_transition.status = 'provider_failed';
end;
$function$;

drop function if exists public.finalize_account_active_transition(uuid);
create or replace function public.finalize_account_active_transition(p_transition_id uuid)
returns table (
  transition_id uuid,
  desired_active boolean,
  transition_status text,
  profile_active boolean,
  provider_state text,
  retryable boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_transition public.account_active_transitions%rowtype;
  v_target_profile_id uuid;
  v_transition_actor_id uuid;
  v_profile_active boolean;
  v_updated_id uuid;
  v_profile record;
  v_target_found boolean := false;
begin
  if p_transition_id is null then
    raise exception 'account_transition_invalid_argument' using errcode = '22004';
  end if;
  select t.target_profile_id, t.actor_id into v_target_profile_id, v_transition_actor_id
  from public.account_active_transitions t where t.id = p_transition_id;
  if not found then
    raise exception 'account_transition_not_found' using errcode = 'P0002';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_target_profile_id::text, 0)
  );
  for v_profile in
    select p.id, p.active from public.profiles p
    where p.id in (v_transition_actor_id, v_target_profile_id)
    order by p.id asc for update
  loop
    if v_profile.id = v_target_profile_id then
      v_target_found := true;
      v_profile_active := v_profile.active;
    end if;
  end loop;
  if not v_target_found then
    raise exception 'account_transition_target_not_found' using errcode = 'P0002';
  end if;
  select t.* into v_transition from public.account_active_transitions t
  where t.id = p_transition_id for update;
  if not found or v_transition.target_profile_id is distinct from v_target_profile_id
     or v_transition.actor_id is distinct from v_transition_actor_id then
    raise exception 'account_transition_snapshot_changed' using errcode = '55000';
  end if;

  if v_transition.status <> 'provider_applied' then
    raise exception 'account_transition_not_ready' using errcode = '55000';
  end if;
  if v_transition.desired_active and v_transition.provider_state <> 'unbanned' then
    raise exception 'account_transition_provider_state_mismatch' using errcode = '55000';
  end if;
  if not v_transition.desired_active and v_transition.provider_state <> 'banned' then
    raise exception 'account_transition_provider_state_mismatch' using errcode = '55000';
  end if;
  if not v_transition.desired_active then
    if v_profile_active is distinct from false then
      raise exception 'account_transition_profile_not_inactive' using errcode = '55000';
    end if;
  else
    update public.profiles set active = true
     where id = v_transition.target_profile_id and active is distinct from true
    returning id into v_updated_id;
    if found then
      v_profile_active := true;
      insert into public.account_active_transition_events (
        transition_id, event_type, provider_state
      ) values (v_transition.id, 'profile_activated', v_transition.provider_state);
    elsif v_profile_active is distinct from true then
      raise exception 'account_transition_profile_activation_failed' using errcode = 'P0001';
    end if;
  end if;

  update public.account_active_transitions
     set status = 'succeeded', completed_at = clock_timestamp(), lease_token = null,
         lease_expires_at = null, last_error_code = null, updated_at = clock_timestamp()
   where id = p_transition_id returning * into v_transition;
  insert into public.account_active_transition_events (
    transition_id, event_type, provider_state
  ) values (v_transition.id, 'transition_succeeded', v_transition.provider_state);
  insert into public.audit_logs (
    user_id, user_name, action, entity_type, entity_id, details
  ) values (
    v_transition.actor_id, null, 'account_active_transition_succeeded',
    'account_active_transition', v_transition.id,
    jsonb_build_object(
      'transition_id', v_transition.id, 'desired_active', v_transition.desired_active,
      'transition_status', v_transition.status, 'provider_state', v_transition.provider_state,
      'error_code', v_transition.last_error_code
    )
  );
  return query select v_transition.id, v_transition.desired_active,
    v_transition.status, v_profile_active, v_transition.provider_state, false;
end;
$function$;

drop function if exists public.close_account_active_transition_inactive(uuid, uuid);
create or replace function public.close_account_active_transition_inactive(
  p_transition_id uuid,
  p_actor_id uuid
)
returns table (
  transition_id uuid,
  desired_active boolean,
  transition_status text,
  profile_active boolean,
  provider_state text,
  retryable boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_transition public.account_active_transitions%rowtype;
  v_target_profile_id uuid;
  v_transition_actor_id uuid;
  v_profile record;
  v_profile_active boolean;
  v_actor_role text;
  v_actor_active boolean;
  v_target_found boolean := false;
  v_actor_found boolean := false;
begin
  if p_transition_id is null or p_actor_id is null then
    raise exception 'account_transition_invalid_argument' using errcode = '22004';
  end if;
  select t.target_profile_id, t.actor_id into v_target_profile_id, v_transition_actor_id
  from public.account_active_transitions t where t.id = p_transition_id;
  if not found then
    raise exception 'account_transition_not_found' using errcode = 'P0002';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_target_profile_id::text, 0)
  );
  for v_profile in
    select p.id, p.role, p.active from public.profiles p
    where p.id in (p_actor_id, v_target_profile_id)
    order by p.id asc
    for update
  loop
    if v_profile.id = p_actor_id then
      v_actor_found := true;
      v_actor_role := v_profile.role;
      v_actor_active := v_profile.active;
    end if;
    if v_profile.id = v_target_profile_id then
      v_target_found := true;
      v_profile_active := v_profile.active;
    end if;
  end loop;
  if not v_target_found then
    raise exception 'account_transition_target_not_found' using errcode = 'P0002';
  end if;
  select t.* into v_transition from public.account_active_transitions t
  where t.id = p_transition_id for update;
  if not found or v_transition.target_profile_id is distinct from v_target_profile_id
     or v_transition.actor_id is distinct from v_transition_actor_id then
    raise exception 'account_transition_snapshot_changed' using errcode = '55000';
  end if;
  if not v_actor_found or v_actor_role is distinct from 'owner'
     or v_actor_active is distinct from true then
    raise exception 'account_transition_actor_forbidden' using errcode = '42501';
  end if;
  if v_transition.desired_active is distinct from false
     or v_profile_active is distinct from false
     or v_transition.status <> 'provider_failed'
     or v_transition.provider_state <> 'missing'
     or v_transition.last_error_code is distinct from 'provider_user_missing' then
    raise exception 'account_transition_not_closable_inactive' using errcode = '55000';
  end if;

  update public.account_active_transitions
     set status = 'closed_inactive', completed_at = clock_timestamp(),
         lease_token = null, lease_expires_at = null, updated_at = clock_timestamp()
   where id = p_transition_id returning * into v_transition;
  insert into public.account_active_transition_events (
    transition_id, event_type, attempt_number, provider_state, error_code
  ) values (
    v_transition.id, 'closed_inactive', v_transition.attempt_count,
    v_transition.provider_state, v_transition.last_error_code
  );
  insert into public.audit_logs (
    user_id, user_name, action, entity_type, entity_id, details
  ) values (
    p_actor_id, null, 'account_active_transition_closed_inactive',
    'account_active_transition', v_transition.id,
    jsonb_build_object(
      'transition_id', v_transition.id, 'desired_active', v_transition.desired_active,
      'transition_status', v_transition.status, 'provider_state', v_transition.provider_state,
      'error_code', v_transition.last_error_code
    )
  );
  return query select v_transition.id, v_transition.desired_active,
    v_transition.status, v_profile_active, v_transition.provider_state, false;
end;
$function$;

drop function if exists public.get_account_active_transition(uuid);
create or replace function public.get_account_active_transition(p_transition_id uuid)
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
language sql
stable
security definer
set search_path = ''
as $function$
  select t.id, t.target_profile_id, t.desired_active, t.status, p.active,
    t.provider_state, t.provider_observed_at, t.attempt_count, t.last_error_code,
    t.status in ('provider_pending', 'provider_in_progress', 'provider_failed', 'provider_applied')
  from public.account_active_transitions t
  join public.profiles p on p.id = t.target_profile_id
  where t.id = p_transition_id;
$function$;

drop function if exists public.get_account_active_transition_for_target(uuid);
create or replace function public.get_account_active_transition_for_target(p_target_profile_id uuid)
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
language sql
stable
security definer
set search_path = ''
as $function$
  select t.id, t.target_profile_id, t.desired_active, t.status, p.active,
    t.provider_state, t.provider_observed_at, t.attempt_count, t.last_error_code,
    t.status in ('provider_pending', 'provider_in_progress', 'provider_failed', 'provider_applied')
  from public.account_active_transitions t
  join public.profiles p on p.id = t.target_profile_id
  where t.target_profile_id = p_target_profile_id
  order by (t.status not in ('succeeded', 'closed_inactive')) desc,
    t.created_at desc, t.id desc
  limit 1;
$function$;

drop function if exists public.list_latest_account_active_transitions();
create or replace function public.list_latest_account_active_transitions()
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
language sql
stable
security definer
set search_path = ''
as $function$
  select distinct on (t.target_profile_id)
    t.id, t.target_profile_id, t.desired_active, t.status, p.active,
    t.provider_state, t.provider_observed_at, t.attempt_count, t.last_error_code,
    t.status in ('provider_pending', 'provider_in_progress', 'provider_failed', 'provider_applied')
  from public.account_active_transitions t
  join public.profiles p on p.id = t.target_profile_id
  order by t.target_profile_id,
    (t.status not in ('succeeded', 'closed_inactive')) desc,
    t.created_at desc, t.id desc;
$function$;

drop function if exists public.list_recoverable_account_active_transitions(integer);
create or replace function public.list_recoverable_account_active_transitions(p_limit integer default 25)
returns table (
  transition_id uuid,
  transition_status text,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 100));
begin
  return query
  select t.id, t.status, t.updated_at
  from public.account_active_transitions t
  where t.status in ('provider_pending', 'provider_failed', 'provider_applied')
     or (t.status = 'provider_in_progress' and t.lease_expires_at <= clock_timestamp())
  order by t.updated_at asc, t.id asc
  limit v_limit;
end;
$function$;

revoke all on function public.claim_account_active_transition(uuid, boolean, uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_account_active_transition(uuid, boolean, uuid, uuid) to service_role;
revoke all on function public.acquire_account_provider_work(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.acquire_account_provider_work(uuid, uuid, integer) to service_role;
revoke all on function public.record_account_provider_result(uuid, uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.record_account_provider_result(uuid, uuid, boolean, text, text) to service_role;
revoke all on function public.finalize_account_active_transition(uuid) from public, anon, authenticated;
grant execute on function public.finalize_account_active_transition(uuid) to service_role;
revoke all on function public.close_account_active_transition_inactive(uuid, uuid) from public, anon, authenticated;
grant execute on function public.close_account_active_transition_inactive(uuid, uuid) to service_role;
revoke all on function public.get_account_active_transition(uuid) from public, anon, authenticated;
grant execute on function public.get_account_active_transition(uuid) to service_role;
revoke all on function public.get_account_active_transition_for_target(uuid) from public, anon, authenticated;
grant execute on function public.get_account_active_transition_for_target(uuid) to service_role;
revoke all on function public.list_latest_account_active_transitions() from public, anon, authenticated;
grant execute on function public.list_latest_account_active_transitions() to service_role;
revoke all on function public.list_recoverable_account_active_transitions(integer) from public, anon, authenticated;
grant execute on function public.list_recoverable_account_active_transitions(integer) to service_role;

do $verification$
declare
  v_name text;
  v_expected text;
  v_actual text;
  v_signature text;
  v_count integer;
  v_validated boolean;
  v_table text;
  v_not_null boolean;
  v_expected_not_null boolean;
  v_default text;
  v_expected_default text;
begin
  for v_name in select column_name from (values
    ('id'), ('target_profile_id'), ('actor_id'), ('idempotency_key'),
    ('desired_active'), ('status'), ('provider_state'), ('provider_observed_at'),
    ('attempt_count'), ('lease_token'), ('lease_expires_at'), ('last_error_code'),
    ('created_at'), ('updated_at'), ('completed_at')
  ) required(column_name)
  loop
    if not exists (
      select 1 from pg_catalog.pg_attribute a
      join pg_catalog.pg_class c on c.oid = a.attrelid
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'account_active_transitions'
        and a.attname = v_name and a.attnum > 0 and not a.attisdropped
    ) then
      raise exception 'account_active_transitions column drift: %', v_name;
    end if;
  end loop;
  for v_name in select column_name from (values
    ('id'), ('transition_id'), ('event_type'), ('attempt_number'),
    ('provider_state'), ('error_code'), ('occurred_at')
  ) required(column_name)
  loop
    if not exists (
      select 1 from pg_catalog.pg_attribute a
      join pg_catalog.pg_class c on c.oid = a.attrelid
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'account_active_transition_events'
        and a.attname = v_name and a.attnum > 0 and not a.attisdropped
    ) then
      raise exception 'account_active_transition_events column drift: %', v_name;
    end if;
  end loop;

  for v_table, v_name, v_expected, v_expected_not_null, v_expected_default in
    select * from (values
      ('account_active_transitions', 'id', 'uuid', true, 'gen_random_uuid()'),
      ('account_active_transitions', 'target_profile_id', 'uuid', true, ''),
      ('account_active_transitions', 'actor_id', 'uuid', false, ''),
      ('account_active_transitions', 'idempotency_key', 'uuid', true, ''),
      ('account_active_transitions', 'desired_active', 'boolean', true, ''),
      ('account_active_transitions', 'status', 'text', true, ''),
      ('account_active_transitions', 'provider_state', 'text', true, '''unknown''::text'),
      ('account_active_transitions', 'provider_observed_at', 'timestamp with time zone', false, ''),
      ('account_active_transitions', 'attempt_count', 'integer', true, '0'),
      ('account_active_transitions', 'lease_token', 'uuid', false, ''),
      ('account_active_transitions', 'lease_expires_at', 'timestamp with time zone', false, ''),
      ('account_active_transitions', 'last_error_code', 'text', false, ''),
      ('account_active_transitions', 'created_at', 'timestamp with time zone', true, 'clock_timestamp()'),
      ('account_active_transitions', 'updated_at', 'timestamp with time zone', true, 'clock_timestamp()'),
      ('account_active_transitions', 'completed_at', 'timestamp with time zone', false, ''),
      ('account_active_transition_events', 'id', 'uuid', true, 'gen_random_uuid()'),
      ('account_active_transition_events', 'transition_id', 'uuid', true, ''),
      ('account_active_transition_events', 'event_type', 'text', true, ''),
      ('account_active_transition_events', 'attempt_number', 'integer', false, ''),
      ('account_active_transition_events', 'provider_state', 'text', false, ''),
      ('account_active_transition_events', 'error_code', 'text', false, ''),
      ('account_active_transition_events', 'occurred_at', 'timestamp with time zone', true, 'clock_timestamp()')
    ) expected(table_name, column_name, type_name, not_null, default_expr)
  loop
    select pg_catalog.format_type(a.atttypid, a.atttypmod), a.attnotnull,
           coalesce(pg_catalog.pg_get_expr(d.adbin, d.adrelid), '')
      into v_actual, v_not_null, v_default
    from pg_catalog.pg_attribute a
    join pg_catalog.pg_class c on c.oid = a.attrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    left join pg_catalog.pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    where n.nspname = 'public' and c.relname = v_table and a.attname = v_name
      and a.attnum > 0 and not a.attisdropped
      and a.attidentity = '' and a.attgenerated = '';
    if not found or v_actual <> v_expected or v_not_null is distinct from v_expected_not_null
       or regexp_replace(lower(v_default), '\s+', ' ', 'g') <> v_expected_default then
      raise exception 'account transition column drift: %.%', v_table, v_name;
    end if;
  end loop;

  select count(*) into v_count from pg_catalog.pg_attribute
   where attrelid = 'public.account_active_transitions'::pg_catalog.regclass
     and attnum > 0 and not attisdropped;
  if v_count <> 15 then raise exception 'account_active_transitions column count drift'; end if;
  select count(*) into v_count from pg_catalog.pg_attribute
   where attrelid = 'public.account_active_transition_events'::pg_catalog.regclass
     and attnum > 0 and not attisdropped;
  if v_count <> 7 then raise exception 'account_active_transition_events column count drift'; end if;

  for v_name, v_expected in select * from (values
    ('account_active_transitions_pkey', 'primary key (id)'),
    ('account_active_transitions_target_profile_fkey', 'foreign key (target_profile_id) references profiles(id) on delete restrict'),
    ('account_active_transitions_actor_fkey', 'foreign key (actor_id) references profiles(id) on delete set null'),
    ('account_active_transitions_target_idempotency_key', 'unique (target_profile_id, idempotency_key)'),
    ('account_active_transitions_status_check', 'check ((status = any (array[''provider_pending''::text, ''provider_in_progress''::text, ''provider_failed''::text, ''provider_applied''::text, ''succeeded''::text, ''closed_inactive''::text])))'),
    ('account_active_transitions_provider_state_check', 'check ((provider_state = any (array[''unknown''::text, ''banned''::text, ''unbanned''::text, ''missing''::text])))'),
    ('account_active_transitions_attempt_count_check', 'check ((attempt_count >= 0))'),
    ('account_active_transitions_error_code_check', 'check (((last_error_code is null) or (last_error_code ~ ''^[a-z0-9_]{1,64}$''::text)))'),
    ('account_active_transitions_lease_check', 'check (((status = ''provider_in_progress''::text) = ((lease_token is not null) and (lease_expires_at is not null))))'),
    ('account_active_transitions_provider_applied_check', 'check (((status <> all (array[''provider_applied''::text, ''succeeded''::text])) or ((desired_active and (provider_state = ''unbanned''::text)) or ((not desired_active) and (provider_state = ''banned''::text)))))'),
    ('account_active_transitions_completed_check', 'check (((status = any (array[''succeeded''::text, ''closed_inactive''::text])) = (completed_at is not null)))'),
    ('account_active_transitions_closed_inactive_check', 'check (((status <> ''closed_inactive''::text) or (desired_active = false)))'),
    ('account_active_transition_events_pkey', 'primary key (id)'),
    ('account_active_transition_events_transition_fkey', 'foreign key (transition_id) references account_active_transitions(id) on delete restrict'),
    ('account_active_transition_events_type_check', 'check ((event_type = any (array[''claimed''::text, ''profile_deactivated''::text, ''provider_attempt_started''::text, ''provider_attempt_failed''::text, ''provider_confirmed''::text, ''profile_activated''::text, ''transition_succeeded''::text, ''recovery_resumed''::text, ''closed_inactive''::text])))'),
    ('account_active_transition_events_attempt_check', 'check (((attempt_number is null) or (attempt_number > 0)))'),
    ('account_active_transition_events_provider_state_check', 'check ((provider_state = any (array[''unknown''::text, ''banned''::text, ''unbanned''::text, ''missing''::text])))'),
    ('account_active_transition_events_error_code_check', 'check (((error_code is null) or (error_code ~ ''^[a-z0-9_]{1,64}$''::text)))')
  ) expected(name, definition)
  loop
    select regexp_replace(lower(pg_catalog.pg_get_constraintdef(c.oid)), '\s+', ' ', 'g'),
           c.convalidated
      into v_actual, v_validated
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.conname = v_name
      and c.conrelid = pg_catalog.to_regclass(
        case when v_name like 'account_active_transition_events_%'
          then 'public.account_active_transition_events'
          else 'public.account_active_transitions'
        end
      );
    v_actual := replace(v_actual, 'references public.', 'references ');
    if not found or v_actual <> v_expected or not v_validated then
      raise exception 'account transition constraint drift: %', v_name;
    end if;
  end loop;

  for v_name, v_expected in select * from (values
    ('account_active_transitions_one_open_target', 'create unique index account_active_transitions_one_open_target on public.account_active_transitions using btree (target_profile_id) where (status <> all (array[''succeeded''::text, ''closed_inactive''::text]))'),
    ('account_active_transitions_recovery', 'create index account_active_transitions_recovery on public.account_active_transitions using btree (status, lease_expires_at, updated_at)'),
    ('account_active_transitions_target_history', 'create index account_active_transitions_target_history on public.account_active_transitions using btree (target_profile_id, created_at desc)'),
    ('account_active_transition_events_history', 'create index account_active_transition_events_history on public.account_active_transition_events using btree (transition_id, occurred_at, id)')
  ) expected(name, definition)
  loop
    select regexp_replace(lower(pg_catalog.pg_get_indexdef(i.indexrelid)), '\s+', ' ', 'g')
      into v_actual
    from pg_catalog.pg_index i
    join pg_catalog.pg_class c on c.oid = i.indexrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = v_name and i.indisvalid and i.indisready;
    if not found or v_actual <> v_expected then
      raise exception 'account transition index drift: %', v_name;
    end if;
  end loop;

  if exists (
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('account_active_transitions', 'account_active_transition_events')
      and (not c.relrowsecurity or pg_catalog.pg_get_userbyid(c.relowner) <> current_user)
  ) or (select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relname in ('account_active_transitions', 'account_active_transition_events')) <> 2 then
    raise exception 'account transition table security drift';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))
    ) acl
    where n.nspname = 'public'
      and c.relname in ('account_active_transitions', 'account_active_transition_events')
      and acl.grantee <> c.relowner
  ) then
    raise exception 'account transition table ACL drift';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policy pol
    join pg_catalog.pg_class c on c.oid = pol.polrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('account_active_transitions', 'account_active_transition_events')
  ) then
    raise exception 'account transition policy drift';
  end if;

  for v_name, v_signature in select * from (values
    ('claim_account_active_transition', 'uuid, boolean, uuid, uuid'),
    ('acquire_account_provider_work', 'uuid, uuid, integer'),
    ('record_account_provider_result', 'uuid, uuid, boolean, text, text'),
    ('finalize_account_active_transition', 'uuid'),
    ('close_account_active_transition_inactive', 'uuid, uuid'),
    ('get_account_active_transition', 'uuid'),
    ('get_account_active_transition_for_target', 'uuid'),
    ('list_latest_account_active_transitions', ''),
    ('list_recoverable_account_active_transitions', 'integer')
  ) expected(name, signature)
  loop
    select count(*) into v_count
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = v_name;
    if v_count <> 1 then
      raise exception 'account transition rpc overload drift: %', v_name;
    end if;
    if not exists (
      select 1 from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = v_name
        and pg_catalog.oidvectortypes(p.proargtypes) = v_signature
        and p.prosecdef
        and pg_catalog.pg_get_userbyid(p.proowner) = current_user
    ) then
      raise exception 'account transition rpc definition drift: %', v_name;
    end if;
    if exists (
      select 1
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      cross join lateral pg_catalog.aclexplode(
        coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
      ) acl
      where n.nspname = 'public' and p.proname = v_name
        and pg_catalog.oidvectortypes(p.proargtypes) = v_signature
        and acl.grantee not in (
          p.proowner,
          (select oid from pg_catalog.pg_roles where rolname = 'service_role')
        )
    ) or not exists (
      select 1
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      cross join lateral pg_catalog.aclexplode(
        coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
      ) acl
      where n.nspname = 'public' and p.proname = v_name
        and pg_catalog.oidvectortypes(p.proargtypes) = v_signature
        and acl.grantee = (select oid from pg_catalog.pg_roles where rolname = 'service_role')
        and acl.privilege_type = 'EXECUTE'
    ) then
      raise exception 'account transition rpc ACL drift: %', v_name;
    end if;
  end loop;

  if exists (
    select 1 from pg_catalog.pg_trigger t
    join pg_catalog.pg_class c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and t.tgname in ('account_active_transition_events_immutable', 'profiles_active_transition_guard')
      and (t.tgisinternal or t.tgenabled <> 'O')
  ) or (select count(*) from pg_catalog.pg_trigger t
        where t.tgname in ('account_active_transition_events_immutable', 'profiles_active_transition_guard')
          and not t.tgisinternal) <> 2 then
    raise exception 'account transition trigger drift';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_class c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('account_active_transitions', 'account_active_transition_events')
      and not t.tgisinternal
      and not (
        c.relname = 'account_active_transition_events'
        and t.tgname = 'account_active_transition_events_immutable'
        and t.tgfoid = pg_catalog.to_regprocedure('public.prevent_account_active_transition_event_mutation()')
        and lower(pg_catalog.pg_get_triggerdef(t.oid)) like '%before%'
        and lower(pg_catalog.pg_get_triggerdef(t.oid)) like '%update%'
        and lower(pg_catalog.pg_get_triggerdef(t.oid)) like '%delete%'
      )
  ) or not exists (
    select 1
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_class c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'profiles'
      and not t.tgisinternal
      and t.tgname = 'profiles_active_transition_guard'
      and t.tgfoid = pg_catalog.to_regprocedure('public.guard_profile_active_transition()')
      and lower(pg_catalog.pg_get_triggerdef(t.oid)) like '%before update of active%'
  ) then
    raise exception 'unexpected account transition trigger drift';
  end if;
end;
$verification$;
