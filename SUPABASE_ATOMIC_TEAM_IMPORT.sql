-- ==========================================================================
-- Atomarer Import für persönliche und Turnier-Team-Sheets
-- Nach SUPABASE_PUBLIC_BETA_HARDENING.sql ausführen.
-- ==========================================================================

create or replace function public.replace_team_sheet_pokemon(
  p_sheet_id uuid,
  p_sets jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sheet public.team_sheets;
  v_set jsonb;
  v_evs jsonb;
  v_moves text[];
  v_count integer;
  v_index integer := 0;
  v_max_size integer := 6;
  v_ev_total integer;
begin
  if (select auth.uid()) is null then raise exception 'Du musst angemeldet sein.'; end if;

  select * into v_sheet
  from public.team_sheets
  where id = p_sheet_id
  for update;
  if not found then raise exception 'Team nicht gefunden.'; end if;
  if v_sheet.is_locked and not public.is_admin()
     and not (v_sheet.tournament_id is not null and public.is_host_of(v_sheet.tournament_id)) then
    raise exception 'Das Team ist gesperrt.';
  end if;
  if not public.is_admin()
     and v_sheet.profile_id <> public.current_profile_id()
     and not (v_sheet.tournament_id is not null and public.is_host_of(v_sheet.tournament_id)) then
    raise exception 'Keine Berechtigung für dieses Team.';
  end if;

  if p_sets is null or jsonb_typeof(p_sets) <> 'array' then
    raise exception 'Teamdaten müssen eine Liste sein.';
  end if;
  v_count := jsonb_array_length(p_sets);
  if v_sheet.ruleset_id is not null then
    select team_size into v_max_size from public.rulesets where id = v_sheet.ruleset_id;
    v_max_size := coalesce(v_max_size, 6);
  end if;
  v_max_size := greatest(1, least(v_max_size, 100));
  if v_count = 0 then raise exception 'Das importierte Team enthält keine Pokémon.'; end if;
  if v_count > v_max_size then
    raise exception 'Das Team enthält % Pokémon, erlaubt sind maximal %.', v_count, v_max_size;
  end if;

  -- Erst nach vollständiger Validierung löschen. Jeder Fehler rollt die gesamte
  -- Funktion einschließlich DELETE automatisch zurück.
  for v_set in select value from jsonb_array_elements(p_sets)
  loop
    if jsonb_typeof(v_set) <> 'object' then raise exception 'Ungültiger Pokémon-Eintrag.'; end if;
    if btrim(coalesce(v_set->>'pokemon_id', '')) = ''
       or btrim(coalesce(v_set->>'pokemon_name', '')) = '' then
      raise exception 'Pokémon-ID oder Name fehlt.';
    end if;
    if length(v_set->>'pokemon_id') > 100 or length(v_set->>'pokemon_name') > 100 then
      raise exception 'Pokémon-ID oder Name ist zu lang.';
    end if;

    v_evs := coalesce(v_set->'evs', '{}'::jsonb);
    if jsonb_typeof(v_evs) <> 'object' then raise exception 'EVs müssen ein Objekt sein.'; end if;
    if exists (
      select 1 from jsonb_each_text(v_evs) ev
      where ev.key not in ('HP','Atk','Def','SpA','SpD','Spe')
         or case when ev.value ~ '^\d+$'
              then ev.value::integer not between 0 and 252
              else true
            end
    ) then raise exception 'EV-Werte müssen ganzzahlig zwischen 0 und 252 liegen.'; end if;
    select coalesce(sum(ev.value::integer), 0) into v_ev_total from jsonb_each_text(v_evs) ev;
    if v_ev_total > 510 then raise exception 'EV-Summe % überschreitet 510.', v_ev_total; end if;

    if v_set ? 'moves' and jsonb_typeof(v_set->'moves') <> 'array' then
      raise exception 'Moves müssen eine Liste sein.';
    end if;
    select coalesce(array_agg(btrim(move)), '{}'::text[]) into v_moves
    from jsonb_array_elements_text(coalesce(v_set->'moves', '[]'::jsonb)) as moves(move);
    if coalesce(array_length(v_moves, 1), 0) > 4 then raise exception 'Maximal vier Moves pro Pokémon.'; end if;
    if exists (select 1 from unnest(v_moves) as moves(move) where move = '' or length(move) > 100) then
      raise exception 'Ein Move ist leer oder zu lang.';
    end if;
  end loop;

  delete from public.pokemon_sets where team_sheet_id = p_sheet_id;

  for v_set in select value from jsonb_array_elements(p_sets)
  loop
    v_evs := coalesce(v_set->'evs', '{}'::jsonb);
    select coalesce(array_agg(btrim(move)), '{}'::text[]) into v_moves
    from jsonb_array_elements_text(coalesce(v_set->'moves', '[]'::jsonb)) as moves(move);
    insert into public.pokemon_sets(
      team_sheet_id, pokemon_id, pokemon_name, nickname, item, ability,
      tera_type, nature, evs, moves, notes, sort_order
    ) values (
      p_sheet_id,
      btrim(v_set->>'pokemon_id'),
      btrim(v_set->>'pokemon_name'),
      nullif(left(btrim(coalesce(v_set->>'nickname', '')), 100), ''),
      nullif(left(btrim(coalesce(v_set->>'item', '')), 100), ''),
      nullif(left(btrim(coalesce(v_set->>'ability', '')), 100), ''),
      nullif(left(btrim(coalesce(v_set->>'tera_type', '')), 30), ''),
      nullif(left(btrim(coalesce(v_set->>'nature', '')), 50), ''),
      v_evs,
      v_moves,
      left(coalesce(v_set->>'notes', ''), 2000),
      v_index
    );
    v_index := v_index + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.replace_team_sheet_pokemon(uuid, jsonb) from public;
revoke all on function public.replace_team_sheet_pokemon(uuid, jsonb) from anon;
grant execute on function public.replace_team_sheet_pokemon(uuid, jsonb) to authenticated;
notify pgrst, 'reload schema';
