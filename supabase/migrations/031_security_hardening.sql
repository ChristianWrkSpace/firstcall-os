-- ============================================================
-- 031 Security hardening: active identities and safe profiles
-- ============================================================
-- PostgreSQL RLS policies grant UPDATE at the row level, not the column level.
-- A self-update policy would therefore also permit changing role/active. Remove
-- every self-update policy name used by the base schema and prior migrations;
-- ordinary users update only name/avatar_url through the narrow RPC below.

drop policy if exists "users update own profile" on public.profiles;
drop policy if exists "self update profiles" on public.profiles;

-- Authorization helpers fail closed unless the JWT maps to an active profile.
-- SECURITY DEFINER avoids profiles RLS recursion; the empty search_path and
-- schema-qualified references prevent object-shadowing attacks.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles as p
  where p.id = auth.uid()
    and p.active is true
$$;

create or replace function public.is_authenticated()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.role() = 'authenticated'
    and exists (
      select 1
      from public.profiles as p
      where p.id = auth.uid()
        and p.active is true
    )
$$;

-- Recreate the sole direct profile UPDATE policy. Active owners retain admin
-- updates (including role/active changes for other profiles); non-owners have
-- no direct UPDATE path. WITH CHECK also prevents an owner from demoting or
-- deactivating their own profile through a direct client update.
drop policy if exists "owner update profiles" on public.profiles;
create policy "owner update profiles"
  on public.profiles
  for update
  using (coalesce(public.current_user_role() = 'owner', false))
  with check (coalesce(public.current_user_role() = 'owner', false));

-- Safe self-service profile editing. This function can mutate only the two
-- presentation fields that exist in the schema; role and active are never
-- accepted as arguments or included in the UPDATE statement.
create or replace function public.update_own_profile(
  p_name text,
  p_avatar_url text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_name is null or btrim(p_name) = '' then
    raise exception 'Profile name is required.' using errcode = '23514';
  end if;

  update public.profiles
  set name = btrim(p_name),
      avatar_url = nullif(btrim(p_avatar_url), '')
  where id = auth.uid()
    and active is true;

  if not found then
    raise exception 'Not authenticated.' using errcode = '42501';
  end if;
end;
$$;

-- Functions are executable by PUBLIC by default. Grant the narrow RPC only to
-- authenticated JWTs; the function itself additionally requires active=true.
revoke all on function public.update_own_profile(text, text) from public;
revoke all on function public.update_own_profile(text, text) from anon;
grant execute on function public.update_own_profile(text, text) to authenticated;
