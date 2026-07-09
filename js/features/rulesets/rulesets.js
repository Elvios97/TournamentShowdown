// ─── FEATURE: RULESETS ───────────────────────────────────────────────
import { getCurrentUserId } from '../../auth.js';
import { selectMany, selectOne, insertRow, updateRow, deleteRow } from '../../storage/supabaseRepo.js';

export async function listRulesetsForTournament(tournamentId) {
  return selectMany('rulesets', { match: { tournament_id: tournamentId }, order: 'created_at' });
}

export async function listPublicRulesetTemplates() {
  return selectMany('rulesets', { match: { is_template: true, visibility: 'public' }, order: 'name' });
}

export async function getRuleset(id) {
  return selectOne('rulesets', { id });
}

export async function createRuleset(tournamentId, form) {
  const userId = getCurrentUserId();
  return insertRow('rulesets', {
    owner_id: userId,
    tournament_id: tournamentId || null,
    name: form.name || 'Ruleset',
    format: form.format || 'singles',
    draft_mode: form.draft_mode || 'none',
    team_size: form.team_size || 6,
    player_count: form.player_count || null,
    allow_duplicates: !!form.allow_duplicates,
    points_budget: form.points_budget || null,
    banned_tags: form.banned_tags || [],
    allowed_tags: form.allowed_tags || [],
    free_text_rules: form.free_text_rules || '',
    is_template: !!form.is_template,
    visibility: form.visibility || 'private',
  });
}

export async function updateRuleset(id, patch) {
  return updateRow('rulesets', id, patch);
}

export async function deleteRuleset(id) {
  return deleteRow('rulesets', id);
}

/** Importiert ein Ruleset-Template als eigenes Ruleset für ein Turnier (kopiert die Werte). */
export async function cloneRulesetIntoTournament(sourceRuleset, tournamentId) {
  const userId = getCurrentUserId();
  return insertRow('rulesets', {
    owner_id: userId,
    tournament_id: tournamentId,
    name: sourceRuleset.name,
    format: sourceRuleset.format,
    draft_mode: sourceRuleset.draft_mode,
    team_size: sourceRuleset.team_size,
    player_count: sourceRuleset.player_count,
    allow_duplicates: sourceRuleset.allow_duplicates,
    points_budget: sourceRuleset.points_budget,
    banned_tags: sourceRuleset.banned_tags || [],
    allowed_tags: sourceRuleset.allowed_tags || [],
    free_text_rules: sourceRuleset.free_text_rules || '',
    is_template: false,
    visibility: 'private',
  });
}

export function exportRulesetJson(ruleset) {
  return {
    schemaVersion: 1,
    type: 'ruleset',
    data: {
      name: ruleset.name, format: ruleset.format, draft_mode: ruleset.draft_mode,
      team_size: ruleset.team_size, player_count: ruleset.player_count,
      allow_duplicates: ruleset.allow_duplicates, points_budget: ruleset.points_budget,
      banned_tags: ruleset.banned_tags, allowed_tags: ruleset.allowed_tags,
      free_text_rules: ruleset.free_text_rules,
    },
  };
}
