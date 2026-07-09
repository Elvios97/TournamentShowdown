import { selectMany, insertRow, updateRow, rpc } from '../../storage/supabaseRepo.js';
import { getSupabase } from '../../supabaseClient.js';
export { getDraftTurn, rosterCost } from './draftLogic.js';

let realtimeChannelCounter = 0;

export async function listDraftSessions(tournamentId) {
  return selectMany('draft_sessions', { match: { tournament_id: tournamentId }, order: 'created_at', ascending: false });
}

export async function listDraftPicks(sessionId) {
  return selectMany('draft_picks', { match: { draft_session_id: sessionId }, order: 'pick_number' });
}

export async function listTradeOffers(sessionId) {
  return selectMany('trade_offers', { match: { draft_session_id: sessionId }, order: 'created_at', ascending: false });
}

export function createDraftSession(tournamentId, { poolId, rulesetId, pickOrder }) {
  return insertRow('draft_sessions', {
    tournament_id: tournamentId,
    pool_id: poolId,
    ruleset_id: rulesetId,
    pick_order: pickOrder,
    status: 'pending',
  });
}

export function setDraftStatus(sessionId, status) {
  return updateRow('draft_sessions', sessionId, { status });
}

export function makeDraftPick(sessionId, pokemonId) {
  return rpc('make_draft_pick', { p_session_id: sessionId, p_pokemon_id: pokemonId });
}

export function undoLastDraftPick(sessionId) {
  return rpc('undo_last_draft_pick', { p_session_id: sessionId });
}

export function createTradeOffer(sessionId, recipientMemberId, offeredPickId, requestedPickId, message) {
  return rpc('create_trade_offer', {
    p_session_id: sessionId,
    p_recipient_member_id: recipientMemberId,
    p_offered_pick_id: offeredPickId,
    p_requested_pick_id: requestedPickId,
    p_message: message || '',
  });
}

export function resolveTradeOffer(offerId, action) {
  return rpc('resolve_trade_offer', { p_offer_id: offerId, p_action: action });
}

export function subscribeToDraft(sessionId, onChange, onStatus = null) {
  const supabase = getSupabase();
  const channel = supabase
    .channel(`draft-${sessionId}-${++realtimeChannelCounter}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'draft_sessions', filter: `id=eq.${sessionId}`,
    }, onChange)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'draft_picks', filter: `draft_session_id=eq.${sessionId}`,
    }, onChange)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'trade_offers', filter: `draft_session_id=eq.${sessionId}`,
    }, onChange)
    .subscribe(status => onStatus?.(status));

  return () => supabase.removeChannel(channel);
}
