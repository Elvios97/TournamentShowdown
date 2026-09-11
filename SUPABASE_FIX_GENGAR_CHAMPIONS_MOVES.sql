-- Fix Champions moveset for Gengar.
--
-- Source: PokéWiki Gengar/Attacken, section "Pokémon Champions".
-- Run in the Supabase SQL Editor.

with gengar_moves(id, display_name, type, damage_class, power, accuracy, pp) as (
  values
    ('champions-finale', 'Finale', 'normal', null, 200, 100, 8),
    ('champions-gigastoss', 'Gigastoß', 'normal', null, 150, 90, 8),
    ('champions-bodyslam', 'Bodyslam', 'normal', null, 85, 100, 16),
    ('champions-fassade', 'Fassade', 'normal', null, 70, 100, 20),
    ('champions-hyperstrahl', 'Hyperstrahl', 'normal', null, 150, 90, 8),
    ('champions-kanon', 'Kanon', 'normal', null, 60, 100, 16),
    ('champions-schnarcher', 'Schnarcher', 'normal', null, 50, 100, 16),
    ('champions-typenspiegel', 'Typenspiegel', 'normal', null, null, null, 16),
    ('champions-psycho-plus', 'Psycho-Plus', 'normal', null, null, null, 12),
    ('champions-leidteiler', 'Leidteiler', 'normal', null, null, null, 20),
    ('champions-schlafrede', 'Schlafrede', 'normal', null, null, null, 12),
    ('champions-horrorblick', 'Horrorblick', 'normal', null, null, null, 8),
    ('champions-ausdauer', 'Ausdauer', 'normal', null, null, null, 12),
    ('champions-abgesang', 'Abgesang', 'normal', null, null, null, 8),
    ('champions-grimasse', 'Grimasse', 'normal', null, null, 100, 12),
    ('champions-schutzschild', 'Schutzschild', 'normal', null, null, null, 8),
    ('champions-delegator', 'Delegator', 'normal', null, null, null, 12),
    ('champions-aussetzer', 'Aussetzer', 'normal', null, null, 100, 20),
    ('champions-energieball', 'Energieball', 'grass', null, 90, 100, 12),
    ('champions-gigasauger', 'Gigasauger', 'grass', null, 75, 100, 12),
    ('champions-feuerschlag', 'Feuerschlag', 'fire', null, 75, 100, 16),
    ('champions-irrlicht', 'Irrlicht', 'fire', null, null, 85, 16),
    ('champions-sonnentag', 'Sonnentag', 'fire', null, null, null, 8),
    ('champions-regentanz', 'Regentanz', 'water', null, null, null, 8),
    ('champions-donnerschlag', 'Donnerschlag', 'electric', null, 75, 100, 16),
    ('champions-donner', 'Donner', 'electric', null, 110, 70, 12),
    ('champions-donnerblitz', 'Donnerblitz', 'electric', null, 90, 100, 16),
    ('champions-donnerwelle', 'Donnerwelle', 'electric', null, null, 90, 20),
    ('champions-krabbelkracher', 'Krabbelkracher', 'bug', null, 70, 90, 12),
    ('champions-mulltreffer', 'Mülltreffer', 'poison', null, 120, 80, 8),
    ('champions-gifthieb', 'Gifthieb', 'poison', null, 80, 100, 20),
    ('champions-schlammwoge', 'Schlammwoge', 'poison', null, 95, 100, 12),
    ('champions-matschbombe', 'Matschbombe', 'poison', null, 90, 100, 12),
    ('champions-giftschock', 'Giftschock', 'poison', null, 65, 100, 12),
    ('champions-klarsmog', 'Klärsmog', 'poison', null, 50, null, 16),
    ('champions-saurespeier', 'Säurespeier', 'poison', null, 40, 100, 20),
    ('champions-korrosionsgas', 'Korrosionsgas', 'poison', null, null, 100, 20),
    ('champions-giftspitzen', 'Giftspitzen', 'poison', null, null, null, 20),
    ('champions-toxin', 'Toxin', 'poison', null, null, 90, 12),
    ('champions-eishieb', 'Eishieb', 'ice', null, 75, 100, 16),
    ('champions-eissturm', 'Eissturm', 'ice', null, 55, 95, 16),
    ('champions-dunkelnebel', 'Dunkelnebel', 'ice', null, null, null, 20),
    ('champions-power-punch', 'Power-Punch', 'fighting', null, 150, 100, 20),
    ('champions-ableithieb', 'Ableithieb', 'fighting', null, 75, 100, 12),
    ('champions-durchbruch', 'Durchbruch', 'fighting', null, 75, 100, 16),
    ('champions-fokusstoss', 'Fokusstoß', 'fighting', null, 120, 70, 8),
    ('champions-psychokinese', 'Psychokinese', 'psychic', null, 90, 100, 12),
    ('champions-psycholarm', 'Psycholärm', 'psychic', null, 75, 100, 12),
    ('champions-wunderraum', 'Wunderraum', 'psychic', null, null, null, 12),
    ('champions-bizarroraum', 'Bizarroraum', 'psychic', null, null, null, 8),
    ('champions-begrenzer', 'Begrenzer', 'psychic', null, null, null, 12),
    ('champions-fahigkeitstausch', 'Fähigkeitstausch', 'psychic', null, null, null, 12),
    ('champions-trickbetrug', 'Trickbetrug', 'psychic', null, null, 100, 12),
    ('champions-erholung', 'Erholung', 'psychic', null, null, null, 8),
    ('champions-hypnose', 'Hypnose', 'psychic', null, null, 60, 20),
    ('champions-poltergeist', 'Poltergeist', 'ghost', null, 110, 90, 8),
    ('champions-phantomkraft', 'Phantomkraft', 'ghost', null, 90, 100, 12),
    ('champions-dunkelklaue', 'Dunkelklaue', 'ghost', null, 70, 100, 16),
    ('champions-finsterfaust', 'Finsterfaust', 'ghost', null, 60, null, 20),
    ('champions-spukball', 'Spukball', 'ghost', null, 80, 100, 16),
    ('champions-burde', 'Bürde', 'ghost', null, 65, 100, 12),
    ('champions-nachtnebel', 'Nachtnebel', 'ghost', null, null, 100, 16),
    ('champions-abgangsbund', 'Abgangsbund', 'ghost', null, null, null, 8),
    ('champions-groll', 'Groll', 'ghost', null, null, 100, 12),
    ('champions-fluch', 'Fluch', 'ghost', null, null, null, 12),
    ('champions-konfusstrahl', 'Konfusstrahl', 'ghost', null, null, 100, 12),
    ('champions-schmarotzer', 'Schmarotzer', 'dark', null, 95, 100, 16),
    ('champions-tiefschlag', 'Tiefschlag', 'dark', null, 70, 100, 8),
    ('champions-abschlag', 'Abschlag', 'dark', null, 65, 100, 20),
    ('champions-raub', 'Raub', 'dark', null, 60, 100, 20),
    ('champions-gegenstoss', 'Gegenstoß', 'dark', null, 50, 100, 12),
    ('champions-schleuder', 'Schleuder', 'dark', null, null, 100, 12),
    ('champions-finsteraura', 'Finsteraura', 'dark', null, 80, 100, 16),
    ('champions-rankeschmied', 'Ränkeschmied', 'dark', null, null, null, 20),
    ('champions-verhohner', 'Verhöhner', 'dark', null, null, 100, 20),
    ('champions-zauberschein', 'Zauberschein', 'fairy', null, 80, 100, 12)
)
insert into public.move_catalog (
  id, display_name, type, damage_class, power, accuracy, pp,
  priority, generation, is_champions_legal, source, updated_at
)
select
  id, display_name, type, damage_class, power, accuracy, pp,
  0, 9, true, 'pokewiki-manual', now()
from gengar_moves
on conflict (id) do update set
  display_name = excluded.display_name,
  type = excluded.type,
  damage_class = excluded.damage_class,
  power = excluded.power,
  accuracy = excluded.accuracy,
  pp = excluded.pp,
  is_champions_legal = true,
  source = excluded.source,
  updated_at = now();

delete from public.pokemon_move_catalog
where pokemon_id = 'gengar'
  and version_group = 'pokemon-champions'
  and learn_method = 'champions-management';

with gengar_moves(id, display_name) as (
  values
    ('champions-finale', 'Finale'),
    ('champions-gigastoss', 'Gigastoß'),
    ('champions-bodyslam', 'Bodyslam'),
    ('champions-fassade', 'Fassade'),
    ('champions-hyperstrahl', 'Hyperstrahl'),
    ('champions-kanon', 'Kanon'),
    ('champions-schnarcher', 'Schnarcher'),
    ('champions-typenspiegel', 'Typenspiegel'),
    ('champions-psycho-plus', 'Psycho-Plus'),
    ('champions-leidteiler', 'Leidteiler'),
    ('champions-schlafrede', 'Schlafrede'),
    ('champions-horrorblick', 'Horrorblick'),
    ('champions-ausdauer', 'Ausdauer'),
    ('champions-abgesang', 'Abgesang'),
    ('champions-grimasse', 'Grimasse'),
    ('champions-schutzschild', 'Schutzschild'),
    ('champions-delegator', 'Delegator'),
    ('champions-aussetzer', 'Aussetzer'),
    ('champions-energieball', 'Energieball'),
    ('champions-gigasauger', 'Gigasauger'),
    ('champions-feuerschlag', 'Feuerschlag'),
    ('champions-irrlicht', 'Irrlicht'),
    ('champions-sonnentag', 'Sonnentag'),
    ('champions-regentanz', 'Regentanz'),
    ('champions-donnerschlag', 'Donnerschlag'),
    ('champions-donner', 'Donner'),
    ('champions-donnerblitz', 'Donnerblitz'),
    ('champions-donnerwelle', 'Donnerwelle'),
    ('champions-krabbelkracher', 'Krabbelkracher'),
    ('champions-mulltreffer', 'Mülltreffer'),
    ('champions-gifthieb', 'Gifthieb'),
    ('champions-schlammwoge', 'Schlammwoge'),
    ('champions-matschbombe', 'Matschbombe'),
    ('champions-giftschock', 'Giftschock'),
    ('champions-klarsmog', 'Klärsmog'),
    ('champions-saurespeier', 'Säurespeier'),
    ('champions-korrosionsgas', 'Korrosionsgas'),
    ('champions-giftspitzen', 'Giftspitzen'),
    ('champions-toxin', 'Toxin'),
    ('champions-eishieb', 'Eishieb'),
    ('champions-eissturm', 'Eissturm'),
    ('champions-dunkelnebel', 'Dunkelnebel'),
    ('champions-power-punch', 'Power-Punch'),
    ('champions-ableithieb', 'Ableithieb'),
    ('champions-durchbruch', 'Durchbruch'),
    ('champions-fokusstoss', 'Fokusstoß'),
    ('champions-psychokinese', 'Psychokinese'),
    ('champions-psycholarm', 'Psycholärm'),
    ('champions-wunderraum', 'Wunderraum'),
    ('champions-bizarroraum', 'Bizarroraum'),
    ('champions-begrenzer', 'Begrenzer'),
    ('champions-fahigkeitstausch', 'Fähigkeitstausch'),
    ('champions-trickbetrug', 'Trickbetrug'),
    ('champions-erholung', 'Erholung'),
    ('champions-hypnose', 'Hypnose'),
    ('champions-poltergeist', 'Poltergeist'),
    ('champions-phantomkraft', 'Phantomkraft'),
    ('champions-dunkelklaue', 'Dunkelklaue'),
    ('champions-finsterfaust', 'Finsterfaust'),
    ('champions-spukball', 'Spukball'),
    ('champions-burde', 'Bürde'),
    ('champions-nachtnebel', 'Nachtnebel'),
    ('champions-abgangsbund', 'Abgangsbund'),
    ('champions-groll', 'Groll'),
    ('champions-fluch', 'Fluch'),
    ('champions-konfusstrahl', 'Konfusstrahl'),
    ('champions-schmarotzer', 'Schmarotzer'),
    ('champions-tiefschlag', 'Tiefschlag'),
    ('champions-abschlag', 'Abschlag'),
    ('champions-raub', 'Raub'),
    ('champions-gegenstoss', 'Gegenstoß'),
    ('champions-schleuder', 'Schleuder'),
    ('champions-finsteraura', 'Finsteraura'),
    ('champions-rankeschmied', 'Ränkeschmied'),
    ('champions-verhohner', 'Verhöhner'),
    ('champions-zauberschein', 'Zauberschein')
)
insert into public.pokemon_move_catalog (
  pokemon_id, move_id, display_name, version_group, learn_method,
  level_learned_at, is_current_gen_legal, is_champions_legal, source, updated_at
)
select
  'gengar', id, display_name, 'pokemon-champions', 'champions-management',
  0, false, true, 'pokewiki-manual', now()
from gengar_moves
on conflict (pokemon_id, move_id, version_group, learn_method) do update set
  display_name = excluded.display_name,
  is_champions_legal = true,
  source = excluded.source,
  updated_at = now();

select count(*) as gengar_champions_moves
from public.pokemon_move_catalog
where pokemon_id = 'gengar'
  and is_champions_legal = true
  and version_group = 'pokemon-champions'
  and learn_method = 'champions-management';
