-- Feature: Personal team library outside tournaments.
--
-- Run this in the Supabase SQL Editor.
-- It allows `team_sheets` rows without tournament/member assignment, owned by
-- the current profile. Those rows act as private reusable team templates.

alter table team_sheets
  alter column tournament_id drop not null,
  alter column member_id drop not null;

drop policy if exists "sheets_insert_own" on team_sheets;
drop policy if exists "sheets_select_scoped" on team_sheets;
drop policy if exists "sheets_update_self_or_host" on team_sheets;
drop policy if exists "sheets_update_own_unlocked_or_host" on team_sheets;
drop policy if exists "sheets_delete_own_or_host" on team_sheets;

create policy "sheets_select_scoped"
  on team_sheets for select
  using (
    profile_id = auth.uid()
    or (tournament_id is not null and is_host_of(tournament_id))
    or (visibility = 'public')
    or (tournament_id is not null and visibility = 'tournament' and is_member_of(tournament_id))
  );

create policy "sheets_insert_own"
  on team_sheets for insert
  with check (
    profile_id = auth.uid()
    and (
      (tournament_id is null and member_id is null and visibility = 'private')
      or (tournament_id is not null and member_id is not null and is_member_of(tournament_id))
    )
  );

create policy "sheets_update_own_unlocked_or_host"
  on team_sheets for update
  using (
    (profile_id = auth.uid() and not is_locked)
    or (tournament_id is not null and is_host_of(tournament_id))
  )
  with check (
    profile_id = auth.uid()
    or (tournament_id is not null and is_host_of(tournament_id))
  );

create policy "sheets_delete_own_or_host"
  on team_sheets for delete
  using (
    profile_id = auth.uid()
    or (tournament_id is not null and is_host_of(tournament_id))
  );
