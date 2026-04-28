-- Inputs the dispatcher provides before Argus analyzes photos.
-- Locks down Claude's biggest assumptions (ceiling height, property type, age).
alter table public.jobs add column if not exists dispatch_inputs jsonb;
