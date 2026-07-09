-- Fix: Allow tournament owners to add themselves as host member.
--
-- Symptom:
-- - Creating a private/unlisted tournament inserts the row in `tournaments`,
--   but the follow-up insert into `tournament_members` fails with 403.
--
-- Cause:
-- - The original `members_insert_self_public_tournament` policy only allows
--   self-joining public tournaments. The creator membership for private or
--   unlisted tournaments needs a separate rule.

drop policy if exists "members_insert_owner_as_host" on tournament_members;

create policy "members_insert_owner_as_host"
  on tournament_members for insert
  with check (
    profile_id = auth.uid()
    and role = 'host'
    and exists (
      select 1
      from tournaments t
      where t.id = tournament_id
        and t.owner_id = auth.uid()
    )
  );
