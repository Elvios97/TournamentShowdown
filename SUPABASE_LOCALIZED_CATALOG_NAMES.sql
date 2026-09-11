-- Lokalisierte Katalognamen fuer zweisprachige Anzeige/Suche im Team Builder.
-- Wiederholbar ausfuehrbar.

alter table public.move_catalog
  add column if not exists english_name text,
  add column if not exists german_name text,
  add column if not exists search_names text[] not null default '{}';

alter table public.ability_catalog
  add column if not exists english_name text,
  add column if not exists german_name text,
  add column if not exists search_names text[] not null default '{}';

alter table public.item_catalog
  add column if not exists english_name text,
  add column if not exists search_names text[] not null default '{}';

alter table public.pokemon_catalog
  add column if not exists english_name text,
  add column if not exists search_names text[] not null default '{}';

alter table public.pokemon_form_catalog
  add column if not exists english_name text,
  add column if not exists search_names text[] not null default '{}';

alter table public.pokemon_move_catalog
  add column if not exists english_name text,
  add column if not exists german_name text,
  add column if not exists search_names text[] not null default '{}';

alter table public.pokemon_ability_catalog
  add column if not exists english_name text,
  add column if not exists german_name text,
  add column if not exists search_names text[] not null default '{}';

update public.move_catalog
set english_name = coalesce(english_name, display_name),
    search_names = array_remove(array[
      lower(coalesce(id, '')),
      lower(coalesce(display_name, '')),
      lower(coalesce(english_name, '')),
      lower(coalesce(german_name, ''))
    ], '')
where english_name is null or search_names = '{}';

update public.ability_catalog
set english_name = coalesce(english_name, display_name),
    search_names = array_remove(array[
      lower(coalesce(id, '')),
      lower(coalesce(display_name, '')),
      lower(coalesce(english_name, '')),
      lower(coalesce(german_name, ''))
    ], '')
where english_name is null or search_names = '{}';

update public.item_catalog
set english_name = coalesce(english_name, display_name),
    search_names = array_remove(array[
      lower(coalesce(id, '')),
      lower(coalesce(display_name, '')),
      lower(coalesce(english_name, '')),
      lower(coalesce(german_name, ''))
    ], '')
where english_name is null or search_names = '{}';

update public.pokemon_catalog
set english_name = coalesce(english_name, pokemon_name),
    search_names = array_remove(array[
      lower(coalesce(pokemon_id, '')),
      lower(coalesce(pokemon_name, '')),
      lower(coalesce(english_name, '')),
      lower(coalesce(german_name, ''))
    ], '')
where english_name is null or search_names = '{}';

update public.pokemon_form_catalog
set english_name = coalesce(english_name, pokemon_name),
    search_names = array_remove(array[
      lower(coalesce(pokemon_id, '')),
      lower(coalesce(pokemon_name, '')),
      lower(coalesce(english_name, '')),
      lower(coalesce(german_name, '')),
      lower(coalesce(form_name, ''))
    ], '')
where english_name is null or search_names = '{}';

update public.pokemon_move_catalog pm
set english_name = coalesce(pm.english_name, mc.english_name, mc.display_name),
    german_name = coalesce(pm.german_name, mc.german_name),
    search_names = array_remove(array[
      lower(coalesce(pm.move_id, '')),
      lower(coalesce(pm.display_name, '')),
      lower(coalesce(mc.display_name, '')),
      lower(coalesce(mc.english_name, '')),
      lower(coalesce(mc.german_name, ''))
    ], '')
from public.move_catalog mc
where pm.move_id = mc.id
  and (pm.english_name is null or pm.german_name is null or pm.search_names = '{}');

update public.pokemon_ability_catalog pa
set english_name = coalesce(pa.english_name, ac.english_name, ac.display_name),
    german_name = coalesce(pa.german_name, ac.german_name),
    search_names = array_remove(array[
      lower(coalesce(pa.ability_id, '')),
      lower(coalesce(pa.display_name, '')),
      lower(coalesce(ac.display_name, '')),
      lower(coalesce(ac.english_name, '')),
      lower(coalesce(ac.german_name, ''))
    ], '')
from public.ability_catalog ac
where pa.ability_id = ac.id
  and (pa.english_name is null or pa.german_name is null or pa.search_names = '{}');
