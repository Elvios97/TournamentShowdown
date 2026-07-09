-- Fix: Owners must be able to manage tournaments without being tournament members.
--
-- Run this in the Supabase SQL Editor.
-- It keeps tournament creation separate from participant membership, while
-- allowing the owner to read/manage member-scoped tournament data.

drop policy if exists "members_select_within_tournament" on tournament_members;

create policy "members_select_within_tournament"
  on tournament_members for select
  using (
    is_member_of(tournament_id)
    or is_host_of(tournament_id)
    or exists (
      select 1
      from tournaments t
      where t.id = tournament_id
        and t.visibility in ('public','unlisted')
    )
  );

drop policy if exists "members_insert_owner_as_player" on tournament_members;

create policy "members_insert_owner_as_player"
  on tournament_members for insert
  with check (
    profile_id = auth.uid()
    and role = 'player'
    and is_host_of(tournament_id)
  );

notify pgrst, 'reload schema';
