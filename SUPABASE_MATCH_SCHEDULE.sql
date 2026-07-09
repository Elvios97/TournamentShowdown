-- Automatischer Round-Robin-Spielplan und validierte Ergebnisverwaltung.

create index if not exists idx_matches_tournament_round
  on public.matches (tournament_id, round, created_at);

alter table public.matches
  drop constraint if exists matches_scores_nonnegative,
  add constraint matches_scores_nonnegative
    check ((score_a is null or score_a >= 0) and (score_b is null or score_b >= 0));

create or replace function public.generate_round_robin_schedule(p_tournament_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_players uuid[];
  v_rotated uuid[];
  v_count integer;
  v_round integer;
  v_pair integer;
  v_player_a uuid;
  v_player_b uuid;
  v_created integer := 0;
begin
  if auth.uid() is null then raise exception 'Du musst angemeldet sein.'; end if;
  if not public.is_host_of(p_tournament_id) and not public.is_admin() then
    raise exception 'Nur der Turnier-Host darf den Spielplan erstellen.';
  end if;

  perform 1 from public.tournaments where id = p_tournament_id for update;
  if not found then raise exception 'Turnier nicht gefunden.'; end if;
  if exists (select 1 from public.matches where tournament_id = p_tournament_id) then
    raise exception 'Es existieren bereits Matches. Der Spielplan wurde nicht verändert.';
  end if;

  select array_agg(tm.id order by tm.joined_at, tm.id) into v_players
  from public.tournament_members tm
  where tm.tournament_id = p_tournament_id and tm.role <> 'viewer';

  v_count := coalesce(array_length(v_players, 1), 0);
  if v_count < 2 then raise exception 'Mindestens zwei Spieler werden benötigt.'; end if;
  if (v_count % 2) = 1 then
    v_players := array_append(v_players, null::uuid);
    v_count := v_count + 1;
  end if;

  for v_round in 1..(v_count - 1) loop
    for v_pair in 1..(v_count / 2) loop
      v_player_a := v_players[v_pair];
      v_player_b := v_players[v_count - v_pair + 1];
      if v_player_a is not null and v_player_b is not null then
        -- Heim-/Auswaertsseite abwechseln, damit die Darstellung ausgeglichen ist.
        if (v_round % 2) = 0 then
          insert into public.matches
            (tournament_id, round, player_a_member_id, player_b_member_id, status)
          values
            (p_tournament_id, v_round, v_player_b, v_player_a, 'scheduled');
        else
          insert into public.matches
            (tournament_id, round, player_a_member_id, player_b_member_id, status)
          values
            (p_tournament_id, v_round, v_player_a, v_player_b, 'scheduled');
        end if;
        v_created := v_created + 1;
      end if;
    end loop;

    v_rotated := array[v_players[1], v_players[v_count]] || v_players[2:v_count - 1];
    v_players := v_rotated;
  end loop;

  return v_created;
end;
$$;

create or replace function public.set_match_result(
  p_match_id uuid,
  p_score_a integer,
  p_score_b integer
)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'Match nicht gefunden.'; end if;
  if not public.is_host_of(v_match.tournament_id) and not public.is_admin() then
    raise exception 'Nur der Turnier-Host darf Ergebnisse speichern.';
  end if;
  if p_score_a is null or p_score_b is null or p_score_a < 0 or p_score_b < 0 then
    raise exception 'Ergebnisse müssen nichtnegative ganze Zahlen sein.';
  end if;
  if p_score_a = p_score_b then raise exception 'Ein Unentschieden wird nicht unterstützt.'; end if;
  if v_match.player_a_member_id is null or v_match.player_b_member_id is null then
    raise exception 'Das Match besitzt keine vollständige Paarung.';
  end if;

  update public.matches
  set score_a = p_score_a,
      score_b = p_score_b,
      winner_member_id = case when p_score_a > p_score_b then player_a_member_id else player_b_member_id end,
      status = 'completed'
  where id = p_match_id
  returning * into v_match;
  return v_match;
end;
$$;

create or replace function public.reopen_match(p_match_id uuid)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'Match nicht gefunden.'; end if;
  if not public.is_host_of(v_match.tournament_id) and not public.is_admin() then
    raise exception 'Nur der Turnier-Host darf Ergebnisse korrigieren.';
  end if;

  update public.matches
  set score_a = null, score_b = null, winner_member_id = null, status = 'scheduled'
  where id = p_match_id
  returning * into v_match;
  return v_match;
end;
$$;

revoke all on function public.generate_round_robin_schedule(uuid) from public;
revoke all on function public.set_match_result(uuid, integer, integer) from public;
revoke all on function public.reopen_match(uuid) from public;
grant execute on function public.generate_round_robin_schedule(uuid) to authenticated;
grant execute on function public.set_match_result(uuid, integer, integer) to authenticated;
grant execute on function public.reopen_match(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;
end;
$$;
