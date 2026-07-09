-- Optionaler Regelset-Kontext für persönliche und Turnier-Teams.
-- Bestehende Teams bleiben ohne Zuordnung gültig.

alter table public.team_sheets
  add column if not exists ruleset_id uuid;

alter table public.team_sheets
  drop constraint if exists team_sheets_ruleset_id_fkey,
  add constraint team_sheets_ruleset_id_fkey
    foreign key (ruleset_id)
    references public.rulesets(id)
    on delete set null;

create index if not exists idx_team_sheets_ruleset
  on public.team_sheets(ruleset_id)
  where ruleset_id is not null;

comment on column public.team_sheets.ruleset_id is
  'Optionaler Kontext für Format- und Bauhinweise; keine automatische Legalitätsprüfung.';
