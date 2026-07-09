-- ==========================================================================
-- Public-Beta Security Hardening
-- Als LETZTE Migration nach allen bisherigen SUPABASE_*.sql-Dateien ausführen.
-- Konsolidiert RLS, verhindert Rollen-Eskalation und definiert die endgültige
-- atomare Draft-Pick-Funktion.
-- ==========================================================================

begin;

-- --------------------------------------------------------------------------
-- Identität und Berechtigungshelfer
-- --------------------------------------------------------------------------
create or replace function public.current_profile_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select p.id
  from public.profiles p
  where p.user_id = (select auth.uid()) or p.id = (select auth.uid())
  order by case when p.user_id = (select auth.uid()) then 0 else 1 end
  limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = public.current_profile_id() and p.global_role = 'admin'
  );
$$;

create or replace function public.is_member_of(p_tournament_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.tournament_members m
    where m.tournament_id = p_tournament_id
      and m.profile_id = public.current_profile_id()
  );
$$;

create or replace function public.is_host_of(p_tournament_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.tournaments t
    where t.id = p_tournament_id and t.owner_id = public.current_profile_id()
  ) or exists (
    select 1 from public.tournament_members m
    where m.tournament_id = p_tournament_id
      and m.profile_id = public.current_profile_id()
      and m.role = 'host'
  );
$$;

revoke all on function public.current_profile_id() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_member_of(uuid) from public;
revoke all on function public.is_host_of(uuid) from public;
grant execute on function public.current_profile_id() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_member_of(uuid) to authenticated;
grant execute on function public.is_host_of(uuid) to authenticated;

-- --------------------------------------------------------------------------
-- Fehlende Integritätsregeln aus älteren Installationen nachziehen
-- --------------------------------------------------------------------------
alter table public.team_sheets add column if not exists ruleset_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'team_sheets_ruleset_id_fkey'
      and conrelid = 'public.team_sheets'::regclass
  ) then
    alter table public.team_sheets
      add constraint team_sheets_ruleset_id_fkey
      foreign key (ruleset_id) references public.rulesets(id) on delete set null;
  end if;
end $$;

create index if not exists idx_team_sheets_ruleset
  on public.team_sheets(ruleset_id) where ruleset_id is not null;
create unique index if not exists idx_draft_picks_session_number
  on public.draft_picks(draft_session_id, pick_number);
create index if not exists idx_draft_sessions_tournament
  on public.draft_sessions(tournament_id);

-- Ein bestehendes Turnier darf nicht per direktem Update einem anderen Owner
-- zugewiesen werden. Bewusste Admin-Migrationen bleiben möglich.
create or replace function public.enforce_tournament_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() and new.owner_id is distinct from old.owner_id then
    raise exception 'Turnier-Owner darf nicht verändert werden.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_tournament_owner on public.tournaments;
create trigger trg_enforce_tournament_owner
  before update on public.tournaments
  for each row execute function public.enforce_tournament_owner();

-- Scope-Felder eines Team-Sheets dürfen nach Erstellung nicht umgehängt werden.
create or replace function public.enforce_team_sheet_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then return new; end if;
  if new.profile_id is distinct from old.profile_id
     or new.tournament_id is distinct from old.tournament_id
     or new.member_id is distinct from old.member_id then
    raise exception 'Team-Zuordnung darf nicht verändert werden.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_team_sheet_scope on public.team_sheets;
create trigger trg_enforce_team_sheet_scope
  before update on public.team_sheets
  for each row execute function public.enforce_team_sheet_scope();

-- Draft-Konfiguration muss vollständig zum selben Turnier gehören.
create or replace function public.validate_draft_session_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_count integer;
  v_distinct_count integer;
  v_valid_count integer;
begin
  if new.pool_id is null or not exists (
    select 1 from public.draft_pools p
    where p.id = new.pool_id and p.tournament_id = new.tournament_id
  ) then raise exception 'Draft-Pool gehört nicht zum Turnier.'; end if;

  if new.ruleset_id is null or not exists (
    select 1 from public.rulesets r
    where r.id = new.ruleset_id and r.tournament_id = new.tournament_id
  ) then raise exception 'Ruleset gehört nicht zum Turnier.'; end if;

  v_order_count := coalesce(array_length(new.pick_order, 1), 0);
  if v_order_count = 0 then raise exception 'Pick-Reihenfolge ist leer.'; end if;

  select count(distinct member_id) into v_distinct_count
  from unnest(new.pick_order) as member_id;
  if v_distinct_count <> v_order_count then
    raise exception 'Pick-Reihenfolge enthält Duplikate.';
  end if;

  select count(*) into v_valid_count
  from public.tournament_members m
  where m.id = any(new.pick_order)
    and m.tournament_id = new.tournament_id
    and m.role <> 'viewer';
  if v_valid_count <> v_order_count then
    raise exception 'Pick-Reihenfolge enthält ungültige Teilnehmer.';
  end if;

  if new.current_pick_index < 0 then
    raise exception 'Ungültiger Draft-Fortschritt.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_draft_session_scope on public.draft_sessions;
create trigger trg_validate_draft_session_scope
  before insert or update of tournament_id, pool_id, ruleset_id, pick_order, current_pick_index
  on public.draft_sessions
  for each row execute function public.validate_draft_session_scope();

-- --------------------------------------------------------------------------
-- Alle alten, additiven Policies entfernen und deterministisch neu anlegen
-- --------------------------------------------------------------------------
do $$
declare
  v_table text;
  v_policy record;
begin
  foreach v_table in array array[
    'profiles','tournaments','tournament_members','draft_pools',
    'draft_pool_pokemon','rulesets','team_sheets','pokemon_sets','matches',
    'invite_codes','draft_sessions','draft_picks','trade_offers'
  ] loop
    if to_regclass('public.' || v_table) is not null then
      execute format('alter table public.%I enable row level security', v_table);
      for v_policy in
        select policyname from pg_policies
        where schemaname = 'public' and tablename = v_table
      loop
        execute format('drop policy %I on public.%I', v_policy.policyname, v_table);
      end loop;
    end if;
  end loop;
end $$;

-- Profile: Verzeichnis nur für angemeldete Nutzer, Änderungen nur am eigenen Profil.
create policy profiles_read_authenticated on public.profiles
  for select to authenticated using (true);
create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (id = (select auth.uid()) and user_id = (select auth.uid()));
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = public.current_profile_id())
  with check (id = public.current_profile_id() and user_id = (select auth.uid()));
create policy profiles_admin_all on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Turniere: öffentliche Listen nur nach Login; Schreiben nur Owner/Host/Admin.
create policy tournaments_read_visible on public.tournaments
  for select to authenticated using (
    public.is_admin() or owner_id = public.current_profile_id()
    or public.is_member_of(id) or visibility in ('public','unlisted')
  );
create policy tournaments_insert_owner on public.tournaments
  for insert to authenticated with check (owner_id = public.current_profile_id());
create policy tournaments_update_host on public.tournaments
  for update to authenticated
  using (public.is_admin() or public.is_host_of(id))
  with check (public.is_admin() or public.is_host_of(id));
create policy tournaments_delete_owner on public.tournaments
  for delete to authenticated
  using (public.is_admin() or owner_id = public.current_profile_id());

-- Mitglieder: Self-Join ausschließlich als Player; Rollenänderung ausschließlich Host/Admin.
create policy members_read_visible on public.tournament_members
  for select to authenticated using (
    public.is_admin() or public.is_member_of(tournament_id)
    or public.is_host_of(tournament_id)
    or exists (
      select 1 from public.tournaments t
      where t.id = tournament_id and t.visibility in ('public','unlisted')
    )
  );
create policy members_insert_self_public_as_player on public.tournament_members
  for insert to authenticated with check (
    profile_id = public.current_profile_id() and role = 'player'
    and exists (
      select 1 from public.tournaments t
      where t.id = tournament_id and t.visibility = 'public'
    )
  );
create policy members_insert_owner_as_player on public.tournament_members
  for insert to authenticated with check (
    profile_id = public.current_profile_id() and role = 'player'
    and public.is_host_of(tournament_id)
  );
create policy members_update_host_only on public.tournament_members
  for update to authenticated
  using (public.is_admin() or public.is_host_of(tournament_id))
  with check (public.is_admin() or public.is_host_of(tournament_id));
create policy members_delete_self_or_host on public.tournament_members
  for delete to authenticated using (
    public.is_admin() or profile_id = public.current_profile_id()
    or public.is_host_of(tournament_id)
  );

-- Pools und enthaltene Pokémon.
create policy pools_read_visible on public.draft_pools
  for select to authenticated using (
    public.is_admin() or owner_id = public.current_profile_id()
    or (is_template and visibility = 'public')
    or (tournament_id is not null and public.is_member_of(tournament_id))
  );
create policy pools_write_owner_host on public.draft_pools
  for all to authenticated
  using (public.is_admin() or owner_id = public.current_profile_id() or (tournament_id is not null and public.is_host_of(tournament_id)))
  with check (public.is_admin() or owner_id = public.current_profile_id() or (tournament_id is not null and public.is_host_of(tournament_id)));
create policy pool_pokemon_read_via_pool on public.draft_pool_pokemon
  for select to authenticated using (exists (
    select 1 from public.draft_pools p where p.id = pool_id and (
      public.is_admin() or p.owner_id = public.current_profile_id()
      or (p.is_template and p.visibility = 'public')
      or (p.tournament_id is not null and public.is_member_of(p.tournament_id))
    )
  ));
create policy pool_pokemon_write_via_pool on public.draft_pool_pokemon
  for all to authenticated
  using (exists (select 1 from public.draft_pools p where p.id = pool_id and (public.is_admin() or p.owner_id = public.current_profile_id() or (p.tournament_id is not null and public.is_host_of(p.tournament_id)))))
  with check (exists (select 1 from public.draft_pools p where p.id = pool_id and (public.is_admin() or p.owner_id = public.current_profile_id() or (p.tournament_id is not null and public.is_host_of(p.tournament_id)))));

-- Rulesets.
create policy rulesets_read_visible on public.rulesets
  for select to authenticated using (
    public.is_admin() or owner_id = public.current_profile_id()
    or (is_template and visibility = 'public')
    or (tournament_id is not null and public.is_member_of(tournament_id))
  );
create policy rulesets_write_owner_host on public.rulesets
  for all to authenticated
  using (public.is_admin() or owner_id = public.current_profile_id() or (tournament_id is not null and public.is_host_of(tournament_id)))
  with check (public.is_admin() or owner_id = public.current_profile_id() or (tournament_id is not null and public.is_host_of(tournament_id)));

-- Team-Sheets: anonyme Nutzer sehen ausschließlich bewusst öffentliche persönliche Teams.
create policy sheets_read_public_anon on public.team_sheets
  for select to anon using (tournament_id is null and visibility = 'public');
create policy sheets_read_scoped_authenticated on public.team_sheets
  for select to authenticated using (
    public.is_admin() or profile_id = public.current_profile_id()
    or (tournament_id is null and visibility = 'public')
    or (tournament_id is not null and public.is_host_of(tournament_id))
    or (
      tournament_id is not null and visibility in ('tournament','public')
      and public.is_member_of(tournament_id)
      and exists (
        select 1 from public.tournaments t
        where t.id = tournament_id and t.show_open_sheets = true
          and (t.hide_teams_until_start = false or t.status <> 'setup')
      )
    )
  );
create policy sheets_insert_own on public.team_sheets
  for insert to authenticated with check (
    profile_id = public.current_profile_id() and (
      (tournament_id is null and member_id is null and visibility = 'private')
      or (
        tournament_id is not null and member_id is not null
        and exists (
          select 1 from public.tournament_members m
          where m.id = member_id and m.tournament_id = team_sheets.tournament_id
            and m.profile_id = public.current_profile_id()
        )
      )
    )
  );
create policy sheets_update_owner_host on public.team_sheets
  for update to authenticated
  using (public.is_admin() or (profile_id = public.current_profile_id() and not is_locked) or (tournament_id is not null and public.is_host_of(tournament_id)))
  with check (public.is_admin() or profile_id = public.current_profile_id() or (tournament_id is not null and public.is_host_of(tournament_id)));
create policy sheets_delete_owner_host on public.team_sheets
  for delete to authenticated using (public.is_admin() or profile_id = public.current_profile_id() or (tournament_id is not null and public.is_host_of(tournament_id)));

create policy sets_read_public_anon on public.pokemon_sets
  for select to anon using (exists (
    select 1 from public.team_sheets s
    where s.id = team_sheet_id and s.tournament_id is null and s.visibility = 'public'
  ));
create policy sets_read_via_sheet_authenticated on public.pokemon_sets
  for select to authenticated using (exists (
    select 1 from public.team_sheets s where s.id = team_sheet_id and (
      public.is_admin() or s.profile_id = public.current_profile_id()
      or (s.tournament_id is null and s.visibility = 'public')
      or (s.tournament_id is not null and public.is_host_of(s.tournament_id))
      or (
        s.tournament_id is not null and s.visibility in ('tournament','public')
        and public.is_member_of(s.tournament_id)
        and exists (
          select 1 from public.tournaments t where t.id = s.tournament_id
            and t.show_open_sheets = true
            and (t.hide_teams_until_start = false or t.status <> 'setup')
        )
      )
    )
  ));
create policy sets_write_via_sheet on public.pokemon_sets
  for all to authenticated
  using (exists (
    select 1 from public.team_sheets s where s.id = team_sheet_id
      and (public.is_admin() or (s.profile_id = public.current_profile_id() and not s.is_locked) or (s.tournament_id is not null and public.is_host_of(s.tournament_id)))
  ))
  with check (exists (
    select 1 from public.team_sheets s where s.id = team_sheet_id
      and (public.is_admin() or (s.profile_id = public.current_profile_id() and not s.is_locked) or (s.tournament_id is not null and public.is_host_of(s.tournament_id)))
  ));

-- Matches, Einladungen, Draft und Trades bleiben vollständig turniergebunden.
create policy matches_read_members on public.matches
  for select to authenticated using (public.is_admin() or public.is_member_of(tournament_id) or public.is_host_of(tournament_id));
create policy matches_write_host on public.matches
  for all to authenticated using (public.is_admin() or public.is_host_of(tournament_id)) with check (public.is_admin() or public.is_host_of(tournament_id));
create policy invites_host_only on public.invite_codes
  for all to authenticated using (public.is_admin() or public.is_host_of(tournament_id)) with check (public.is_admin() or public.is_host_of(tournament_id));
create policy draft_sessions_read_members on public.draft_sessions
  for select to authenticated using (public.is_admin() or public.is_member_of(tournament_id) or public.is_host_of(tournament_id));
create policy draft_sessions_write_host on public.draft_sessions
  for all to authenticated using (public.is_admin() or public.is_host_of(tournament_id)) with check (public.is_admin() or public.is_host_of(tournament_id));
create policy draft_picks_read_members on public.draft_picks
  for select to authenticated using (exists (
    select 1 from public.draft_sessions s where s.id = draft_session_id
      and (public.is_admin() or public.is_member_of(s.tournament_id) or public.is_host_of(s.tournament_id))
  ));
create policy draft_picks_write_host on public.draft_picks
  for all to authenticated
  using (exists (select 1 from public.draft_sessions s where s.id = draft_session_id and (public.is_admin() or public.is_host_of(s.tournament_id))))
  with check (exists (select 1 from public.draft_sessions s where s.id = draft_session_id and (public.is_admin() or public.is_host_of(s.tournament_id))));

do $$
begin
  if to_regclass('public.trade_offers') is not null then
    execute 'create policy trade_offers_read_members on public.trade_offers for select to authenticated using (public.is_admin() or public.is_member_of(tournament_id) or public.is_host_of(tournament_id))';
  end if;
end $$;

-- --------------------------------------------------------------------------
-- Endgültige atomare Multiplayer-Pick-RPC
-- --------------------------------------------------------------------------
create or replace function public.make_draft_pick(p_session_id uuid, p_pokemon_id text)
returns public.draft_picks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.draft_sessions;
  v_rules public.rulesets;
  v_mon public.draft_pool_pokemon;
  v_pick public.draft_picks;
  v_player_count integer;
  v_round integer;
  v_position integer;
  v_member_id uuid;
  v_spent integer;
  v_is_current_player boolean;
begin
  if (select auth.uid()) is null then raise exception 'Du musst angemeldet sein.'; end if;

  select * into v_session from public.draft_sessions
  where id = p_session_id for update;
  if not found then raise exception 'Draft-Runde nicht gefunden.'; end if;
  if v_session.status <> 'active' then raise exception 'Der Draft ist nicht aktiv.'; end if;

  select * into v_rules from public.rulesets
  where id = v_session.ruleset_id and tournament_id = v_session.tournament_id;
  if not found then raise exception 'Ungültiges Draft-Regelset.'; end if;
  if not exists (
    select 1 from public.draft_pools p
    where p.id = v_session.pool_id and p.tournament_id = v_session.tournament_id
  ) then raise exception 'Ungültiger Draft-Pool.'; end if;

  v_player_count := coalesce(array_length(v_session.pick_order, 1), 0);
  if v_player_count = 0 then raise exception 'Keine Pick-Reihenfolge hinterlegt.'; end if;
  v_round := v_session.current_pick_index / v_player_count;
  v_position := v_session.current_pick_index % v_player_count;
  if coalesce(v_rules.draft_mode, 'snake') = 'snake' and (v_round % 2) = 1 then
    v_member_id := v_session.pick_order[v_player_count - v_position];
  else
    v_member_id := v_session.pick_order[v_position + 1];
  end if;

  select exists (
    select 1 from public.tournament_members m
    where m.id = v_member_id and m.tournament_id = v_session.tournament_id
      and m.profile_id = public.current_profile_id() and m.role <> 'viewer'
  ) into v_is_current_player;
  if not public.is_admin() and not public.is_host_of(v_session.tournament_id) and not v_is_current_player then
    raise exception 'Du bist noch nicht mit deinem Pick an der Reihe.';
  end if;

  select * into v_mon from public.draft_pool_pokemon
  where pool_id = v_session.pool_id and pokemon_id = p_pokemon_id and not is_banned;
  if not found then raise exception 'Pokémon ist im aktiven Pool nicht verfügbar.'; end if;
  if not coalesce(v_rules.allow_duplicates, false) and exists (
    select 1 from public.draft_picks
    where draft_session_id = p_session_id and pokemon_id = p_pokemon_id
  ) then raise exception 'Pokémon wurde bereits gepickt.'; end if;
  if (select count(*) from public.draft_picks where draft_session_id = p_session_id and member_id = v_member_id) >= v_rules.team_size then
    raise exception 'Das Team ist bereits voll.';
  end if;

  select coalesce(sum(coalesce(pp.cost, 0)), 0) into v_spent
  from public.draft_picks dp
  left join public.draft_pool_pokemon pp
    on pp.pool_id = v_session.pool_id and pp.pokemon_id = dp.pokemon_id
  where dp.draft_session_id = p_session_id and dp.member_id = v_member_id;
  if v_rules.points_budget is not null and v_spent + coalesce(v_mon.cost, 0) > v_rules.points_budget then
    raise exception 'Der Pick überschreitet das Punktebudget.';
  end if;

  insert into public.draft_picks(draft_session_id, member_id, pokemon_id, pokemon_name, pick_number)
  values (p_session_id, v_member_id, v_mon.pokemon_id, v_mon.pokemon_name, v_session.current_pick_index + 1)
  returning * into v_pick;

  update public.draft_sessions set
    current_pick_index = current_pick_index + 1,
    status = case when current_pick_index + 1 >= v_player_count * v_rules.team_size then 'completed' else status end
  where id = p_session_id;
  return v_pick;
end;
$$;

revoke all on function public.make_draft_pick(uuid, text) from public;
revoke all on function public.make_draft_pick(uuid, text) from anon;
grant execute on function public.make_draft_pick(uuid, text) to authenticated;

-- Direkte Tabellenrechte explizit begrenzen. RLS entscheidet zusätzlich zeilenweise.
revoke all on public.profiles, public.tournaments, public.tournament_members,
  public.draft_pools, public.draft_pool_pokemon, public.rulesets,
  public.team_sheets, public.pokemon_sets, public.matches, public.invite_codes,
  public.draft_sessions, public.draft_picks from anon;
grant select on public.team_sheets, public.pokemon_sets to anon;

grant select, insert, update, delete on public.profiles, public.tournaments,
  public.tournament_members, public.draft_pools, public.draft_pool_pokemon,
  public.rulesets, public.team_sheets, public.pokemon_sets, public.matches,
  public.invite_codes, public.draft_sessions, public.draft_picks to authenticated;

do $$
begin
  if to_regclass('public.trade_offers') is not null then
    execute 'revoke all on public.trade_offers from anon';
    execute 'grant select on public.trade_offers to authenticated';
  end if;
end $$;

-- Ältere Installationen besitzen diese RPC teilweise nicht oder mit einer
-- anderen Signatur. Alle vorhandenen Varianten werden sicher behandelt.
do $$
declare
  v_function record;
begin
  for v_function in
    select p.oid::regprocedure::text as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_tournament_with_host'
  loop
    execute format('revoke execute on function %s from anon', v_function.signature);
    execute format('grant execute on function %s to authenticated', v_function.signature);
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;
