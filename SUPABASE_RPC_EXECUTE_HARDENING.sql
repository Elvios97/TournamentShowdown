-- ==========================================================================
-- Abschließende RPC-Berechtigungen für die Public Beta
-- Nach allen anderen SUPABASE_*.sql-Dateien ausführen.
-- Wiederholbar und tolerant gegenüber optional nicht vorhandenen Funktionen.
-- ==========================================================================

begin;

do $$
declare
  v_function record;
begin
  for v_function in
    select p.oid::regprocedure::text as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'create_tournament_with_host',
        'redeem_invite_code',
        'make_draft_pick',
        'undo_last_draft_pick',
        'create_trade_offer',
        'resolve_trade_offer',
        'generate_round_robin_schedule',
        'set_match_result',
        'reopen_match',
        'update_pool_rankings',
        'reset_pool_rankings',
        'create_tournament_pool',
        'add_catalog_pokemon_to_pool',
        'add_generation_to_pool',
        'replace_team_sheet_pokemon'
      ])
  loop
    execute format('revoke all on function %s from public, anon', v_function.signature);
    execute format('grant execute on function %s to authenticated', v_function.signature);
  end loop;

  -- Triggerfunktionen werden ausschließlich durch Datenbanktrigger ausgeführt.
  for v_function in
    select p.oid::regprocedure::text as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'set_updated_at',
        'handle_new_user',
        'enforce_tournament_owner',
        'enforce_team_sheet_scope',
        'validate_draft_session_scope'
      ])
  loop
    execute format('revoke all on function %s from public, anon, authenticated', v_function.signature);
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;
