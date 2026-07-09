-- Bereinigt Testdaten, ohne Benutzer/Profile oder importierte Katalogdaten zu loeschen.
-- In Supabase im SQL Editor ausfuehren. Die Aktion loescht app-erstellte Testdaten dauerhaft.
--
-- Bleibt erhalten:
-- - auth.users
-- - public.profiles
-- - importierte Kataloge wie pokemon_catalog, move_catalog, item_catalog, ability_catalog
--
-- Wird geloescht:
-- - Turniere, Turnier-Mitglieder, Invite-Codes
-- - Matches
-- - Draft-Sessions, Draft-Picks, Trade-Angebote
-- - Draft-Pools und Pool-Pokemon
-- - Rulesets
-- - Team-Sheets und Pokemon-Sets

begin;

do $$
begin
  if to_regclass('public.trade_offers') is not null then
    execute 'delete from public.trade_offers';
  end if;
end $$;

delete from public.draft_picks;
delete from public.draft_sessions;
delete from public.matches;
delete from public.pokemon_sets;
delete from public.team_sheets;
delete from public.invite_codes;
delete from public.tournament_members;
delete from public.draft_pool_pokemon;
delete from public.draft_pools;
delete from public.rulesets;
delete from public.tournaments;

commit;
