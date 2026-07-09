-- Multiplayer-Draft: Spieler duerfen nur im eigenen Zug picken.
-- Realtime veroeffentlicht Session-, Pick- und Tauschaenderungen.

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
  v_is_host boolean;
  v_is_current_player boolean;
begin
  if auth.uid() is null then
    raise exception 'Du musst angemeldet sein.';
  end if;

  select * into v_session
  from public.draft_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Draft-Runde nicht gefunden.';
  end if;
  if v_session.status <> 'active' then
    raise exception 'Der Draft ist nicht aktiv.';
  end if;

  select * into v_rules from public.rulesets where id = v_session.ruleset_id;
  v_player_count := coalesce(array_length(v_session.pick_order, 1), 0);
  if v_player_count = 0 then
    raise exception 'Keine Pick-Reihenfolge hinterlegt.';
  end if;

  v_round := v_session.current_pick_index / v_player_count;
  v_position := v_session.current_pick_index % v_player_count;
  if coalesce(v_rules.draft_mode, 'snake') = 'snake' and (v_round % 2) = 1 then
    v_member_id := v_session.pick_order[v_player_count - v_position];
  else
    v_member_id := v_session.pick_order[v_position + 1];
  end if;

  v_is_host := public.is_host_of(v_session.tournament_id) or public.is_admin();
  select exists (
    select 1 from public.tournament_members tm
    where tm.id = v_member_id
      and tm.tournament_id = v_session.tournament_id
      and tm.profile_id = auth.uid()
      and tm.role <> 'viewer'
  ) into v_is_current_player;

  if not v_is_host and not v_is_current_player then
    raise exception 'Du bist noch nicht mit deinem Pick an der Reihe.';
  end if;

  select * into v_mon
  from public.draft_pool_pokemon
  where pool_id = v_session.pool_id
    and pokemon_id = p_pokemon_id
    and not is_banned;
  if not found then
    raise exception 'Pokemon ist nicht im aktiven Pool verfuegbar.';
  end if;

  if exists (
    select 1 from public.draft_picks
    where draft_session_id = p_session_id and pokemon_id = p_pokemon_id
  ) and not coalesce(v_rules.allow_duplicates, false) then
    raise exception 'Pokemon wurde bereits gepickt.';
  end if;

  if (
    select count(*) from public.draft_picks
    where draft_session_id = p_session_id and member_id = v_member_id
  ) >= coalesce(v_rules.team_size, 6) then
    raise exception 'Das Team ist bereits voll.';
  end if;

  select coalesce(sum(coalesce(pp.cost, 0)), 0) into v_spent
  from public.draft_picks dp
  left join public.draft_pool_pokemon pp
    on pp.pool_id = v_session.pool_id and pp.pokemon_id = dp.pokemon_id
  where dp.draft_session_id = p_session_id and dp.member_id = v_member_id;

  if v_rules.points_budget is not null
     and v_spent + coalesce(v_mon.cost, 0) > v_rules.points_budget then
    raise exception 'Der Pick ueberschreitet das Punktebudget.';
  end if;

  insert into public.draft_picks
    (draft_session_id, member_id, pokemon_id, pokemon_name, pick_number)
  values
    (p_session_id, v_member_id, v_mon.pokemon_id, v_mon.pokemon_name, v_session.current_pick_index + 1)
  returning * into v_pick;

  update public.draft_sessions
  set current_pick_index = current_pick_index + 1,
      status = case
        when current_pick_index + 1 >= v_player_count * coalesce(v_rules.team_size, 6)
          then 'completed'
        else status
      end
  where id = p_session_id;

  return v_pick;
end;
$$;

revoke all on function public.make_draft_pick(uuid, text) from public;
grant execute on function public.make_draft_pick(uuid, text) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'draft_sessions'
  ) then
    alter publication supabase_realtime add table public.draft_sessions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'draft_picks'
  ) then
    alter publication supabase_realtime add table public.draft_picks;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trade_offers'
  ) then
    alter publication supabase_realtime add table public.trade_offers;
  end if;
end;
$$;
