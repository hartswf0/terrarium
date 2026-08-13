-- TERRARIUM III durable artifact schema
-- PROVISIONAL / DEMO RESEARCH INFRASTRUCTURE
--
-- This table stores semantically meaningful authored artifacts only.
-- It is NOT the live game state and must never become required for WebRTC.
-- Apply in the Supabase SQL Editor after enabling Anonymous Sign-Ins.

create table if not exists public.iii_artifacts (
  id uuid primary key,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  room_code text,
  session_id text,
  artifact_type text not null,
  prompt text,
  geometry_json jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  client_version text,
  parent_id uuid references public.iii_artifacts(id) on delete set null,

  constraint iii_artifacts_type_check
    check (artifact_type in ('prompt', 'geometry', 'build', 'world_snapshot')),
  constraint iii_artifacts_room_code_len
    check (room_code is null or char_length(room_code) <= 64),
  constraint iii_artifacts_session_id_len
    check (session_id is null or char_length(session_id) <= 128),
  constraint iii_artifacts_prompt_len
    check (prompt is null or char_length(prompt) <= 20000),
  constraint iii_artifacts_client_version_len
    check (client_version is null or char_length(client_version) <= 96)
);

comment on table public.iii_artifacts is
  'PROVISIONAL TERRARIUM III append-only authored artifact lineage; never live world state.';

create index if not exists iii_artifacts_user_created_idx
  on public.iii_artifacts (user_id, created_at desc);

create index if not exists iii_artifacts_room_created_idx
  on public.iii_artifacts (room_code, created_at desc)
  where room_code is not null;

create index if not exists iii_artifacts_parent_idx
  on public.iii_artifacts (parent_id)
  where parent_id is not null;

alter table public.iii_artifacts enable row level security;

-- The browser's publishable key by itself gets no durable artifact access.
revoke all on table public.iii_artifacts from anon;

-- Anonymous sign-ins receive the authenticated Postgres role, so they get only
-- SELECT + INSERT. No UPDATE or DELETE grant keeps this client path append-only.
grant select, insert on table public.iii_artifacts to authenticated;

-- Idempotent policy replacement for repeated demo setup.
drop policy if exists "iii_artifacts_select_own" on public.iii_artifacts;
create policy "iii_artifacts_select_own"
  on public.iii_artifacts
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
  );

drop policy if exists "iii_artifacts_insert_own" on public.iii_artifacts;
create policy "iii_artifacts_insert_own"
  on public.iii_artifacts
  for insert
  to authenticated
  with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = user_id
  );

-- Deliberately no browser UPDATE or DELETE policy.
-- A trusted administrative/research export path may use the Supabase dashboard,
-- SQL Editor, or another server-side credential. Never expose service_role in III.
