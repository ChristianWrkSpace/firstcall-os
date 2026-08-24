-- ============================================================
-- 039 Active-account RLS containment
-- ============================================================
-- Replace historical auth.role()-only policies with command-specific policies
-- backed by the active-profile-aware helpers introduced in migration 031.

-- Outreach leads

drop policy if exists "auth all outreach leads" on public.outreach_leads;
drop policy if exists "active backoffice read outreach leads" on public.outreach_leads;
drop policy if exists "active backoffice insert outreach leads" on public.outreach_leads;
drop policy if exists "active backoffice update outreach leads" on public.outreach_leads;
drop policy if exists "active backoffice delete outreach leads" on public.outreach_leads;

create policy "active backoffice read outreach leads" on public.outreach_leads
  for select to authenticated using (
    coalesce(public.current_user_role() in ('owner', 'manager', 'office'), false)
  );
create policy "active backoffice insert outreach leads" on public.outreach_leads
  for insert to authenticated with check (
    coalesce(public.current_user_role() in ('owner', 'manager', 'office'), false)
  );
create policy "active backoffice update outreach leads" on public.outreach_leads
  for update to authenticated using (
    coalesce(public.current_user_role() in ('owner', 'manager', 'office'), false)
  ) with check (
    coalesce(public.current_user_role() in ('owner', 'manager', 'office'), false)
  );
create policy "active backoffice delete outreach leads" on public.outreach_leads
  for delete to authenticated using (
    coalesce(public.current_user_role() in ('owner', 'manager', 'office'), false)
  );

-- Outreach messages

drop policy if exists "auth all outreach messages" on public.outreach_messages;
drop policy if exists "active backoffice read outreach messages" on public.outreach_messages;
drop policy if exists "active backoffice insert outreach messages" on public.outreach_messages;
drop policy if exists "active backoffice update outreach messages" on public.outreach_messages;
drop policy if exists "active backoffice delete outreach messages" on public.outreach_messages;

create policy "active backoffice read outreach messages" on public.outreach_messages
  for select to authenticated using (
    coalesce(public.current_user_role() in ('owner', 'manager', 'office'), false)
  );
create policy "active backoffice insert outreach messages" on public.outreach_messages
  for insert to authenticated with check (
    coalesce(public.current_user_role() in ('owner', 'manager', 'office'), false)
  );
create policy "active backoffice update outreach messages" on public.outreach_messages
  for update to authenticated using (
    coalesce(public.current_user_role() in ('owner', 'manager', 'office'), false)
  ) with check (
    coalesce(public.current_user_role() in ('owner', 'manager', 'office'), false)
  );
create policy "active backoffice delete outreach messages" on public.outreach_messages
  for delete to authenticated using (
    coalesce(public.current_user_role() in ('owner', 'manager', 'office'), false)
  );

-- Moisture readings

drop policy if exists "auth all moisture readings" on public.moisture_readings;
drop policy if exists "active job users read moisture readings" on public.moisture_readings;
drop policy if exists "active job users insert moisture readings" on public.moisture_readings;
drop policy if exists "active job users update moisture readings" on public.moisture_readings;
drop policy if exists "active job users delete moisture readings" on public.moisture_readings;

create policy "active job users read moisture readings" on public.moisture_readings
  for select to authenticated using (
    coalesce(public.can_access_job_storage(job_id::text), false)
  );
create policy "active job users insert moisture readings" on public.moisture_readings
  for insert to authenticated with check (
    coalesce(public.can_access_job_storage(job_id::text), false)
  );
create policy "active job users update moisture readings" on public.moisture_readings
  for update to authenticated using (
    coalesce(public.can_access_job_storage(job_id::text), false)
  ) with check (
    coalesce(public.can_access_job_storage(job_id::text), false)
  );
create policy "active job users delete moisture readings" on public.moisture_readings
  for delete to authenticated using (
    coalesce(public.can_access_job_storage(job_id::text), false)
  );

-- Audit logs remain append-only through the existing "auth insert audit" policy.

drop policy if exists "auth read audit" on public.audit_logs;
drop policy if exists "active audit viewers read audit" on public.audit_logs;

create policy "active audit viewers read audit" on public.audit_logs
  for select to authenticated using (
    coalesce(public.current_user_role() in ('owner', 'manager', 'office'), false)
  );

-- Solomon reports and backup logs

drop policy if exists "auth all solomon" on public.solomon_reports;
drop policy if exists "active management read solomon reports" on public.solomon_reports;
drop policy if exists "active management insert solomon reports" on public.solomon_reports;

create policy "active management read solomon reports" on public.solomon_reports
  for select to authenticated using (
    coalesce(public.current_user_role() in ('owner', 'manager'), false)
  );
create policy "active management insert solomon reports" on public.solomon_reports
  for insert to authenticated with check (
    coalesce(public.current_user_role() in ('owner', 'manager'), false)
  );

drop policy if exists "auth select backups" on public.backups_log;
drop policy if exists "active management read backup logs" on public.backups_log;

create policy "active management read backup logs" on public.backups_log
  for select to authenticated using (
    coalesce(public.current_user_role() in ('owner', 'manager'), false)
  );

-- Partner financial records

drop policy if exists "auth all partner payouts" on public.partner_payouts;
drop policy if exists "active backoffice read partner payouts" on public.partner_payouts;
drop policy if exists "active management insert partner payouts" on public.partner_payouts;
drop policy if exists "active management delete partner payouts" on public.partner_payouts;

create policy "active backoffice read partner payouts" on public.partner_payouts
  for select to authenticated using (
    coalesce(public.current_user_role() in ('owner', 'manager', 'office'), false)
  );
create policy "active management insert partner payouts" on public.partner_payouts
  for insert to authenticated with check (
    coalesce(public.current_user_role() in ('owner', 'manager'), false)
  );
create policy "active management delete partner payouts" on public.partner_payouts
  for delete to authenticated using (
    coalesce(public.current_user_role() in ('owner', 'manager'), false)
  );

drop policy if exists "auth all partner investments" on public.partner_investments;
drop policy if exists "active backoffice read partner investments" on public.partner_investments;
drop policy if exists "active backoffice insert partner investments" on public.partner_investments;
drop policy if exists "active management delete partner investments" on public.partner_investments;

create policy "active backoffice read partner investments" on public.partner_investments
  for select to authenticated using (
    coalesce(public.current_user_role() in ('owner', 'manager', 'office'), false)
  );
create policy "active backoffice insert partner investments" on public.partner_investments
  for insert to authenticated with check (
    coalesce(public.current_user_role() in ('owner', 'manager', 'office'), false)
  );
create policy "active management delete partner investments" on public.partner_investments
  for delete to authenticated using (
    coalesce(public.current_user_role() in ('owner', 'manager'), false)
  );

-- Echo conversations

drop policy if exists "auth read echo" on public.echo_conversations;
drop policy if exists "auth insert echo" on public.echo_conversations;
drop policy if exists "auth update echo feedback" on public.echo_conversations;
drop policy if exists "active users read own echo" on public.echo_conversations;
drop policy if exists "active users insert own echo" on public.echo_conversations;
drop policy if exists "active users update own echo" on public.echo_conversations;

create policy "active users read own echo" on public.echo_conversations
  for select to authenticated using (
    public.is_authenticated() and user_id = auth.uid()
  );
create policy "active users insert own echo" on public.echo_conversations
  for insert to authenticated with check (
    public.is_authenticated() and user_id = auth.uid()
  );
create policy "active users update own echo" on public.echo_conversations
  for update to authenticated using (
    public.is_authenticated() and user_id = auth.uid()
  ) with check (
    public.is_authenticated() and user_id = auth.uid()
  );

-- Job videos

drop policy if exists "auth all job videos" on public.job_videos;
drop policy if exists "active job users read job videos" on public.job_videos;
drop policy if exists "active job users insert job videos" on public.job_videos;
drop policy if exists "active job users update job videos" on public.job_videos;
drop policy if exists "active backoffice delete job videos" on public.job_videos;

create policy "active job users read job videos" on public.job_videos
  for select to authenticated using (
    coalesce(public.can_access_job_storage(job_id::text), false)
  );
create policy "active job users insert job videos" on public.job_videos
  for insert to authenticated with check (
    coalesce(public.can_access_job_storage(job_id::text), false)
  );
create policy "active job users update job videos" on public.job_videos
  for update to authenticated using (
    coalesce(public.can_access_job_storage(job_id::text), false)
  ) with check (
    coalesce(public.can_access_job_storage(job_id::text), false)
  );
create policy "active backoffice delete job videos" on public.job_videos
  for delete to authenticated using (
    coalesce(public.current_user_role() in ('owner', 'manager', 'office'), false)
    and coalesce(public.can_access_job_storage(job_id::text), false)
  );

-- Fail closed if a historical broad policy survived because of catalog drift.
do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and (
        (tablename = 'outreach_leads' and policyname = 'auth all outreach leads')
        or (tablename = 'outreach_messages' and policyname = 'auth all outreach messages')
        or (tablename = 'moisture_readings' and policyname = 'auth all moisture readings')
        or (tablename = 'audit_logs' and policyname = 'auth read audit')
        or (tablename = 'solomon_reports' and policyname = 'auth all solomon')
        or (tablename = 'backups_log' and policyname = 'auth select backups')
        or (tablename = 'partner_payouts' and policyname = 'auth all partner payouts')
        or (tablename = 'partner_investments' and policyname = 'auth all partner investments')
        or (tablename = 'echo_conversations' and policyname = 'auth read echo')
        or (tablename = 'echo_conversations' and policyname = 'auth insert echo')
        or (tablename = 'echo_conversations' and policyname = 'auth update echo feedback')
        or (tablename = 'job_videos' and policyname = 'auth all job videos')
      )
  ) then
    raise exception '039_active_account_rls_containment: legacy broad RLS policy remains';
  end if;
end $$;
