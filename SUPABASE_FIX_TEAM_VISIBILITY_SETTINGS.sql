-- Fix: Turnier-Einstellungen fuer Open Team Sheets auch in RLS erzwingen.
--
-- Ziel:
-- - Host/Admin sieht alle Turnier-Teams.
-- - Spieler sieht immer sein eigenes Sheet.
-- - Andere Turnier-Sheets sind nur sichtbar, wenn show_open_sheets = true.
-- - Wenn hide_teams_until_start = true, sind fremde Teams waehrend status = setup
--   verborgen.
-- - Pokemon-Sets folgen derselben Sichtbarkeit wie das zugehoerige Sheet.

create or replace function current_profile_id()
returns uuid language sql security definer stable set search_path = public as $$
  select p.id
  from profiles p
  where p.user_id = auth.uid()
     or p.id = auth.uid()
  order by case when p.user_id = auth.uid() then 0 else 1 end
  limit 1;
$$;

create or replace function is_member_of(p_tournament_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from tournament_members m
    where m.tournament_id = p_tournament_id
      and m.profile_id = current_profile_id()
  );
$$;

create or replace function is_host_of(p_tournament_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from tournament_members m
    where m.tournament_id = p_tournament_id
      and m.profile_id = current_profile_id()
      and m.role = 'host'
  ) or exists (
    select 1
    from tournaments t
    where t.id = p_tournament_id
      and t.owner_id = current_profile_id()
  );
$$;

drop policy if exists "sheets_select_scoped" on team_sheets;

create policy "sheets_select_scoped"
  on team_sheets for select
  using (
    public.is_admin()
    or profile_id = current_profile_id()
    or (tournament_id is not null and is_host_of(tournament_id))
    or (
      tournament_id is null
      and visibility = 'public'
    )
    or (
      tournament_id is not null
      and visibility in ('tournament', 'public')
      and is_member_of(tournament_id)
      and exists (
        select 1
        from tournaments t
        where t.id = team_sheets.tournament_id
          and t.show_open_sheets = true
          and (t.hide_teams_until_start = false or t.status <> 'setup')
      )
    )
  );

drop policy if exists "sets_select_follow_sheet" on pokemon_sets;
drop policy if exists "sets_select_via_sheet" on pokemon_sets;

create policy "sets_select_follow_sheet"
  on pokemon_sets for select
  using (
    exists (
      select 1
      from team_sheets s
      where s.id = pokemon_sets.team_sheet_id
        and (
          public.is_admin()
          or s.profile_id = current_profile_id()
          or (s.tournament_id is not null and is_host_of(s.tournament_id))
          or (
            s.tournament_id is null
            and s.visibility = 'public'
          )
          or (
            s.tournament_id is not null
            and s.visibility in ('tournament', 'public')
            and is_member_of(s.tournament_id)
            and exists (
              select 1
              from tournaments t
              where t.id = s.tournament_id
                and t.show_open_sheets = true
                and (t.hide_teams_until_start = false or t.status <> 'setup')
            )
          )
        )
    )
  );

notify pgrst, 'reload schema';
