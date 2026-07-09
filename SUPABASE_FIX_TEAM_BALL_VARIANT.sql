-- Fix/Feature: frei waehlbarer Ball-Marker fuer Team Sheets.
--
-- Diese Spalte speichert nur eine harmlose UI-Variante wie:
-- poke, great, ultra, premier, luxury, dive, heal, dusk

alter table team_sheets
  add column if not exists ball_variant text not null default 'poke';

alter table team_sheets
  drop constraint if exists team_sheets_ball_variant_check;

alter table team_sheets
  add constraint team_sheets_ball_variant_check
  check (ball_variant in ('poke','great','ultra','premier','luxury','dive','heal','dusk'));

notify pgrst, 'reload schema';
