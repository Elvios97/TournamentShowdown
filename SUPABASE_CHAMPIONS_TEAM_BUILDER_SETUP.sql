-- Champions Team Builder setup.
--
-- Run this in the Supabase SQL Editor if Champions teams cannot be created
-- because team_sheets columns or personal-team permissions are missing.
--
-- This migration is intentionally repeatable. It combines the minimum required
-- parts from:
-- - SUPABASE_FIX_PERSONAL_TEAMS.sql
-- - SUPABASE_TEAM_BUILDER_STATS.sql

begin;

alter table public.team_sheets
  alter column tournament_id drop not null,
  alter column member_id drop not null;

alter table public.team_sheets
  add column if not exists team_mode text not null default 'standard',
  add column if not exists battle_format text not null default 'singles',
  add column if not exists rules_profile text not null default 'open';

alter table public.team_sheets
  drop constraint if exists team_sheets_team_mode_check,
  add constraint team_sheets_team_mode_check
    check (team_mode in ('standard', 'champions'));

alter table public.team_sheets
  drop constraint if exists team_sheets_battle_format_check,
  add constraint team_sheets_battle_format_check
    check (battle_format in ('singles', 'doubles'));

alter table public.team_sheets
  drop constraint if exists team_sheets_rules_profile_check,
  add constraint team_sheets_rules_profile_check
    check (rules_profile in ('open', 'current', 'champions'));

create index if not exists idx_sheets_profile_mode
  on public.team_sheets(profile_id, team_mode)
  where tournament_id is null;

create index if not exists idx_sheets_public_mode
  on public.team_sheets(team_mode, updated_at desc)
  where visibility = 'public';

drop policy if exists "sheets_insert_own" on public.team_sheets;
drop policy if exists "sheets_select_scoped" on public.team_sheets;
drop policy if exists "sheets_update_self_or_host" on public.team_sheets;
drop policy if exists "sheets_update_own_unlocked_or_host" on public.team_sheets;
drop policy if exists "sheets_delete_own_or_host" on public.team_sheets;

create policy "sheets_select_scoped"
  on public.team_sheets for select
  using (
    profile_id = auth.uid()
    or (tournament_id is not null and public.is_host_of(tournament_id))
    or (visibility = 'public')
    or (tournament_id is not null and visibility = 'tournament' and public.is_member_of(tournament_id))
  );

create policy "sheets_insert_own"
  on public.team_sheets for insert
  with check (
    profile_id = auth.uid()
    and (
      (tournament_id is null and member_id is null and visibility = 'private')
      or (tournament_id is not null and member_id is not null and public.is_member_of(tournament_id))
    )
  );

create policy "sheets_update_own_unlocked_or_host"
  on public.team_sheets for update
  using (
    (profile_id = auth.uid() and not is_locked)
    or (tournament_id is not null and public.is_host_of(tournament_id))
  )
  with check (
    profile_id = auth.uid()
    or (tournament_id is not null and public.is_host_of(tournament_id))
  );

create policy "sheets_delete_own_or_host"
  on public.team_sheets for delete
  using (
    profile_id = auth.uid()
    or (tournament_id is not null and public.is_host_of(tournament_id))
  );

alter table public.pokemon_sets
  add column if not exists form_pokemon_id text,
  add column if not exists level integer not null default 50,
  add column if not exists ivs jsonb not null default '{}'::jsonb,
  add column if not exists dvs jsonb not null default '{}'::jsonb;

alter table public.pokemon_sets
  drop constraint if exists pokemon_sets_level_check,
  add constraint pokemon_sets_level_check
    check (level between 1 and 100);

commit;
