-- Allow authenticated users to upload, read, and delete job-photos directly from the browser.
create policy "auth users upload job-photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'job-photos');

create policy "auth users read job-photos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'job-photos');

create policy "auth users delete job-photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'job-photos');
