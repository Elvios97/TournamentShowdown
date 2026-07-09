-- Fix: Create tournament without automatically creating a member row.
--
-- Run this in the Supabase SQL Editor if tournament creation or owner
-- permissions fail. Membership is now a deliberate later step.

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

create or replace function create_tournament_with_host(
  p_slug text,
  p_name text,
  p_description text default '',
  p_visibility text default 'private',
  p_show_open_sheets boolean default true,
  p_hide_teams_until_start boolean default false
)
returns tournaments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament tournaments;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  insert into tournaments (
    slug,
    name,
    description,
    visibility,
    owner_id,
    show_open_sheets,
    hide_teams_until_start
  )
  values (
    p_slug,
    p_name,
    coalesce(p_description, ''),
    coalesce(p_visibility, 'private'),
    auth.uid(),
    coalesce(p_show_open_sheets, true),
    coalesce(p_hide_teams_until_start, false)
  )
  returning * into v_tournament;

  return v_tournament;
end;
$$;

grant execute on function create_tournament_with_host(
  text,
  text,
  text,
  text,
  boolean,
  boolean
) to authenticated;

grant execute on function create_tournament_with_host(
  text,
  text,
  text,
  text,
  boolean,
  boolean
) to anon;

notify pgrst, 'reload schema';
