// ─── FEATURE: TOURNAMENTS ───────────────────────────────────────────
import { getSupabase } from '../../supabaseClient.js';
import { getCurrentProfile, getCurrentUserId } from '../../auth.js';
import { selectMany, insertRow, updateRow, rpc } from '../../storage/supabaseRepo.js';
import { slugify, uid } from '../../utils.js';

export async function listMyTournaments() {
  const supabase = getSupabase();
  const userId = getCurrentUserId();
  if (getCurrentProfile()?.global_role === 'admin') {
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(t => ({ ...t, my_role: 'admin', my_player_name: null, is_owner: t.owner_id === userId }));
  }
  const [{ data: memberships, error: membershipError }, { data: owned, error: ownedError }] = await Promise.all([
    supabase
    .from('tournament_members')
    .select('role, player_name, tournaments(*)')
    .eq('profile_id', userId),
    supabase
      .from('tournaments')
      .select('*')
      .eq('owner_id', userId),
  ]);
  if (membershipError) throw membershipError;
  if (ownedError) throw ownedError;

  const byId = new Map();
  (owned || []).forEach(t => byId.set(t.id, { ...t, my_role: 'host', my_player_name: null, is_owner: true }));
  (memberships || [])
    .filter(row => row.tournaments)
    .forEach(row => {
      const existing = byId.get(row.tournaments.id);
      byId.set(row.tournaments.id, {
        ...row.tournaments,
        my_role: existing?.is_owner ? 'host' : row.role,
        my_player_name: row.player_name,
        is_owner: !!existing?.is_owner,
      });
    });
  return [...byId.values()].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

export async function listPublicTournaments() {
  return selectMany('tournaments', { match: { visibility: 'public' }, order: 'created_at', ascending: false });
}

export async function createTournament(form) {
  const userId = getCurrentUserId();
  const baseSlug = slugify(form.name);
  let slug = baseSlug;
  let attempt = 0;
  let tournament = null;
  let lastError = null;

  while (attempt < 5 && !tournament) {
    try {
      tournament = await createTournamentViaTables(slug, form, userId);
    } catch (err) {
      lastError = err;
      if (String(err.message || '').includes('duplicate') || err.code === '23505') {
        attempt++;
        slug = `${baseSlug}-${uid().slice(0, 4)}`;
      } else {
        throw err;
      }
    }
  }
  if (!tournament) throw lastError || new Error('Turnier konnte nicht erstellt werden.');

  return tournament;
}

async function createTournamentViaTables(slug, form, userId) {
  return insertRow('tournaments', {
    slug,
    name: form.name,
    description: form.description || '',
    visibility: form.visibility || 'private',
    owner_id: userId,
    show_open_sheets: form.show_open_sheets !== false,
    hide_teams_until_start: !!form.hide_teams_until_start,
  });
}

export async function getTournamentBySlug(slug) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('tournaments').select('*').eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getMyMembership(tournamentId) {
  const userId = getCurrentUserId();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('tournament_members')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('profile_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function joinPublicTournament(tournamentId, playerName) {
  return joinTournamentAsPlayer(tournamentId, playerName);
}

export async function joinTournamentAsPlayer(tournamentId, playerName) {
  const userId = getCurrentUserId();
  const profileName = getCurrentProfile()?.display_name;
  return insertRow('tournament_members', {
    tournament_id: tournamentId,
    profile_id: userId,
    role: 'player',
    player_name: playerName || profileName || null,
  });
}

export async function redeemInviteCode(code) {
  // RPC läuft SECURITY DEFINER serverseitig — Codes sind nicht per SELECT lesbar.
  const rows = await rpc('redeem_invite_code', { p_code: code });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function listMembers(tournamentId) {
  return selectMany('tournament_members', { match: { tournament_id: tournamentId }, order: 'joined_at' });
}

export async function updateMemberRole(memberId, role) {
  return updateRow('tournament_members', memberId, { role });
}

export async function updateTournamentSettings(tournamentId, patch) {
  return updateRow('tournaments', tournamentId, patch);
}

export async function createInviteCode(tournamentId, { role = 'player', maxUses = null, expiresAt = null } = {}) {
  const code = uid().replace(/-/g, '').slice(0, 8).toUpperCase();
  return insertRow('invite_codes', {
    tournament_id: tournamentId,
    code,
    role,
    max_uses: maxUses,
    expires_at: expiresAt,
  });
}

export async function listInviteCodes(tournamentId) {
  // Nur als Host abrufbar (RLS) — wird in der Einstellungen-Tab genutzt.
  return selectMany('invite_codes', { match: { tournament_id: tournamentId }, order: 'created_at', ascending: false });
}
