-- Venusaur/Bisaflor form and ability fix for Team Builder.
--
-- Run this in the Supabase SQL Editor if Venusaur/Bisaflor only shows its
-- Mega form or the Mega ability is missing.
--
-- Repeatable and safe to run multiple times.

begin;

insert into public.ability_catalog (id, display_name, source, short_effect)
values
  ('overgrow', 'Overgrow', 'manual', 'Powers up Grass-type moves when HP is low.'),
  ('chlorophyll', 'Chlorophyll', 'manual', 'Boosts Speed in harsh sunlight.'),
  ('thick-fat', 'Thick Fat', 'manual', 'Reduces damage from Fire- and Ice-type moves.')
on conflict (id) do update set
  display_name = excluded.display_name,
  short_effect = coalesce(public.ability_catalog.short_effect, excluded.short_effect),
  updated_at = now();

insert into public.pokemon_form_catalog (
  pokemon_id, species_pokemon_id, pokemon_name, form_name, german_name, generation, types,
  base_hp, base_atk, base_def, base_spa, base_spd, base_spe,
  is_default, is_mega, is_champions_legal, source
)
values
  ('venusaur', 'venusaur', 'Venusaur', 'Default', 'Bisaflor', 1, array['grass','poison'], 80, 82, 83, 100, 100, 80, true, false, true, 'manual'),
  ('venusaur-mega', 'venusaur', 'Mega Venusaur', 'Mega', 'Mega-Bisaflor', 6, array['grass','poison'], 80, 100, 123, 122, 120, 80, false, true, true, 'manual')
on conflict (pokemon_id) do update set
  species_pokemon_id = excluded.species_pokemon_id,
  pokemon_name = excluded.pokemon_name,
  form_name = excluded.form_name,
  german_name = excluded.german_name,
  generation = excluded.generation,
  types = excluded.types,
  base_hp = excluded.base_hp,
  base_atk = excluded.base_atk,
  base_def = excluded.base_def,
  base_spa = excluded.base_spa,
  base_spd = excluded.base_spd,
  base_spe = excluded.base_spe,
  is_default = excluded.is_default,
  is_mega = excluded.is_mega,
  is_champions_legal = excluded.is_champions_legal,
  updated_at = now();

insert into public.pokemon_ability_catalog (pokemon_id, ability_id, display_name, slot, is_hidden, source)
values
  ('venusaur', 'overgrow', 'Overgrow', 1, false, 'manual'),
  ('venusaur', 'chlorophyll', 'Chlorophyll', 3, true, 'manual'),
  ('venusaur-mega', 'thick-fat', 'Thick Fat', 1, false, 'manual')
on conflict (pokemon_id, ability_id) do update set
  display_name = excluded.display_name,
  slot = excluded.slot,
  is_hidden = excluded.is_hidden,
  updated_at = now();

commit;
