-- Team Builder: Stats, Form-/Mega-Katalog und Champions-Kontext.
-- Wiederholbar ausfuehrbar.

-- Team-Sheets bekommen einen klaren Modus, damit normale Teams und Champions-
-- Teams dieselbe Builder-UI nutzen koennen, aber getrennte Regeln behalten.
alter table public.team_sheets
  add column if not exists team_mode text not null default 'standard',
  add column if not exists battle_format text not null default 'singles',
  add column if not exists rules_profile text not null default 'open';

alter table public.team_sheets
  drop constraint if exists team_sheets_team_mode_check,
  add constraint team_sheets_team_mode_check
    check (team_mode in ('standard', 'champions'));

alter table public.team_sheets
  drop constraint if exists team_sheets_battle_format_check,
  add constraint team_sheets_battle_format_check
    check (battle_format in ('singles', 'doubles'));

alter table public.team_sheets
  drop constraint if exists team_sheets_rules_profile_check,
  add constraint team_sheets_rules_profile_check
    check (rules_profile in ('open', 'current', 'champions'));

create index if not exists idx_sheets_profile_mode
  on public.team_sheets(profile_id, team_mode)
  where tournament_id is null;

create index if not exists idx_sheets_public_mode
  on public.team_sheets(team_mode, updated_at desc)
  where visibility = 'public';

comment on column public.team_sheets.team_mode is
  'standard = normaler Team Builder, champions = Pokemon Champions Regelprofil.';

comment on column public.team_sheets.battle_format is
  'Info fuer Teamdarstellung und Checks: singles oder doubles.';

comment on column public.team_sheets.rules_profile is
  'Move-/Item-Auswahlprofil: open, current oder champions.';

-- Pokemon-Sets speichern zusaetzlich die ausgewaehlte Form, Level und
-- Verteilungen fuer normale IVs bzw. Champions-DVs.
alter table public.pokemon_sets
  add column if not exists form_pokemon_id text,
  add column if not exists level integer not null default 50,
  add column if not exists ivs jsonb not null default '{}'::jsonb,
  add column if not exists dvs jsonb not null default '{}'::jsonb;

alter table public.pokemon_sets
  drop constraint if exists pokemon_sets_level_check,
  add constraint pokemon_sets_level_check
    check (level between 1 and 100);

comment on column public.pokemon_sets.form_pokemon_id is
  'Optionale konkrete Form aus pokemon_form_catalog, z. B. Mega-Form.';

comment on column public.pokemon_sets.ivs is
  'Normale IV-Verteilung je Stat, Standard im Frontend: 31.';

comment on column public.pokemon_sets.dvs is
  'Champions-Verteilung je Stat, Werte 0 bis 32; 32 entspricht etwa 252 EV.';

-- Bestehender Katalog bleibt der Default-/Species-Katalog, bekommt aber
-- Base Stats fuer allgemeine Stat-Anzeige.
alter table public.pokemon_catalog
  add column if not exists base_hp integer,
  add column if not exists base_atk integer,
  add column if not exists base_def integer,
  add column if not exists base_spa integer,
  add column if not exists base_spd integer,
  add column if not exists base_spe integer,
  add column if not exists species_id text,
  add column if not exists german_name text,
  add column if not exists champions_rulesets text[] not null default '{}',
  add column if not exists is_default boolean not null default true,
  add column if not exists is_champions_legal boolean not null default true;

create index if not exists idx_pokemon_catalog_pokemon_id
  on public.pokemon_catalog(pokemon_id);

create index if not exists idx_pokemon_catalog_champions
  on public.pokemon_catalog(generation, pokemon_name)
  where is_champions_legal = true;

-- Konkrete Formen, inklusive Mega-Formen. Die Tabelle vermeidet Konflikte mit
-- dex_number als Primary Key im bestehenden pokemon_catalog.
create table if not exists public.pokemon_form_catalog (
  pokemon_id text primary key,
  species_pokemon_id text not null references public.pokemon_catalog(pokemon_id) on delete cascade,
  pokemon_name text not null,
  form_name text,
  german_name text,
  champions_rulesets text[] not null default '{}',
  generation integer check (generation between 1 and 9),
  types text[] not null default '{}',
  base_hp integer,
  base_atk integer,
  base_def integer,
  base_spa integer,
  base_spd integer,
  base_spe integer,
  is_default boolean not null default false,
  is_mega boolean not null default false,
  is_champions_legal boolean not null default true,
  source text not null default 'pokeapi',
  updated_at timestamptz not null default now()
);

alter table public.pokemon_form_catalog
  add column if not exists is_champions_legal boolean not null default true;

create index if not exists idx_pokemon_form_species
  on public.pokemon_form_catalog(species_pokemon_id, is_default desc, pokemon_name);

create index if not exists idx_pokemon_form_mega
  on public.pokemon_form_catalog(species_pokemon_id)
  where is_mega = true;

create index if not exists idx_pokemon_form_champions
  on public.pokemon_form_catalog(species_pokemon_id, pokemon_name)
  where is_champions_legal = true;

alter table public.pokemon_form_catalog enable row level security;

drop policy if exists "pokemon_form_catalog_read" on public.pokemon_form_catalog;
create policy "pokemon_form_catalog_read"
  on public.pokemon_form_catalog for select
  to authenticated
  using (true);

grant select on public.pokemon_form_catalog to authenticated;

-- Passende Faehigkeiten pro Pokemon/Form. Der Builder kann damit die globale
-- Ability-Liste auf die tatsaechlich moeglichen Faehigkeiten eingrenzen.
alter table public.move_catalog
  add column if not exists type text,
  add column if not exists damage_class text,
  add column if not exists power integer,
  add column if not exists accuracy integer,
  add column if not exists pp integer,
  add column if not exists priority integer not null default 0,
  add column if not exists generation integer,
  add column if not exists effect_text text,
  add column if not exists short_effect text,
  add column if not exists is_champions_legal boolean not null default true;

create index if not exists idx_move_catalog_type_name
  on public.move_catalog(type, display_name);

create index if not exists idx_move_catalog_champions
  on public.move_catalog(type, display_name)
  where is_champions_legal = true;

alter table public.ability_catalog
  add column if not exists generation integer,
  add column if not exists effect_text text,
  add column if not exists short_effect text;

create table if not exists public.pokemon_ability_catalog (
  pokemon_id text not null,
  ability_id text not null references public.ability_catalog(id) on delete cascade,
  display_name text not null,
  slot integer,
  is_hidden boolean not null default false,
  source text not null default 'pokeapi',
  updated_at timestamptz not null default now(),
  primary key (pokemon_id, ability_id)
);

create index if not exists idx_pokemon_ability_pokemon
  on public.pokemon_ability_catalog(pokemon_id, slot, display_name);

alter table public.pokemon_ability_catalog enable row level security;

drop policy if exists "pokemon_ability_catalog_read" on public.pokemon_ability_catalog;
create policy "pokemon_ability_catalog_read"
  on public.pokemon_ability_catalog for select
  to authenticated
  using (true);

grant select on public.pokemon_ability_catalog to authenticated;

-- Passende Moves pro Pokemon/Form und Regelprofil. Champions-Legalitaet bleibt
-- als Flag/Override pflegbar, weil es dafuer aktuell keine stabile oeffentliche
-- API wie bei normalen Spieldaten gibt.
create table if not exists public.pokemon_move_catalog (
  pokemon_id text not null,
  move_id text not null references public.move_catalog(id) on delete cascade,
  display_name text not null,
  version_group text,
  learn_method text,
  level_learned_at integer not null default 0,
  is_current_gen_legal boolean not null default false,
  is_champions_legal boolean not null default false,
  source text not null default 'pokeapi',
  updated_at timestamptz not null default now(),
  primary key (pokemon_id, move_id, version_group, learn_method)
);

create index if not exists idx_pokemon_move_pokemon
  on public.pokemon_move_catalog(pokemon_id, display_name);

create index if not exists idx_pokemon_move_current
  on public.pokemon_move_catalog(pokemon_id, display_name)
  where is_current_gen_legal = true;

create index if not exists idx_pokemon_move_champions
  on public.pokemon_move_catalog(pokemon_id, display_name)
  where is_champions_legal = true;

alter table public.pokemon_move_catalog enable row level security;

drop policy if exists "pokemon_move_catalog_read" on public.pokemon_move_catalog;
create policy "pokemon_move_catalog_read"
  on public.pokemon_move_catalog for select
  to authenticated
  using (true);

grant select on public.pokemon_move_catalog to authenticated;

-- Referenzkataloge koennen spaeter nach Kampf-/Champions-Relevanz gefiltert
-- werden, ohne die importierten Rohdaten zu verlieren.
alter table public.item_catalog
  add column if not exists german_name text,
  add column if not exists category text,
  add column if not exists champions_category text,
  add column if not exists effect_text text,
  add column if not exists short_effect text,
  add column if not exists fling_power integer,
  add column if not exists is_battle_relevant boolean not null default false,
  add column if not exists is_champions_legal boolean not null default false;

create index if not exists idx_item_catalog_battle
  on public.item_catalog(is_battle_relevant, display_name)
  where is_battle_relevant = true;

create index if not exists idx_item_catalog_champions
  on public.item_catalog(is_champions_legal, display_name)
  where is_champions_legal = true;
