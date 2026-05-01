-- Job videos — original site walk-through clips. Frames extracted client-side
-- and stored as regular job_photos linked back to the source video. Argus
-- analyzes the frames the same way it analyzes regular photos, so all the
-- existing scope assessment + auto-trigger plumbing works unchanged.

create table if not exists public.job_videos (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  job_id          uuid not null references public.jobs(id) on delete cascade,
  storage_path    text not null,                  -- supabase storage key for original video
  thumbnail_path  text,                           -- poster image (first frame)
  duration_sec    numeric(8,2),
  notes           text,
  uploaded_by     uuid references public.profiles(id) on delete set null
);
create index if not exists idx_job_videos_job on public.job_videos(job_id, created_at desc);
alter table public.job_videos enable row level security;

-- Link extracted frames back to source video so the UI can group / replay
alter table public.job_photos add column if not exists source_video_id uuid references public.job_videos(id) on delete set null;
alter table public.job_photos add column if not exists frame_timestamp_sec numeric(8,2);
create index if not exists idx_job_photos_source_video on public.job_photos(source_video_id);

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename='job_videos' and policyname='auth all job videos'
  ) then
    create policy "auth all job videos"
      on public.job_videos for all
      using (auth.role() = 'authenticated');
  end if;
end $$;
