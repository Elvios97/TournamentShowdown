-- Neutrale Gen-1-Startwerte fuer Draft-Tiers und Punktkosten.
-- Eigene Poolwerte werden nicht ueberschrieben.

alter table public.pokemon_catalog
  add column if not exists default_tier text,
  add column if not exists default_cost integer;

alter table public.pokemon_catalog
  drop constraint if exists pokemon_catalog_default_tier_check,
  add constraint pokemon_catalog_default_tier_check
    check (default_tier is null or default_tier in ('S', 'A', 'B', 'C', 'D')),
  drop constraint if exists pokemon_catalog_default_cost_check,
  add constraint pokemon_catalog_default_cost_check
    check (default_cost is null or default_cost between 0 and 100);

-- Sichere Basis: alle Gen-1-Pokemon starten in D. Die folgenden Gruppen
-- ueberschreiben diese Einstufung von C bis S.
update public.pokemon_catalog
set default_tier = 'D', default_cost = 3, updated_at = now()
where generation = 1;

update public.pokemon_catalog
set default_tier = 'C', default_cost = 6, updated_at = now()
where generation = 1 and dex_number in (
  2,5,8,12,15,17,20,22,24,26,28,30,33,36,38,40,42,44,47,49,
  51,53,55,57,59,61,64,67,70,73,75,78,80,82,85,87,89,91,93,97,
  99,101,105,108,110,112,114,117,119,121,124,125,126,127,132,
  134,136,139,141,148
);

update public.pokemon_catalog
set default_tier = 'B', default_cost = 10, updated_at = now()
where generation = 1 and dex_number in (
  3,6,9,18,31,34,45,62,65,68,71,76,83,94,103,106,107,113,115,
  122,123,128,131,135,137,142,144,146,149
);

update public.pokemon_catalog
set default_tier = 'A', default_cost = 14, updated_at = now()
where generation = 1 and dex_number in (
  26,34,36,59,65,68,73,80,82,91,94,103,112,113,121,128,130,
  131,135,143,144,145,146,149
);

update public.pokemon_catalog
set default_tier = 'S', default_cost = 18, updated_at = now()
where generation = 1 and dex_number in (
  3,6,9,65,94,113,121,130,143,145,149,150,151
);

-- Bereits angelegte Pools erhalten nur dort Standardwerte, wo noch keine
-- eigene Einstufung beziehungsweise Kosten vorhanden sind.
update public.draft_pool_pokemon pp
set tier = case
      when pp.tier is null or trim(pp.tier) = '' then c.default_tier
      else pp.tier
    end,
    cost = coalesce(pp.cost, c.default_cost)
from public.pokemon_catalog c
where c.generation = 1
  and c.pokemon_id = pp.pokemon_id
  and ((pp.tier is null or trim(pp.tier) = '') or pp.cost is null);

create or replace function public.add_catalog_pokemon_to_pool(
  p_pool_id uuid,
  p_pokemon_id text
)
returns public.draft_pool_pokemon
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mon public.pokemon_catalog;
  v_result public.draft_pool_pokemon;
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

  select * into v_mon
  from public.pokemon_catalog
  where pokemon_id = p_pokemon_id;
  if v_mon.pokemon_id is null then
    raise exception 'Pokemon nicht im Katalog gefunden.';
  end if;

  select * into v_result
  from public.draft_pool_pokemon
  where pool_id = p_pool_id and pokemon_id = p_pokemon_id
  limit 1;
  if v_result.id is not null then
    return v_result;
  end if;

  insert into public.draft_pool_pokemon
    (pool_id, pokemon_id, pokemon_name, types, generation, tier, cost)
  values
    (p_pool_id, v_mon.pokemon_id, v_mon.pokemon_name, v_mon.types,
     v_mon.generation, v_mon.default_tier, v_mon.default_cost)
  returning * into v_result;
  return v_result;
end;
$$;

create or replace function public.add_generation_to_pool(
  p_pool_id uuid,
  p_generation integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
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

  insert into public.draft_pool_pokemon
    (pool_id, pokemon_id, pokemon_name, types, generation, tier, cost)
  select p_pool_id, c.pokemon_id, c.pokemon_name, c.types, c.generation,
         c.default_tier, c.default_cost
  from public.pokemon_catalog c
  where c.generation = p_generation
    and not exists (
      select 1 from public.draft_pool_pokemon pp
      where pp.pool_id = p_pool_id and pp.pokemon_id = c.pokemon_id
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.add_catalog_pokemon_to_pool(uuid, text) from public;
revoke all on function public.add_generation_to_pool(uuid, integer) from public;
grant execute on function public.add_catalog_pokemon_to_pool(uuid, text) to authenticated;
grant execute on function public.add_generation_to_pool(uuid, integer) to authenticated;
