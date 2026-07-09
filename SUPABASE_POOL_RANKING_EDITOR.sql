-- Atomare, validierte Ranking-Aenderungen fuer einen Draft-Pool.

create or replace function public.update_pool_rankings(
  p_pool_id uuid,
  p_entries jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry jsonb;
  v_pokemon_id text;
  v_tier text;
  v_cost integer;
  v_updated integer := 0;
  v_unknown text[] := '{}';
begin
  if not exists (
    select 1 from public.draft_pools p
    where p.id = p_pool_id
      and (
        p.owner_id = auth.uid()
        or (p.tournament_id is not null and public.is_host_of(p.tournament_id))
        or public.is_admin()
      )
  ) then
    raise exception 'Du darfst diesen Pool nicht bearbeiten.';
  end if;

  if jsonb_typeof(p_entries) <> 'array' then
    raise exception 'Ranking-Daten muessen eine Liste sein.';
  end if;
  if jsonb_array_length(p_entries) > 1000 then
    raise exception 'Maximal 1000 Ranking-Eintraege pro Import.';
  end if;

  for v_entry in select value from jsonb_array_elements(p_entries)
  loop
    if jsonb_typeof(v_entry) <> 'object' then
      raise exception 'Jeder Ranking-Eintrag muss ein Objekt sein.';
    end if;
    v_pokemon_id := lower(trim(v_entry->>'pokemon_id'));
    if coalesce(v_pokemon_id, '') = '' then
      raise exception 'pokemon_id fehlt in einem Ranking-Eintrag.';
    end if;

    if v_entry ? 'tier' then
      v_tier := upper(trim(v_entry->>'tier'));
      if v_tier is null or v_tier not in ('S', 'A', 'B', 'C', 'D') then
        raise exception 'Ungueltiges Tier fuer %: %', v_pokemon_id, v_tier;
      end if;
    end if;

    if v_entry ? 'cost' then
      begin
        v_cost := (v_entry->>'cost')::integer;
      exception when others then
        raise exception 'Kosten fuer % muessen eine ganze Zahl sein.', v_pokemon_id;
      end;
      if v_cost is null or v_cost < 0 or v_cost > 100 then
        raise exception 'Kosten fuer % muessen zwischen 0 und 100 liegen.', v_pokemon_id;
      end if;
    end if;

    if v_entry ? 'is_banned' and coalesce(jsonb_typeof(v_entry->'is_banned'), '') <> 'boolean' then
      raise exception 'is_banned fuer % muss true oder false sein.', v_pokemon_id;
    end if;
    if v_entry ? 'tags' then
      if coalesce(jsonb_typeof(v_entry->'tags'), '') <> 'array' then
        raise exception 'tags fuer % muss eine Liste aus Textwerten sein.', v_pokemon_id;
      end if;
      if exists (
        select 1 from jsonb_array_elements(v_entry->'tags') tag
        where jsonb_typeof(tag) <> 'string'
      ) then
        raise exception 'tags fuer % muss eine Liste aus Textwerten sein.', v_pokemon_id;
      end if;
    end if;
    if v_entry ? 'notes' and length(coalesce(v_entry->>'notes', '')) > 1000 then
      raise exception 'Notiz fuer % ist zu lang.', v_pokemon_id;
    end if;

    update public.draft_pool_pokemon pp
    set tier = case when v_entry ? 'tier' then v_tier else pp.tier end,
        cost = case when v_entry ? 'cost' then v_cost else pp.cost end,
        is_banned = case when v_entry ? 'is_banned' then (v_entry->>'is_banned')::boolean else pp.is_banned end,
        tags = case when v_entry ? 'tags' then array(select jsonb_array_elements_text(v_entry->'tags')) else pp.tags end,
        notes = case when v_entry ? 'notes' then left(coalesce(v_entry->>'notes', ''), 1000) else pp.notes end
    where pp.pool_id = p_pool_id and pp.pokemon_id = v_pokemon_id;

    if found then
      v_updated := v_updated + 1;
    else
      v_unknown := array_append(v_unknown, v_pokemon_id);
    end if;
  end loop;

  return jsonb_build_object(
    'updated', v_updated,
    'unknown', to_jsonb(v_unknown),
    'received', jsonb_array_length(p_entries)
  );
end;
$$;

create or replace function public.reset_pool_rankings(
  p_pool_id uuid,
  p_pokemon_ids text[] default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  if not exists (
    select 1 from public.draft_pools p
    where p.id = p_pool_id
      and (
        p.owner_id = auth.uid()
        or (p.tournament_id is not null and public.is_host_of(p.tournament_id))
        or public.is_admin()
      )
  ) then
    raise exception 'Du darfst diesen Pool nicht bearbeiten.';
  end if;

  update public.draft_pool_pokemon pp
  set tier = c.default_tier,
      cost = c.default_cost
  from public.pokemon_catalog c
  where pp.pool_id = p_pool_id
    and pp.pokemon_id = c.pokemon_id
    and (p_pokemon_ids is null or cardinality(p_pokemon_ids) = 0 or pp.pokemon_id = any(p_pokemon_ids));

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.update_pool_rankings(uuid, jsonb) from public;
revoke all on function public.reset_pool_rankings(uuid, text[]) from public;
grant execute on function public.update_pool_rankings(uuid, jsonb) to authenticated;
grant execute on function public.reset_pool_rankings(uuid, text[]) to authenticated;
