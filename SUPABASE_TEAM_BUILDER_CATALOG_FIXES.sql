-- Team-Builder Katalog-Fixes fuer Items, Charizard-Faehigkeiten und Mega-Formen.
-- Nach SUPABASE_TEAM_BUILDER_STATS.sql im Supabase SQL Editor ausfuehren.

begin;

-- Item-Liste: Rohdaten bleiben erhalten, aber der Builder nutzt diese Flags,
-- um nur Kampf-/Held-Items, Beeren und Mega-/Battle-relevante Items anzubieten.
update public.item_catalog
set is_battle_relevant = false,
    is_champions_legal = false
where true;

update public.item_catalog
set is_battle_relevant = true
where lower(coalesce(category, '')) ~ '(held|battle|berry|berries|mega|jewel|plate|memory|drive|z-crystal|choice|type-enhancement|species-specific|training)'
   or lower(id) ~ '(berry|choice-|leftovers|life-orb|focus-sash|assault-vest|eviolite|rocky-helmet|heavy-duty-boots|black-sludge|flame-orb|toxic-orb|air-balloon|weakness-policy|safety-goggles|loaded-dice|booster-energy|clear-amulet|covert-cloak|punching-glove|expert-belt|muscle-band|wise-glasses|scope-lens|light-clay|terrain-extender|room-service|throat-spray|white-herb|power-herb|mental-herb|mirror-herb|red-card|eject-button|eject-pack|lagging-tail|iron-ball|sticky-barb|metronome|shell-bell|sitrus|lum|oran|figy|wiki|mago|aguav|iapapa|charizardite)';

update public.item_catalog
set is_battle_relevant = false,
    is_champions_legal = false
where lower(coalesce(category, '') || ' ' || id || ' ' || display_name) ~ '(tm|hm|tr|technical|machine|mail|letter|mulch|fossil|apricorn|shard|repel|escape|rope|rod|bike|bicycle|ticket|pass|key|card|parcel|souvenir|photo|flute|doll|honey|nectar|exp.?share|experience|rare.?candy)';

update public.item_catalog
set is_champions_legal = true
where is_battle_relevant = true;

-- Wichtige Ability-Eintraege fuer Charizard und Mega-Charizard.
insert into public.ability_catalog (id, display_name, source, short_effect)
values
  ('blaze', 'Blaze', 'manual', 'Powers up Fire-type moves when HP is low.'),
  ('solar-power', 'Solar Power', 'manual', 'Boosts Sp. Atk in harsh sunlight, but costs HP each turn.'),
  ('tough-claws', 'Tough Claws', 'manual', 'Powers up moves that make direct contact.'),
  ('drought', 'Drought', 'manual', 'Turns the sunlight harsh when entering battle.')
on conflict (id) do update set
  display_name = excluded.display_name,
  short_effect = coalesce(public.ability_catalog.short_effect, excluded.short_effect),
  updated_at = now();

insert into public.pokemon_form_catalog (
  pokemon_id, species_pokemon_id, pokemon_name, form_name, generation, types,
  base_hp, base_atk, base_def, base_spa, base_spd, base_spe,
  is_default, is_mega, is_champions_legal, source
)
values
  ('charizard-mega-x', 'charizard', 'Mega Charizard X', 'Mega X', 6, array['fire','dragon'], 78, 130, 111, 130, 85, 100, false, true, true, 'manual'),
  ('charizard-mega-y', 'charizard', 'Mega Charizard Y', 'Mega Y', 6, array['fire','flying'], 78, 104, 78, 159, 115, 100, false, true, true, 'manual')
on conflict (pokemon_id) do update set
  species_pokemon_id = excluded.species_pokemon_id,
  pokemon_name = excluded.pokemon_name,
  form_name = excluded.form_name,
  generation = excluded.generation,
  types = excluded.types,
  base_hp = excluded.base_hp,
  base_atk = excluded.base_atk,
  base_def = excluded.base_def,
  base_spa = excluded.base_spa,
  base_spd = excluded.base_spd,
  base_spe = excluded.base_spe,
  is_mega = excluded.is_mega,
  is_champions_legal = excluded.is_champions_legal,
  updated_at = now();

insert into public.pokemon_ability_catalog (pokemon_id, ability_id, display_name, slot, is_hidden, source)
values
  ('charizard', 'blaze', 'Blaze', 1, false, 'manual'),
  ('charizard', 'solar-power', 'Solar Power', 3, true, 'manual'),
  ('charizard-mega-x', 'tough-claws', 'Tough Claws', 1, false, 'manual'),
  ('charizard-mega-y', 'drought', 'Drought', 1, false, 'manual')
on conflict (pokemon_id, ability_id) do update set
  display_name = excluded.display_name,
  slot = excluded.slot,
  is_hidden = excluded.is_hidden,
  updated_at = now();

commit;
