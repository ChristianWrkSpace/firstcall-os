-- Protect the manually entered job billing amount as back-office financial data.
-- Existing field-work users can continue updating operational job fields, but
-- only owner, manager, and office profiles may change jobs.estimated_value.

create or replace function public.prevent_unauthorized_job_amount_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and (
       case
         when tg_op = 'INSERT' then new.estimated_value is not null
         else old.estimated_value is distinct from new.estimated_value
       end
     )
     and not coalesce(
       public.current_user_role() in ('owner', 'manager', 'office'),
       false
     ) then
    raise exception 'Only back-office users can change the job billing amount.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_unauthorized_job_amount_insert on public.jobs;
create trigger prevent_unauthorized_job_amount_insert
before insert on public.jobs
for each row execute function public.prevent_unauthorized_job_amount_change();

drop trigger if exists prevent_unauthorized_job_amount_change on public.jobs;
create trigger prevent_unauthorized_job_amount_change
before update of estimated_value on public.jobs
for each row execute function public.prevent_unauthorized_job_amount_change();
