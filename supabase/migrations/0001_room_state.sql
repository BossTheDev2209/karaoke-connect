-- room_state: ephemeral snapshot so a room survives reload / solo presence.
create table if not exists public.room_state (
  code text primary key,
  queue jsonb not null default '[]'::jsonb,
  playback jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.room_state enable row level security;

-- Open-by-code model (no auth in this app). Anyone who knows the 4-char code
-- can read/write that room. Acceptable for ephemeral karaoke; documented trade-off.
create policy "room_state anon read"  on public.room_state for select using (true);
create policy "room_state anon write" on public.room_state for insert with check (true);
create policy "room_state anon update" on public.room_state for update using (true) with check (true);

-- Helps a future cleanup job find stale rooms.
create index if not exists room_state_updated_at_idx on public.room_state (updated_at);
