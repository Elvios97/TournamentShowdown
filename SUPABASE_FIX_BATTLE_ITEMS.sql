-- Bereinigt Team-Builder-Items nach dem Lokalisierungs-/Champions-Import.
-- Wiederholbar ausfuehrbar.

insert into public.item_catalog (
  id,
  display_name,
  english_name,
  german_name,
  search_names,
  category,
  short_effect,
  effect_text,
  is_battle_relevant,
  is_champions_legal,
  source,
  updated_at
)
values
  ('leftovers', 'Ueberreste', 'Leftovers', 'Ueberreste', array['leftovers', 'ueberreste', 'überreste'], 'held-items', 'Stellt am Ende jeder Runde KP wieder her.', 'Stellt am Ende jeder Runde KP wieder her.', true, true, 'manual-battle-core', now()),
  ('flame-orb', 'Heiss-Orb', 'Flame Orb', 'Heiss-Orb', array['flame-orb', 'flame orb', 'heiss-orb', 'heiß-orb'], 'bad-held-items', 'Verbrennt den Traeger im Kampf.', 'Verbrennt den Traeger im Kampf.', true, true, 'manual-battle-core', now()),
  ('toxic-orb', 'Toxik-Orb', 'Toxic Orb', 'Toxik-Orb', array['toxic-orb', 'toxic orb', 'toxik-orb'], 'bad-held-items', 'Vergiftet den Traeger im Kampf schwer.', 'Vergiftet den Traeger im Kampf schwer.', true, true, 'manual-battle-core', now()),
  ('life-orb', 'Leben-Orb', 'Life Orb', 'Leben-Orb', array['life-orb', 'life orb', 'leben-orb'], 'held-items', 'Verstaerkt Angriffe, kostet aber KP.', 'Verstaerkt Angriffe, kostet aber KP.', true, true, 'manual-battle-core', now()),
  ('focus-sash', 'Fokusgurt', 'Focus Sash', 'Fokusgurt', array['focus-sash', 'focus sash', 'fokusgurt'], 'held-items', 'Kann einen K.O. aus vollen KP verhindern.', 'Kann einen K.O. aus vollen KP verhindern.', true, true, 'manual-battle-core', now()),
  ('choice-band', 'Wahlband', 'Choice Band', 'Wahlband', array['choice-band', 'choice band', 'wahlband'], 'choice', 'Erhoeht Angriff, bindet aber an eine Attacke.', 'Erhoeht Angriff, bindet aber an eine Attacke.', true, true, 'manual-battle-core', now()),
  ('choice-scarf', 'Wahlschal', 'Choice Scarf', 'Wahlschal', array['choice-scarf', 'choice scarf', 'wahlschal'], 'choice', 'Erhoeht Initiative, bindet aber an eine Attacke.', 'Erhoeht Initiative, bindet aber an eine Attacke.', true, true, 'manual-battle-core', now()),
  ('choice-specs', 'Wahlglas', 'Choice Specs', 'Wahlglas', array['choice-specs', 'choice specs', 'wahlglas'], 'choice', 'Erhoeht Spezial-Angriff, bindet aber an eine Attacke.', 'Erhoeht Spezial-Angriff, bindet aber an eine Attacke.', true, true, 'manual-battle-core', now()),
  ('assault-vest', 'Offensivweste', 'Assault Vest', 'Offensivweste', array['assault-vest', 'assault vest', 'offensivweste'], 'held-items', 'Erhoeht Spezial-Verteidigung, verhindert Status-Attacken.', 'Erhoeht Spezial-Verteidigung, verhindert Status-Attacken.', true, true, 'manual-battle-core', now()),
  ('eviolite', 'Evolith', 'Eviolite', 'Evolith', array['eviolite', 'evolith'], 'held-items', 'Erhoeht defensive Werte nicht voll entwickelter Pokemon.', 'Erhoeht defensive Werte nicht voll entwickelter Pokemon.', true, true, 'manual-battle-core', now()),
  ('rocky-helmet', 'Beulenhelm', 'Rocky Helmet', 'Beulenhelm', array['rocky-helmet', 'rocky helmet', 'beulenhelm'], 'held-items', 'Schaedigt Angreifer bei Kontakt.', 'Schaedigt Angreifer bei Kontakt.', true, true, 'manual-battle-core', now()),
  ('safety-goggles', 'Schutzbrille', 'Safety Goggles', 'Schutzbrille', array['safety-goggles', 'safety goggles', 'schutzbrille'], 'held-items', 'Schuetzt vor Wetter- und Pulvereffekten.', 'Schuetzt vor Wetter- und Pulvereffekten.', true, true, 'manual-battle-core', now()),
  ('heavy-duty-boots', 'Plateauschuhe', 'Heavy-Duty Boots', 'Plateauschuhe', array['heavy-duty-boots', 'heavy duty boots', 'plateauschuhe'], 'held-items', 'Ignoriert Entry-Hazard-Effekte beim Einwechseln.', 'Ignoriert Entry-Hazard-Effekte beim Einwechseln.', true, true, 'manual-battle-core', now()),
  ('weakness-policy', 'Schwaechenpolitik', 'Weakness Policy', 'Schwaechenpolitik', array['weakness-policy', 'weakness policy', 'schwaechenpolitik', 'schwächenpolitik'], 'held-items', 'Erhoeht offensive Werte nach sehr effektivem Treffer.', 'Erhoeht offensive Werte nach sehr effektivem Treffer.', true, true, 'manual-battle-core', now()),
  ('black-sludge', 'Giftschleim', 'Black Sludge', 'Giftschleim', array['black-sludge', 'black sludge', 'giftschleim'], 'held-items', 'Heilt Gift-Pokemon, schadet anderen Typen.', 'Heilt Gift-Pokemon, schadet anderen Typen.', true, true, 'manual-battle-core', now()),
  ('expert-belt', 'Expertengurt', 'Expert Belt', 'Expertengurt', array['expert-belt', 'expert belt', 'expertengurt'], 'held-items', 'Verstaerkt sehr effektive Attacken.', 'Verstaerkt sehr effektive Attacken.', true, true, 'manual-battle-core', now()),
  ('fairy-feather', 'Feenfeder', 'Fairy Feather', 'Feenfeder', array['fairy-feather', 'fairy feather', 'feenfeder', 'fee feder'], 'type-enhancement', 'Verstaerkt Fee-Attacken.', 'Verstaerkt Fee-Attacken.', true, true, 'manual-battle-core', now())
on conflict (id) do update
set display_name = coalesce(public.item_catalog.display_name, excluded.display_name),
    english_name = coalesce(public.item_catalog.english_name, excluded.english_name),
    german_name = coalesce(public.item_catalog.german_name, excluded.german_name),
    search_names = (
      select array(select distinct value from unnest(coalesce(public.item_catalog.search_names, array[]::text[]) || excluded.search_names) as value)
    ),
    category = coalesce(public.item_catalog.category, excluded.category),
    short_effect = coalesce(public.item_catalog.short_effect, excluded.short_effect),
    effect_text = coalesce(public.item_catalog.effect_text, excluded.effect_text),
    is_battle_relevant = true,
    is_champions_legal = true,
    updated_at = now();

update public.item_catalog
set is_battle_relevant = false,
    is_champions_legal = false
where lower(coalesce(id, '') || ' ' || coalesce(display_name, '') || ' ' || coalesce(english_name, '') || ' ' || coalesce(german_name, '') || ' ' || coalesce(category, '') || ' ' || coalesce(champions_category, ''))
  ~ '(catch|catching|bonus|standard-balls|special-balls|apricorn-balls|razz|nanab|pinap|tm|hm|tr|technical|machine|mail|letter|mulch|fossil|apricorn|shard|repel|escape|rope|rod|bike|bicycle|ticket|pass|key|card|parcel|souvenir|photo|flute|doll|honey|nectar|exp.?share|exp-share|experience|candy|rare-candy|incense|memory|memories)';

update public.item_catalog
set is_battle_relevant = false,
    is_champions_legal = false
where category in (
  'medicine',
  'healing',
  'revival',
  'pp-recovery',
  'status-cures',
  'vitamins',
  'stat-boosts',
  'effort-drop'
)
or lower(coalesce(id, '') || ' ' || coalesce(display_name, '') || ' ' || coalesce(english_name, '') || ' ' || coalesce(german_name, '') || ' ' || coalesce(category, '') || ' ' || coalesce(champions_category, ''))
  ~ '(medicine|healing|revival|revive|beleber|potion|trank|restore|genesung|status-cures|full-heal|heiler|antidote|ether|elixir|pp-recovery|pp-up|pp-max|ap-plus|vitamin|vitamins|stat-boosts|x-attack|x-defense|x-speed|x-sp-atk|x-sp-def|x-accuracy|dire-hit|guard-spec)';

update public.item_catalog
set is_battle_relevant = true,
    is_champions_legal = true
where category in (
  'held-items',
  'choice',
  'bad-held-items',
  'type-enhancement',
  'species-specific',
  'plates',
  'mega-stones',
  'z-crystals'
)
and lower(coalesce(id, '') || ' ' || coalesce(display_name, '') || ' ' || coalesce(english_name, '') || ' ' || coalesce(german_name, '') || ' ' || coalesce(category, '') || ' ' || coalesce(champions_category, ''))
  !~ '(catch|catching|bonus|standard-balls|special-balls|apricorn-balls|razz|nanab|pinap|tm|hm|tr|technical|machine|mail|letter|mulch|fossil|apricorn|shard|repel|escape|rope|rod|bike|bicycle|ticket|pass|key|card|parcel|souvenir|photo|flute|doll|honey|nectar|exp.?share|exp-share|experience|candy|rare-candy|incense|memory|memories)';

update public.item_catalog
set is_battle_relevant = true,
    is_champions_legal = true
where id ~ '-berry$'
and lower(coalesce(id, '') || ' ' || coalesce(display_name, '') || ' ' || coalesce(english_name, '') || ' ' || coalesce(german_name, '') || ' ' || coalesce(category, '') || ' ' || coalesce(champions_category, ''))
  !~ '(catch|catching|bonus|standard-balls|special-balls|apricorn-balls|razz|nanab|pinap)';

update public.item_catalog
set is_battle_relevant = true,
    is_champions_legal = true
where id in (
  'leftovers',
  'flame-orb',
  'toxic-orb',
  'life-orb',
  'choice-band',
  'choice-scarf',
  'choice-specs',
  'focus-sash',
  'assault-vest',
  'eviolite',
  'rocky-helmet',
  'safety-goggles',
  'heavy-duty-boots',
  'weakness-policy',
  'mental-herb',
  'power-herb',
  'white-herb',
  'light-clay',
  'throat-spray',
  'room-service',
  'air-balloon',
  'expert-belt',
  'black-sludge',
  'quick-claw',
  'wide-lens',
  'zoom-lens',
  'bright-powder',
  'scope-lens',
  'muscle-band',
  'wise-glasses',
  'clear-amulet',
  'covert-cloak',
  'loaded-dice',
  'booster-energy',
  'fairy-feather'
);
