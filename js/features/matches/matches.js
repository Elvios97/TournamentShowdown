// ─── FEATURE: MATCHES / LIGA-TABELLE (MVP) ──────────────────────────
import { selectMany, insertRow, deleteRow, rpc } from '../../storage/supabaseRepo.js';
import { getSupabase } from '../../supabaseClient.js';

let matchChannelCounter = 0;

export async function listMatches(tournamentId) {
  return selectMany('matches', { match: { tournament_id: tournamentId }, order: 'round' });
}

export async function createMatch(tournamentId, { round, playerAMemberId, playerBMemberId, notes }) {
  return insertRow('matches', {
    tournament_id: tournamentId,
    round: round || 1,
    player_a_member_id: playerAMemberId || null,
    player_b_member_id: playerBMemberId || null,
    notes: notes || '',
  });
}

export function generateRoundRobinSchedule(tournamentId) {
  return rpc('generate_round_robin_schedule', { p_tournament_id: tournamentId });
}

export async function setMatchResult(matchId, { scoreA, scoreB }) {
  return rpc('set_match_result', {
    p_match_id: matchId,
    p_score_a: scoreA,
    p_score_b: scoreB,
  });
}

export function reopenMatch(matchId) {
  return rpc('reopen_match', { p_match_id: matchId });
}

export async function deleteMatch(matchId) {
  return deleteRow('matches', matchId);
}

export function subscribeToMatches(tournamentId, onChange) {
  const supabase = getSupabase();
  const channel = supabase
    .channel(`matches-${tournamentId}-${++matchChannelCounter}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${tournamentId}`,
    }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

/** Berechnet eine einfache Liga-Tabelle (Wins/Losses/Points) aus Matches + Mitgliedern. */
export function computeStandings(members, matches) {
  const table = new Map();
  members.forEach(m => table.set(m.id, {
    member: m, played: 0, wins: 0, losses: 0, scored: 0, conceded: 0, difference: 0, points: 0,
  }));
  matches.forEach(m => {
    if (m.status !== 'completed' || !m.winner_member_id) return;
    const rowA = table.get(m.player_a_member_id);
    const rowB = table.get(m.player_b_member_id);
    if (rowA) { rowA.played++; rowA.scored += Number(m.score_a) || 0; rowA.conceded += Number(m.score_b) || 0; }
    if (rowB) { rowB.played++; rowB.scored += Number(m.score_b) || 0; rowB.conceded += Number(m.score_a) || 0; }
    const winnerRow = table.get(m.winner_member_id);
    if (winnerRow) { winnerRow.wins++; winnerRow.points += 3; }
    const loserId = m.winner_member_id === m.player_a_member_id ? m.player_b_member_id : m.player_a_member_id;
    const loserRow = table.get(loserId);
    if (loserRow) loserRow.losses++;
  });
  table.forEach(row => { row.difference = row.scored - row.conceded; });
  return [...table.values()].sort((a, b) =>
    b.points - a.points || b.difference - a.difference || b.scored - a.scored || b.wins - a.wins
  );
}
