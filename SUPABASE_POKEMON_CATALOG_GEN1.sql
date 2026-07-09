-- Zentraler Pokemon-Katalog und Gen-1-Startbestand.
-- Wiederholbar: bestehende Katalogeintraege werden aktualisiert.

create table if not exists public.pokemon_catalog (
  dex_number integer primary key,
  pokemon_id text not null unique,
  pokemon_name text not null,
  generation integer not null check (generation between 1 and 9),
  types text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pokemon_catalog_generation_name
  on public.pokemon_catalog (generation, pokemon_name);

alter table public.pokemon_catalog enable row level security;

drop policy if exists "pokemon_catalog_read" on public.pokemon_catalog;
create policy "pokemon_catalog_read"
  on public.pokemon_catalog for select
  to authenticated
  using (true);

grant select on public.pokemon_catalog to authenticated;

insert into public.pokemon_catalog
  (dex_number, pokemon_id, pokemon_name, generation, types)
values
  (1, 'bulbasaur', 'Bulbasaur', 1, array['grass','poison']),
  (2, 'ivysaur', 'Ivysaur', 1, array['grass','poison']),
  (3, 'venusaur', 'Venusaur', 1, array['grass','poison']),
  (4, 'charmander', 'Charmander', 1, array['fire']),
  (5, 'charmeleon', 'Charmeleon', 1, array['fire']),
  (6, 'charizard', 'Charizard', 1, array['fire','flying']),
  (7, 'squirtle', 'Squirtle', 1, array['water']),
  (8, 'wartortle', 'Wartortle', 1, array['water']),
  (9, 'blastoise', 'Blastoise', 1, array['water']),
  (10, 'caterpie', 'Caterpie', 1, array['bug']),
  (11, 'metapod', 'Metapod', 1, array['bug']),
  (12, 'butterfree', 'Butterfree', 1, array['bug','flying']),
  (13, 'weedle', 'Weedle', 1, array['bug','poison']),
  (14, 'kakuna', 'Kakuna', 1, array['bug','poison']),
  (15, 'beedrill', 'Beedrill', 1, array['bug','poison']),
  (16, 'pidgey', 'Pidgey', 1, array['normal','flying']),
  (17, 'pidgeotto', 'Pidgeotto', 1, array['normal','flying']),
  (18, 'pidgeot', 'Pidgeot', 1, array['normal','flying']),
  (19, 'rattata', 'Rattata', 1, array['normal']),
  (20, 'raticate', 'Raticate', 1, array['normal']),
  (21, 'spearow', 'Spearow', 1, array['normal','flying']),
  (22, 'fearow', 'Fearow', 1, array['normal','flying']),
  (23, 'ekans', 'Ekans', 1, array['poison']),
  (24, 'arbok', 'Arbok', 1, array['poison']),
  (25, 'pikachu', 'Pikachu', 1, array['electric']),
  (26, 'raichu', 'Raichu', 1, array['electric']),
  (27, 'sandshrew', 'Sandshrew', 1, array['ground']),
  (28, 'sandslash', 'Sandslash', 1, array['ground']),
  (29, 'nidoranf', 'Nidoran-F', 1, array['poison']),
  (30, 'nidorina', 'Nidorina', 1, array['poison']),
  (31, 'nidoqueen', 'Nidoqueen', 1, array['poison','ground']),
  (32, 'nidoranm', 'Nidoran-M', 1, array['poison']),
  (33, 'nidorino', 'Nidorino', 1, array['poison']),
  (34, 'nidoking', 'Nidoking', 1, array['poison','ground']),
  (35, 'clefairy', 'Clefairy', 1, array['fairy']),
  (36, 'clefable', 'Clefable', 1, array['fairy']),
  (37, 'vulpix', 'Vulpix', 1, array['fire']),
  (38, 'ninetales', 'Ninetales', 1, array['fire']),
  (39, 'jigglypuff', 'Jigglypuff', 1, array['normal','fairy']),
  (40, 'wigglytuff', 'Wigglytuff', 1, array['normal','fairy']),
  (41, 'zubat', 'Zubat', 1, array['poison','flying']),
  (42, 'golbat', 'Golbat', 1, array['poison','flying']),
  (43, 'oddish', 'Oddish', 1, array['grass','poison']),
  (44, 'gloom', 'Gloom', 1, array['grass','poison']),
  (45, 'vileplume', 'Vileplume', 1, array['grass','poison']),
  (46, 'paras', 'Paras', 1, array['bug','grass']),
  (47, 'parasect', 'Parasect', 1, array['bug','grass']),
  (48, 'venonat', 'Venonat', 1, array['bug','poison']),
  (49, 'venomoth', 'Venomoth', 1, array['bug','poison']),
  (50, 'diglett', 'Diglett', 1, array['ground']),
  (51, 'dugtrio', 'Dugtrio', 1, array['ground']),
  (52, 'meowth', 'Meowth', 1, array['normal']),
  (53, 'persian', 'Persian', 1, array['normal']),
  (54, 'psyduck', 'Psyduck', 1, array['water']),
  (55, 'golduck', 'Golduck', 1, array['water']),
  (56, 'mankey', 'Mankey', 1, array['fighting']),
  (57, 'primeape', 'Primeape', 1, array['fighting']),
  (58, 'growlithe', 'Growlithe', 1, array['fire']),
  (59, 'arcanine', 'Arcanine', 1, array['fire']),
  (60, 'poliwag', 'Poliwag', 1, array['water']),
  (61, 'poliwhirl', 'Poliwhirl', 1, array['water']),
  (62, 'poliwrath', 'Poliwrath', 1, array['water','fighting']),
  (63, 'abra', 'Abra', 1, array['psychic']),
  (64, 'kadabra', 'Kadabra', 1, array['psychic']),
  (65, 'alakazam', 'Alakazam', 1, array['psychic']),
  (66, 'machop', 'Machop', 1, array['fighting']),
  (67, 'machoke', 'Machoke', 1, array['fighting']),
  (68, 'machamp', 'Machamp', 1, array['fighting']),
  (69, 'bellsprout', 'Bellsprout', 1, array['grass','poison']),
  (70, 'weepinbell', 'Weepinbell', 1, array['grass','poison']),
  (71, 'victreebel', 'Victreebel', 1, array['grass','poison']),
  (72, 'tentacool', 'Tentacool', 1, array['water','poison']),
  (73, 'tentacruel', 'Tentacruel', 1, array['water','poison']),
  (74, 'geodude', 'Geodude', 1, array['rock','ground']),
  (75, 'graveler', 'Graveler', 1, array['rock','ground']),
  (76, 'golem', 'Golem', 1, array['rock','ground']),
  (77, 'ponyta', 'Ponyta', 1, array['fire']),
  (78, 'rapidash', 'Rapidash', 1, array['fire']),
  (79, 'slowpoke', 'Slowpoke', 1, array['water','psychic']),
  (80, 'slowbro', 'Slowbro', 1, array['water','psychic']),
  (81, 'magnemite', 'Magnemite', 1, array['electric','steel']),
  (82, 'magneton', 'Magneton', 1, array['electric','steel']),
  (83, 'farfetchd', 'Farfetch''d', 1, array['normal','flying']),
  (84, 'doduo', 'Doduo', 1, array['normal','flying']),
  (85, 'dodrio', 'Dodrio', 1, array['normal','flying']),
  (86, 'seel', 'Seel', 1, array['water']),
  (87, 'dewgong', 'Dewgong', 1, array['water','ice']),
  (88, 'grimer', 'Grimer', 1, array['poison']),
  (89, 'muk', 'Muk', 1, array['poison']),
  (90, 'shellder', 'Shellder', 1, array['water']),
  (91, 'cloyster', 'Cloyster', 1, array['water','ice']),
  (92, 'gastly', 'Gastly', 1, array['ghost','poison']),
  (93, 'haunter', 'Haunter', 1, array['ghost','poison']),
  (94, 'gengar', 'Gengar', 1, array['ghost','poison']),
  (95, 'onix', 'Onix', 1, array['rock','ground']),
  (96, 'drowzee', 'Drowzee', 1, array['psychic']),
  (97, 'hypno', 'Hypno', 1, array['psychic']),
  (98, 'krabby', 'Krabby', 1, array['water']),
  (99, 'kingler', 'Kingler', 1, array['water']),
  (100, 'voltorb', 'Voltorb', 1, array['electric']),
  (101, 'electrode', 'Electrode', 1, array['electric']),
  (102, 'exeggcute', 'Exeggcute', 1, array['grass','psychic']),
  (103, 'exeggutor', 'Exeggutor', 1, array['grass','psychic']),
  (104, 'cubone', 'Cubone', 1, array['ground']),
  (105, 'marowak', 'Marowak', 1, array['ground']),
  (106, 'hitmonlee', 'Hitmonlee', 1, array['fighting']),
  (107, 'hitmonchan', 'Hitmonchan', 1, array['fighting']),
  (108, 'lickitung', 'Lickitung', 1, array['normal']),
  (109, 'koffing', 'Koffing', 1, array['poison']),
  (110, 'weezing', 'Weezing', 1, array['poison']),
  (111, 'rhyhorn', 'Rhyhorn', 1, array['ground','rock']),
  (112, 'rhydon', 'Rhydon', 1, array['ground','rock']),
  (113, 'chansey', 'Chansey', 1, array['normal']),
  (114, 'tangela', 'Tangela', 1, array['grass']),
  (115, 'kangaskhan', 'Kangaskhan', 1, array['normal']),
  (116, 'horsea', 'Horsea', 1, array['water']),
  (117, 'seadra', 'Seadra', 1, array['water']),
  (118, 'goldeen', 'Goldeen', 1, array['water']),
  (119, 'seaking', 'Seaking', 1, array['water']),
  (120, 'staryu', 'Staryu', 1, array['water']),
  (121, 'starmie', 'Starmie', 1, array['water','psychic']),
  (122, 'mrmime', 'Mr. Mime', 1, array['psychic','fairy']),
  (123, 'scyther', 'Scyther', 1, array['bug','flying']),
  (124, 'jynx', 'Jynx', 1, array['ice','psychic']),
  (125, 'electabuzz', 'Electabuzz', 1, array['electric']),
  (126, 'magmar', 'Magmar', 1, array['fire']),
  (127, 'pinsir', 'Pinsir', 1, array['bug']),
  (128, 'tauros', 'Tauros', 1, array['normal']),
  (129, 'magikarp', 'Magikarp', 1, array['water']),
  (130, 'gyarados', 'Gyarados', 1, array['water','flying']),
  (131, 'lapras', 'Lapras', 1, array['water','ice']),
  (132, 'ditto', 'Ditto', 1, array['normal']),
  (133, 'eevee', 'Eevee', 1, array['normal']),
  (134, 'vaporeon', 'Vaporeon', 1, array['water']),
  (135, 'jolteon', 'Jolteon', 1, array['electric']),
  (136, 'flareon', 'Flareon', 1, array['fire']),
  (137, 'porygon', 'Porygon', 1, array['normal']),
  (138, 'omanyte', 'Omanyte', 1, array['rock','water']),
  (139, 'omastar', 'Omastar', 1, array['rock','water']),
  (140, 'kabuto', 'Kabuto', 1, array['rock','water']),
  (141, 'kabutops', 'Kabutops', 1, array['rock','water']),
  (142, 'aerodactyl', 'Aerodactyl', 1, array['rock','flying']),
  (143, 'snorlax', 'Snorlax', 1, array['normal']),
  (144, 'articuno', 'Articuno', 1, array['ice','flying']),
  (145, 'zapdos', 'Zapdos', 1, array['electric','flying']),
  (146, 'moltres', 'Moltres', 1, array['fire','flying']),
  (147, 'dratini', 'Dratini', 1, array['dragon']),
  (148, 'dragonair', 'Dragonair', 1, array['dragon']),
  (149, 'dragonite', 'Dragonite', 1, array['dragon','flying']),
  (150, 'mewtwo', 'Mewtwo', 1, array['psychic']),
  (151, 'mew', 'Mew', 1, array['psychic'])
on conflict (dex_number) do update set
  pokemon_id = excluded.pokemon_id,
  pokemon_name = excluded.pokemon_name,
  generation = excluded.generation,
  types = excluded.types,
  updated_at = now();

create or replace function public.create_tournament_pool(
  p_tournament_id uuid,
  p_name text default null
)
returns public.draft_pools
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_pool public.draft_pools;
begin
  if v_user_id is null then
    raise exception 'Du musst angemeldet sein.';
  end if;

  if not exists (
    select 1 from public.tournaments t
    where t.id = p_tournament_id
      and (
        t.owner_id = v_user_id
        or exists (
          select 1 from public.tournament_members tm
          where tm.tournament_id = t.id
            and tm.profile_id = v_user_id
            and tm.role = 'host'
        )
        or public.is_admin()
      )
  ) then
    raise exception 'Nur der Turnier-Host darf einen Pool anlegen.';
  end if;

  select * into v_pool
  from public.draft_pools
  where tournament_id = p_tournament_id
  order by created_at
  limit 1;

  if v_pool.id is not null then
    return v_pool;
  end if;

  insert into public.draft_pools (owner_id, tournament_id, name)
  values (v_user_id, p_tournament_id, coalesce(nullif(trim(p_name), ''), 'Draft Pool'))
  returning * into v_pool;

  return v_pool;
end;
$$;

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
    (pool_id, pokemon_id, pokemon_name, types, generation)
  values
    (p_pool_id, v_mon.pokemon_id, v_mon.pokemon_name, v_mon.types, v_mon.generation)
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
    (pool_id, pokemon_id, pokemon_name, types, generation)
  select p_pool_id, c.pokemon_id, c.pokemon_name, c.types, c.generation
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

revoke all on function public.create_tournament_pool(uuid, text) from public;
revoke all on function public.add_catalog_pokemon_to_pool(uuid, text) from public;
revoke all on function public.add_generation_to_pool(uuid, integer) from public;
grant execute on function public.create_tournament_pool(uuid, text) to authenticated;
grant execute on function public.add_catalog_pokemon_to_pool(uuid, text) to authenticated;
grant execute on function public.add_generation_to_pool(uuid, integer) to authenticated;
