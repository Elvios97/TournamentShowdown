-- Referenzkataloge für den Team Builder.
-- Nur lesbar für angemeldete Nutzer; Schreibzugriff erfolgt beim Import über den Service-Role-Key.

create table if not exists public.move_catalog (
  id text primary key,
  display_name text not null,
  source text not null default 'pokeapi',
  updated_at timestamptz not null default now()
);

create table if not exists public.item_catalog (
  id text primary key,
  display_name text not null,
  source text not null default 'pokeapi',
  updated_at timestamptz not null default now()
);

create table if not exists public.ability_catalog (
  id text primary key,
  display_name text not null,
  source text not null default 'pokeapi',
  updated_at timestamptz not null default now()
);

alter table public.move_catalog enable row level security;
alter table public.item_catalog enable row level security;
alter table public.ability_catalog enable row level security;

drop policy if exists "move_catalog_read" on public.move_catalog;
create policy "move_catalog_read" on public.move_catalog for select to authenticated using (true);
drop policy if exists "item_catalog_read" on public.item_catalog;
create policy "item_catalog_read" on public.item_catalog for select to authenticated using (true);
drop policy if exists "ability_catalog_read" on public.ability_catalog;
create policy "ability_catalog_read" on public.ability_catalog for select to authenticated using (true);

grant select on public.move_catalog to authenticated;
grant select on public.item_catalog to authenticated;
grant select on public.ability_catalog to authenticated;

comment on table public.move_catalog is 'Move-Namen für Auswahl und spätere Legalitätsbeziehungen.';
comment on table public.item_catalog is 'Item-Namen für den Team Builder.';
comment on table public.ability_catalog is 'Fähigkeitsnamen für den Team Builder.';
