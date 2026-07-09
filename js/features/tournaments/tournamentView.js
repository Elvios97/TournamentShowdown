// ─── FEATURE: TOURNAMENT VIEW (Tab-Shell) ────────────────────────────
import { esc, toast, openModal, closeModal } from '../../utils.js';
import { navigate } from '../../router.js';
import { getCurrentProfile, getCurrentUserId } from '../../auth.js';
import {
  getTournamentBySlug, getMyMembership, listMembers, updateMemberRole,
  updateTournamentSettings, createInviteCode, listInviteCodes, joinPublicTournament,
  joinTournamentAsPlayer,
} from './tournaments.js';
import { listRulesetsForTournament, createRuleset, updateRuleset, deleteRuleset } from '../rulesets/rulesets.js';
import {
  listPoolsForTournament, listPoolPokemon, listPokemonCatalog, createTournamentPool,
  addCatalogPokemonToPool, addGenerationToPool, updatePoolRankings, resetPoolRankings,
  downloadRankingJson, parseRankingFile, removePoolPokemon, filterPool, randomFromPool,
} from '../pools/pools.js';
import {
  listSheetsForTournament, listPersonalSheets, getMySheet, listPokemonForSheet,
  createSheet, updateSheet, importShowdownIntoSheet, exportSheetAsShowdown,
  copyPersonalSheetToTournament, createPersonalSheet, replacePokemonSets,
} from '../teams/teamSheets.js?v=20260705b';
import { renderPokemonGrid, renderSheetCard, renderTeamBallSelect } from '../openSheets/openSheets.js';
import {
  listMatches, createMatch, generateRoundRobinSchedule, setMatchResult, reopenMatch,
  deleteMatch, subscribeToMatches, computeStandings,
} from '../matches/matches.js';
import {
  listDraftSessions, listDraftPicks, listTradeOffers, createDraftSession,
  setDraftStatus, makeDraftPick, undoLastDraftPick, createTradeOffer,
  resolveTradeOffer, subscribeToDraft, getDraftTurn, rosterCost,
} from '../draft/draft.js?v=20260705';
import { spriteAttrs } from '../../sprites.js';
import { normalizeRealtimeStatus, realtimeStatusCopy, formatDraftError } from '../draft/draftLogic.js?v=20260705';
import {
  exportRuleset, exportPool, exportTeamSheet, exportTournamentBackup, exportDraftConfig,
  importRulesetFile, importPoolFile, importTeamSheetFile, importDraftConfigFile,
} from '../importExport/importExport.js?v=20260705b';

const TABS = [
  { id: 'overview', label: 'Übersicht' },
  { id: 'rules', label: 'Regeln' },
  { id: 'members', label: 'Teilnehmer' },
  { id: 'teams', label: 'Teams / Open Sheets' },
  { id: 'matches', label: 'Matches / Liga' },
  { id: 'pool', label: 'Pool' },
  { id: 'draft', label: 'Draft' },
  { id: 'champions', label: 'Champions' },
  { id: 'settings', label: 'Einstellungen', hostOnly: true },
];

let ctx = null; // { tournament, membership, role }
let draftRealtimeSessionId = null;
let stopDraftRealtime = null;
let draftRealtimeTimer = null;
let draftRealtimeStatus = 'connecting';
let draftRealtimeRenderPending = false;
let draftPickPending = false;
const draftUiState = { view: 'live', search: '', tier: '' };
let matchRealtimeTournamentId = null;
let stopMatchRealtime = null;
let matchRealtimeTimer = null;

function disconnectMatchRealtime() {
  if (matchRealtimeTimer) clearTimeout(matchRealtimeTimer);
  matchRealtimeTimer = null;
  if (stopMatchRealtime) stopMatchRealtime();
  stopMatchRealtime = null;
  matchRealtimeTournamentId = null;
}

function ensureMatchRealtime(tournamentId) {
  if (!tournamentId || matchRealtimeTournamentId === tournamentId) return;
  disconnectMatchRealtime();
  matchRealtimeTournamentId = tournamentId;
  stopMatchRealtime = subscribeToMatches(tournamentId, () => {
    if (matchRealtimeTimer) clearTimeout(matchRealtimeTimer);
    matchRealtimeTimer = setTimeout(() => {
      if (document.getElementById('matches-list')) renderTab('matches');
    }, 140);
  });
}

function disconnectDraftRealtime() {
  if (draftRealtimeTimer) clearTimeout(draftRealtimeTimer);
  draftRealtimeTimer = null;
  if (stopDraftRealtime) stopDraftRealtime();
  stopDraftRealtime = null;
  draftRealtimeSessionId = null;
  draftRealtimeStatus = 'offline';
}

function updateDraftRealtimeIndicator(status) {
  draftRealtimeStatus = status;
  const copy = realtimeStatusCopy(status);
  const indicator = document.getElementById('draft-realtime-state');
  if (!indicator) return;
  indicator.className = `draft-realtime-state ${status}`;
  indicator.title = copy.hint;
  indicator.innerHTML = `<span aria-hidden="true"></span>${esc(copy.label)}`;
}

function ensureDraftRealtime(sessionId) {
  if (!sessionId || draftRealtimeSessionId === sessionId) return;
  disconnectDraftRealtime();
  draftRealtimeSessionId = sessionId;
  draftRealtimeStatus = 'connecting';
  stopDraftRealtime = subscribeToDraft(sessionId, () => {
    if (draftRealtimeTimer) clearTimeout(draftRealtimeTimer);
    draftRealtimeTimer = setTimeout(async () => {
      if (!document.getElementById('draft-view-live') || draftRealtimeRenderPending) return;
      draftRealtimeRenderPending = true;
      try { await renderTab('draft'); }
      finally { draftRealtimeRenderPending = false; }
    }, 140);
  }, rawStatus => {
    if (draftRealtimeSessionId === sessionId) {
      updateDraftRealtimeIndicator(normalizeRealtimeStatus(rawStatus));
    }
  });
}

function memberDisplayName(member) {
  if (!member) return '';
  return member.player_name
    || (member.profile_id === getCurrentUserId() ? getCurrentProfile()?.display_name : '')
    || 'Unbekannter Spieler';
}

function battleFormatFromRuleset(ruleset) {
  const value = `${ruleset?.format || ''} ${ruleset?.name || ''}`.toLowerCase();
  return /double|doppel|vgc|2v2/.test(value) ? 'doubles' : 'singles';
}

function draftPicksToPokemonSets(picks, memberId) {
  return picks
    .filter(pick => pick.member_id === memberId)
    .sort((a, b) => Number(a.pick_number || 0) - Number(b.pick_number || 0))
    .map((pick, index) => ({
      pokemon_id: pick.pokemon_id,
      pokemon_name: pick.pokemon_name,
      form_pokemon_id: pick.pokemon_id,
      nickname: null,
      item: null,
      ability: null,
      tera_type: null,
      nature: null,
      level: 50,
      evs: {},
      ivs: {},
      dvs: {},
      moves: [],
      notes: `Aus Draft-Pick #${pick.pick_number || index + 1} importiert.`,
      sort_order: index,
    }));
}

export async function renderTournamentRoute(params, tab = 'overview') {
  const root = document.getElementById('view-tournament');
  root.innerHTML = `<div class="empty-state">Lade Turnier…</div>`;

  let tournament;
  try {
    tournament = await getTournamentBySlug(params.slug);
  } catch (err) {
    root.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Fehler</div><div style="font-size:13px;color:var(--text-muted)">${esc(err.message)}</div></div>`;
    return;
  }
  if (!tournament) {
    root.innerHTML = `<div class="empty-state"><div class="empty-icon">❓</div><div class="empty-title">Turnier nicht gefunden</div><div style="font-size:13px;color:var(--text-muted)">Privat, gelöscht oder falscher Link.</div></div>`;
    return;
  }

  const userId = getCurrentUserId();
  const membership = await getMyMembership(tournament.id).catch(() => null);
  const role = tournament.owner_id === userId
    ? 'host'
    : (membership ? membership.role : (tournament.visibility === 'public' ? 'visitor' : null));

  if (!role) {
    root.innerHTML = `<div class="empty-state"><div class="empty-icon">🔒</div><div class="empty-title">Kein Zugriff</div><div style="font-size:13px;color:var(--text-muted)">Dieses Turnier ist privat. Du brauchst einen Einladungslink/-code.</div></div>`;
    return;
  }

  ctx = { tournament, membership, role };
  localStorage.setItem('ots:last-tournament-slug', tournament.slug);
  updateTournamentContextBar(tournament, role);

  const visibleTabs = TABS.filter(t => !t.hostOnly || role === 'host');
  if (!visibleTabs.some(item => item.id === tab)) tab = 'overview';
  root.innerHTML = `
    <div class="modal-tabs" id="t-tabs" style="border-bottom:1px solid var(--border);margin-bottom:18px">
      ${visibleTabs.map(t => `<button class="modal-tab ${t.id === tab ? 'active' : ''}" onclick="location.hash='/t/${esc(tournament.slug)}/${t.id}'">${esc(t.label)}</button>`).join('')}
    </div>
    ${role === 'visitor' ? `<div style="margin-bottom:14px"><button class="btn btn-primary btn-sm" onclick="window.joinThisPublicTournament()">Diesem Turnier beitreten</button></div>` : ''}
    <div id="t-tab-content"><div class="empty-state">Lade…</div></div>
  `;

  root.innerHTML = `
    <div class="app-shell">
      <aside class="app-sidebar" aria-label="Turniernavigation">
        <div class="app-sidebar-title">Turnierbereiche</div>
        ${visibleTabs.map(t => `<button class="modal-tab ${t.id === tab ? 'active' : ''}" onclick="location.hash='/t/${esc(tournament.slug)}/${t.id}'">${esc(t.label)}</button>`).join('')}
      </aside>
      <section class="app-content">
        <div class="tournament-page-title">
          <div>
            <h1>${esc(tournament.name)}</h1>
            <p>${esc(tournament.description || 'Keine Beschreibung hinterlegt.')}</p>
          </div>
          <div class="meta-row">
            <span class="badge badge-primary">${esc(role)}</span>
            <span class="badge">${esc(tournament.status)}</span>
            <span class="badge badge-info">${esc(tournament.visibility)}</span>
          </div>
        </div>
        ${role === 'visitor' ? `<div style="margin-bottom:14px"><button class="btn btn-primary btn-sm" onclick="window.joinThisPublicTournament()">Diesem Turnier beitreten</button></div>` : ''}
        <div id="t-tab-content"><div class="empty-state">Lade...</div></div>
      </section>
    </div>
  `;

  window.joinThisPublicTournament = async () => {
    try {
      await joinPublicTournament(tournament.id);
      toast('Beigetreten ✓', 'success');
      renderTournamentRoute(params, tab);
    } catch (err) { toast('Fehler: ' + err.message, 'error'); }
  };

  window.joinThisTournamentAsPlayer = async () => {
    try {
      await joinTournamentAsPlayer(tournament.id);
      toast('Du nimmst jetzt als Spieler teil', 'success');
      renderTournamentRoute(params, tab);
    } catch (err) { toast('Fehler: ' + err.message, 'error'); }
  };

  await renderTab(tab);
}

function updateTournamentContextBar(tournament, role) {
  const bar = document.getElementById('tournament-context-bar');
  if (!bar) return;
  bar.style.display = 'flex';
  bar.innerHTML = `
    <span class="context-pill">OTS ${esc(tournament.name)}</span>
    <span class="badge badge-primary">${esc(role)}</span>
    <button class="btn btn-ghost btn-xs context-dashboard-link" onclick="location.hash='/'">Zum Dashboard</button>
  `;
}
export function hideTournamentContextBar() {
  disconnectDraftRealtime();
  disconnectMatchRealtime();
  const bar = document.getElementById('tournament-context-bar');
  if (bar) { bar.style.display = 'none'; bar.innerHTML = ''; }
}

async function renderTab(tab) {
  const content = document.getElementById('t-tab-content');
  if (!content || !ctx) return;
  if (tab !== 'draft') disconnectDraftRealtime();
  if (tab !== 'matches') disconnectMatchRealtime();
  try {
    switch (tab) {
      case 'overview': return content.innerHTML = renderOverviewTab();
      case 'rules': return await renderRulesTab(content);
      case 'members': return await renderMembersTab(content);
      case 'teams': return await renderTeamsTab(content);
      case 'matches': return await renderMatchesTab(content);
      case 'pool': return await renderPoolTab(content);
      case 'draft': return await renderDraftTab(content);
      case 'champions': return content.innerHTML = renderChampionsTab();
      case 'settings': return await renderSettingsTab(content);
      default: return content.innerHTML = renderOverviewTab();
    }
  } catch (err) {
    content.innerHTML = `<div class="empty-state">Fehler: ${esc(err.message)}</div>`;
  }
}

function renderChampionsTab() {
  return `
    <div class="tournament-setup champions-tournament-panel">
      <div>
        <span class="eyebrow">Champions</span>
        <div class="tournament-setup-title">Champions-Teams vorbereiten</div>
        <p>
          Für Champions-Teams ist der neue Team Builder aktiv. Dort kannst du Level-50-Sets,
          Champions-Verteilung, Mega-Formen, Speed Order und Team-Prüfung nutzen.
        </p>
      </div>
      <div class="champions-tournament-actions">
        <button class="btn btn-primary" onclick="location.hash='/champions'">Champions-Teams öffnen</button>
        <button class="btn btn-secondary" onclick="location.hash='/teams'">Normale Teams ansehen</button>
      </div>
    </div>`;
}

// ─── OVERVIEW ─────────────────────────────────────────────────────────
function renderOverviewTab() {
  const t = ctx.tournament;
  return `
    <div class="tournament-setup">
      <div class="tournament-setup-title">🏆 ${esc(t.name)}</div>
      <div style="color:var(--text-dim);font-size:13px;margin-bottom:12px">${esc(t.description || 'Keine Beschreibung.')}</div>
      <div style="display:flex;gap:18px;flex-wrap:wrap;font-size:12px;color:var(--text-muted)">
        <span>Status: <b style="color:var(--text)">${esc(t.status)}</b></span>
        <span>Sichtbarkeit: <b style="color:var(--text)">${esc(t.visibility)}</b></span>
        <span>Open Sheets sichtbar: <b style="color:var(--text)">${t.show_open_sheets ? 'ja' : 'nein'}</b></span>
        <span>Teams bis Start verborgen: <b style="color:var(--text)">${t.hide_teams_until_start ? 'ja' : 'nein'}</b></span>
      </div>
      <div style="margin-top:14px;display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" onclick="window.exportTournamentBackupNow()">↓ Backup exportieren</button>
      </div>
    </div>`;
}

window.exportTournamentBackupNow = async () => {
  try { await exportTournamentBackup(ctx.tournament); toast('Backup exportiert ✓', 'success'); }
  catch (err) { toast('Fehler: ' + err.message, 'error'); }
};

// ─── RULES ────────────────────────────────────────────────────────────
async function renderRulesTab(content) {
  const rulesets = await listRulesetsForTournament(ctx.tournament.id);
  const isHost = ctx.role === 'host';
  content.innerHTML = `
    <div class="section-header">
      <span class="section-title">Ruleset</span>
      ${isHost ? `<div style="display:flex;gap:6px">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('rs-import-file').click()">↑ Import</button>
        <input type="file" id="rs-import-file" accept=".json" style="display:none" onchange="window.handleRulesetImport(event)" />
        <button class="btn btn-primary btn-sm" onclick="window.openRulesetEditor()">+ Ruleset</button>
      </div>` : ''}
    </div>
    <div id="rs-list">${rulesets.length ? rulesets.map(renderRulesetCard(isHost)).join('') : '<div class="empty-state">Noch kein Ruleset definiert.</div>'}</div>
  `;

  window.handleRulesetImport = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try { await importRulesetFile(file, ctx.tournament.id); toast('Ruleset importiert ✓', 'success'); renderTab('rules'); }
    catch (err) { toast('Fehler: ' + err.message, 'error'); }
    e.target.value = '';
  };
  window.exportRulesetNow = async (id) => {
    const rs = rulesets.find(r => r.id === id);
    try { await exportRuleset(rs); } catch (err) { toast('Fehler: ' + err.message, 'error'); }
  };
  window.deleteRulesetNow = async (id) => {
    if (!confirm('Ruleset löschen?')) return;
    try { await deleteRuleset(id); renderTab('rules'); } catch (err) { toast('Fehler: ' + err.message, 'error'); }
  };
  window.openRulesetEditor = (id) => openRulesetModal(rulesets.find(r => r.id === id) || null);
}

function renderRulesetCard(isHost) {
  return (r) => `<div class="tournament-setup" style="margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;align-items:baseline">
      <div class="tournament-setup-title">${esc(r.name)}</div>
      ${isHost ? `<div style="display:flex;gap:6px">
        <button class="btn btn-ghost btn-xs" onclick="window.exportRulesetNow('${r.id}')">Export</button>
        <button class="btn btn-ghost btn-xs" onclick="window.openRulesetEditor('${r.id}')">Bearbeiten</button>
        <button class="btn btn-danger btn-xs" onclick="window.deleteRulesetNow('${r.id}')">Löschen</button>
      </div>` : ''}
    </div>
    <div style="font-size:12px;color:var(--text-muted);display:flex;gap:14px;flex-wrap:wrap;margin-top:6px">
      <span>Format: <b style="color:var(--text)">${esc(r.format)}</b></span>
      <span>Draft: <b style="color:var(--text)">${esc(r.draft_mode)}</b></span>
      <span>Team-Größe: <b style="color:var(--text)">${r.team_size}</b></span>
      ${r.points_budget ? `<span>Budget: <b style="color:var(--text)">${r.points_budget}</b></span>` : ''}
    </div>
    ${r.free_text_rules ? `<div style="margin-top:8px;font-size:12px;color:var(--text-dim);white-space:pre-wrap">${esc(r.free_text_rules)}</div>` : ''}
  </div>`;
}

function openRulesetModal(existing) {
  const isEdit = !!existing;
  document.getElementById('rsm-title').textContent = isEdit ? 'Ruleset bearbeiten' : 'Ruleset erstellen';
  document.getElementById('rsm-name').value = existing?.name || '';
  document.getElementById('rsm-format').value = existing?.format || 'singles';
  document.getElementById('rsm-draftmode').value = existing?.draft_mode || 'none';
  document.getElementById('rsm-teamsize').value = existing?.team_size || 6;
  document.getElementById('rsm-budget').value = existing?.points_budget || '';
  document.getElementById('rsm-freetext').value = existing?.free_text_rules || '';
  document.getElementById('rsm-template').checked = !!existing?.is_template;
  window.submitRulesetModal = async () => {
    const form = {
      name: document.getElementById('rsm-name').value.trim() || 'Ruleset',
      format: document.getElementById('rsm-format').value,
      draft_mode: document.getElementById('rsm-draftmode').value,
      team_size: parseInt(document.getElementById('rsm-teamsize').value) || 6,
      points_budget: parseInt(document.getElementById('rsm-budget').value) || null,
      free_text_rules: document.getElementById('rsm-freetext').value,
      is_template: document.getElementById('rsm-template').checked,
      visibility: document.getElementById('rsm-template').checked ? 'public' : 'private',
    };
    try {
      if (isEdit) await updateRuleset(existing.id, form);
      else await createRuleset(ctx.tournament.id, form);
      closeModal('ruleset-edit');
      toast('Ruleset gespeichert ✓', 'success');
      renderTab('rules');
    } catch (err) { toast('Fehler: ' + err.message, 'error'); }
  };
  openModal('ruleset-edit');
}
window.openRulesetEditor = (id) => openRulesetModal(null); // wird in renderRulesTab() überschrieben, sobald Daten da sind

// ─── MEMBERS ──────────────────────────────────────────────────────────
async function renderMembersTab(content) {
  const members = await listMembers(ctx.tournament.id);
  const isHost = ctx.role === 'host';
  content.innerHTML = `
    <div class="section-header">
      <span class="section-title">${members.length} Teilnehmer</span>
      ${isHost ? `<div style="display:flex;gap:6px;flex-wrap:wrap">
        ${!ctx.membership ? `<button class="btn btn-ghost btn-sm" onclick="window.joinThisTournamentAsPlayer()">Selbst als Spieler teilnehmen</button>` : ''}
        <button class="btn btn-primary btn-sm" onclick="window.openInviteCodeModal()">+ Einladungscode</button>
      </div>` : ''}
    </div>
    <div class="profiles-grid">
      ${members.map(m => `<div class="profile-card" style="cursor:default">
        <div class="profile-card-header">
          <div class="profile-avatar" style="background:rgba(56,189,248,.15);color:var(--accent2)">${esc((memberDisplayName(m) || '?')[0] || '?')}</div>
          <div>
            <div class="profile-name">${esc(memberDisplayName(m))}</div>
            <div class="profile-team-count">${esc(m.team_name || '')}</div>
          </div>
        </div>
        <div class="profile-card-footer">
          ${isHost ? `<select class="form-select" style="width:auto;padding:3px 8px;font-size:11px" onchange="window.changeMemberRole('${m.id}', this.value)">
            ${['host', 'player', 'viewer'].map(r => `<option value="${r}" ${r === m.role ? 'selected' : ''}>${r}</option>`).join('')}
          </select>` : `<span class="type-chip" style="background:var(--surface3);color:var(--text-dim)">${esc(m.role)}</span>`}
        </div>
      </div>`).join('')}
    </div>
  `;
  window.changeMemberRole = async (memberId, role) => {
    try { await updateMemberRole(memberId, role); toast('Rolle aktualisiert ✓', 'success'); }
    catch (err) { toast('Fehler: ' + err.message, 'error'); }
  };
  window.openInviteCodeModal = () => openModal('invite-code');
  window.submitCreateInviteCode = async () => {
    const role = document.getElementById('ic-role').value;
    const maxUses = parseInt(document.getElementById('ic-maxuses').value) || null;
    try {
      const invite = await createInviteCode(ctx.tournament.id, { role, maxUses });
      document.getElementById('ic-result').textContent = invite.code;
      document.getElementById('ic-result-box').style.display = 'block';
      toast('Code erstellt ✓', 'success');
    } catch (err) { toast('Fehler: ' + err.message, 'error'); }
  };
}
// ─── TEAMS / OPEN SHEETS ────────────────────────────────────────────
async function renderTeamsTab(content) {
  const t = ctx.tournament;
  const [sheets, myMembership] = await Promise.all([
    listSheetsForTournament(t.id),
    getMyMembership(t.id),
  ]);
  const myUserId = getCurrentUserId();
  const mySheet = sheets.find(s => s.profile_id === myUserId);
  const canViewOtherSheets = ctx.role === 'host'
    || (t.show_open_sheets && (!t.hide_teams_until_start || t.status !== 'setup'));
  const visibleSheets = canViewOtherSheets
    ? sheets
    : sheets.filter(s => s.profile_id === myUserId);
  const personalSheets = myMembership ? await listPersonalSheets().catch(() => []) : [];
  const members = await listMembers(t.id);
  const memberName = (id) => memberDisplayName(members.find(m => m.id === id));
  const hiddenSheetsCount = Math.max(0, sheets.length - visibleSheets.length);
  let openSheetId = null;

  content.innerHTML = `
    <div class="section-header">
      <span class="section-title">Open Team Sheets</span>
      ${!myMembership && ctx.role === 'host' ? `<button class="btn btn-ghost btn-sm" onclick="window.joinThisTournamentAsPlayer()">Selbst als Spieler teilnehmen</button>` : ''}
      ${myMembership ? `<div style="display:flex;gap:6px;flex-wrap:wrap">
        ${(!mySheet) ? `<button class="btn btn-primary btn-sm" onclick="window.createMySheet()">+ Mein Team Sheet anlegen</button>` : ''}
        ${personalSheets.length ? `<select class="form-select" id="personal-team-select" style="width:auto;min-width:220px">
          ${personalSheets.map(s => `<option value="${s.id}">${esc(s.title || 'Team')}</option>`).join('')}
        </select>
        <button class="btn btn-ghost btn-sm" onclick="window.copyPersonalTeamIntoTournament()">${mySheet ? 'Eigenes Sheet überschreiben' : 'Team einfügen'}</button>` : ''}
      </div>` : ''}
    </div>
    ${!canViewOtherSheets && hiddenSheetsCount ? `<div class="profile-alert" style="margin-bottom:12px">Andere Teams sind in diesem Turnier aktuell verborgen.</div>` : ''}
    <div id="sheets-list">
      ${visibleSheets.length ? visibleSheets.map(s => renderSheetCard(s, s._count || 0, memberName(s.member_id))).join('') : '<div class="empty-state">Noch keine sichtbaren Team Sheets.</div>'}
    </div>
    <div id="sheet-detail" style="margin-top:20px"></div>
  `;

  window.createMySheet = async () => {
    if (!myMembership) { toast('Du bist kein Mitglied dieses Turniers.', 'error'); return; }
    try {
      const sheet = await createSheet(t.id, myMembership.id, memberDisplayName(myMembership) || 'Mein Team');
      toast('Team Sheet angelegt ✓', 'success');
      renderTab('teams');
      setTimeout(() => openSheetDetail(sheet.id), 50);
    } catch (err) { toast('Fehler: ' + err.message, 'error'); }
  };

  window.copyPersonalTeamIntoTournament = async () => {
    if (!myMembership) { toast('Du bist kein Mitglied dieses Turniers.', 'error'); return; }
    const sourceSheetId = document.getElementById('personal-team-select')?.value;
    if (!sourceSheetId) { toast('Kein Team ausgewählt', 'error'); return; }
    if (mySheet && !confirm('Dein vorhandenes Turnier-Sheet wird überschrieben. Fortfahren?')) return;
    try {
      const sheet = await copyPersonalSheetToTournament(sourceSheetId, t.id, myMembership.id, mySheet || null);
      toast(mySheet ? 'Team überschrieben' : 'Team eingefügt', 'success');
      await renderTab('teams');
      setTimeout(() => window.openSheetDetail(sheet.id), 50);
    } catch (err) { toast('Fehler: ' + err.message, 'error'); }
  };

  window.openSheetDetail = async (sheetId) => {
    const box = document.getElementById('sheet-detail');
    if (openSheetId === sheetId && box?.innerHTML.trim()) {
      openSheetId = null;
      box.innerHTML = '';
      return;
    }
    const sheet = visibleSheets.find(s => s.id === sheetId) || mySheet;
    if (!sheet) return;
    openSheetId = sheetId;
    const pokemon = await listPokemonForSheet(sheet.id);
    const isOwner = sheet.profile_id === myUserId;
    const canEdit = (isOwner && !sheet.is_locked) || ctx.role === 'host';
    box.innerHTML = `
      <div class="tournament-setup">
        <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px">
          <div class="tournament-setup-title">${esc(sheet.title)} ${sheet.is_locked ? '🔒' : ''}</div>
          <div style="display:flex;gap:6px">
            ${canEdit ? renderTeamBallSelect(sheet.ball_variant, `window.updateTournamentTeamBall('${sheet.id}', this.value)`) : ''}
            <button class="btn btn-ghost btn-sm" onclick="window.exportSheetNow('${sheet.id}')">↓ JSON</button>
            <button class="btn btn-ghost btn-sm" onclick="window.exportSheetShowdownNow('${sheet.id}')">↓ Showdown</button>
            ${canEdit ? `<button class="btn btn-ghost btn-sm" onclick="document.getElementById('ts-import-file').click()">↑ Showdown-Import</button>
            <input type="file" id="ts-import-file" accept=".txt,.json" style="display:none" onchange="window.handleSheetImport(event,'${sheet.id}')" />` : ''}
            ${ctx.role === 'host' ? `<button class="btn btn-ghost btn-sm" onclick="window.toggleSheetLock('${sheet.id}', ${!sheet.is_locked})">${sheet.is_locked ? 'Entsperren' : 'Sperren'}</button>` : ''}
          </div>
        </div>
        ${canEdit ? `<div class="form-group" style="margin-top:10px">
          <label class="form-label">Showdown-Export einfügen (ersetzt aktuelles Sheet)</label>
          <textarea class="form-textarea" id="ts-paste-${sheet.id}" placeholder="Tapu Koko @ Life Orb&#10;Ability: Electric Surge&#10;..."></textarea>
          <button class="btn btn-primary btn-sm" style="margin-top:6px" onclick="window.pasteShowdownIntoSheet('${sheet.id}')">Übernehmen</button>
        </div>` : ''}
        <div style="margin-top:14px">${renderPokemonGrid(pokemon)}</div>
      </div>
    `;
  };

  window.exportSheetNow = async (sheetId) => {
    const sheet = visibleSheets.find(s => s.id === sheetId);
    if (!sheet) { toast('Dieses Team ist aktuell verborgen.', 'error'); return; }
    try { await exportTeamSheet(sheet); } catch (err) { toast('Fehler: ' + err.message, 'error'); }
  };
  window.exportSheetShowdownNow = async (sheetId) => {
    if (!visibleSheets.some(s => s.id === sheetId)) {
      toast('Dieses Team ist aktuell verborgen.', 'error');
      return;
    }
    try {
      const pokemon = await listPokemonForSheet(sheetId);
      const text = exportSheetAsShowdown(pokemon);
      navigator.clipboard?.writeText(text).catch(() => {});
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'team.txt'; a.click();
      URL.revokeObjectURL(url);
      toast('Showdown-Export gespeichert (+ Zwischenablage) ✓', 'success');
    } catch (err) { toast('Fehler: ' + err.message, 'error'); }
  };
  window.handleSheetImport = async (e, sheetId) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      if (file.name.endsWith('.json')) await importTeamSheetFile(file, sheetId);
      else await importShowdownIntoSheet(sheetId, await file.text());
      toast('Team importiert ✓', 'success');
      openSheetDetail(sheetId);
    } catch (err) { toast('Fehler: ' + err.message, 'error'); }
    e.target.value = '';
  };
  window.pasteShowdownIntoSheet = async (sheetId) => {
    const text = document.getElementById(`ts-paste-${sheetId}`).value.trim();
    if (!text) { toast('Kein Text', 'error'); return; }
    try {
      await importShowdownIntoSheet(sheetId, text);
      toast('Team übernommen ✓', 'success');
      window.openSheetDetail(sheetId);
    } catch (err) { toast('Fehler: ' + err.message, 'error'); }
  };
  window.toggleSheetLock = async (sheetId, lock) => {
    try { await updateSheet(sheetId, { is_locked: lock }); toast(lock ? 'Sheet gesperrt 🔒' : 'Sheet entsperrt', 'success'); renderTab('teams'); }
    catch (err) { toast('Fehler: ' + err.message, 'error'); }
  };

  window.updateTournamentTeamBall = async (sheetId, ballVariant) => {
    try {
      await updateSheet(sheetId, { ball_variant: ballVariant });
      toast('Team-Marker gespeichert', 'success');
      renderTab('teams');
    } catch (err) { toast('Fehler: ' + err.message, 'error'); }
  };

  if (mySheet) setTimeout(() => window.openSheetDetail(mySheet.id), 30);
}

// ─── MATCHES / LIGA ──────────────────────────────────────────────────
async function renderMatchesTab(content) {
  const t = ctx.tournament;
  const isHost = ctx.role === 'host';
  const [members, matches] = await Promise.all([listMembers(t.id), listMatches(t.id)]);
  ensureMatchRealtime(t.id);
  const players = members.filter(member => member.role !== 'viewer');
  const standings = computeStandings(players, matches);
  const memberOptions = players.map(m => `<option value="${m.id}">${esc(memberDisplayName(m))}</option>`).join('');
  const scheduledCount = matches.filter(m => m.status !== 'completed').length;
  const completedCount = matches.filter(m => m.status === 'completed').length;
  const roundCount = matches.reduce((max, match) => Math.max(max, Number(match.round) || 0), 0);

  content.innerHTML = `
    <section class="match-page-header">
      <div><h2>Matches &amp; Liga</h2><p>Begegnungen verwalten, Ergebnisse eintragen und die Tabelle verfolgen.</p></div>
      ${isHost ? `<div class="match-header-actions">${!matches.length ? '<button class="btn btn-primary" onclick="window.createLeagueSchedule()">Spielplan erstellen</button>' : ''}<button class="btn btn-secondary" onclick="document.getElementById('match-create-panel').classList.toggle('open')">+ Einzelnes Match</button></div>` : ''}
    </section>
    <section class="match-summary-grid">
      <article><span>Gesamt</span><strong>${matches.length}</strong><small>Begegnungen</small></article>
      <article class="open"><span>Offen</span><strong>${scheduledCount}</strong><small>Noch ohne Ergebnis</small></article>
      <article class="done"><span>Abgeschlossen</span><strong>${completedCount}</strong><small>Ergebnis gespeichert</small></article>
      <article class="players"><span>Runden</span><strong>${roundCount}</strong><small>${players.length} Spieler</small></article>
    </section>

    ${isHost ? `<section class="match-create-panel" id="match-create-panel">
      <div class="match-panel-title"><div><h3>Neues Match anlegen</h3><p>Wähle Runde und beide Teilnehmer.</p></div><button class="icon-button" onclick="document.getElementById('match-create-panel').classList.remove('open')" aria-label="Schließen">×</button></div>
      <div class="match-create-grid">
        <div class="setup-group"><label class="form-label">Runde</label><input class="form-input" id="mm-round" type="number" value="1" min="1" /></div>
        <div class="setup-group"><label class="form-label">Spieler A</label><select class="form-select" id="mm-a">${memberOptions}</select></div>
        <div class="setup-group"><label class="form-label">Spieler B</label><select class="form-select" id="mm-b">${memberOptions}</select></div>
        <div class="setup-group match-notes-field"><label class="form-label">Notiz</label><input class="form-input" id="mm-notes" placeholder="Optional, z. B. Halbfinale" /></div>
      </div>
      <div class="match-create-actions"><button class="btn btn-secondary" onclick="document.getElementById('match-create-panel').classList.remove('open')">Abbrechen</button><button class="btn btn-primary" onclick="window.submitCreateMatch()">Match anlegen</button></div>
    </section>` : ''}

    <div class="match-page-layout">
      <section class="match-list-panel">
        <div class="match-list-toolbar"><div><h3>Begegnungen</h3><p id="match-filter-result">${matches.length} Matches</p></div><div class="match-filter" role="group" aria-label="Matches filtern">
          <button class="active" data-match-filter="all" onclick="window.filterTournamentMatches('all',this)">Alle <span>${matches.length}</span></button>
          <button data-match-filter="scheduled" onclick="window.filterTournamentMatches('scheduled',this)">Offen <span>${scheduledCount}</span></button>
          <button data-match-filter="completed" onclick="window.filterTournamentMatches('completed',this)">Beendet <span>${completedCount}</span></button>
        </div></div>
        <div id="matches-list" class="match-card-list">
          ${matches.length ? renderMatchGroups(matches, members, isHost) : '<div class="match-empty"><span>⚔</span><h3>Noch kein Spielplan</h3><p>Der Host kann automatisch eine vollständige Hinrunde erstellen.</p></div>'}
        </div>
      </section>
      <aside class="standings-panel">
        <div class="match-list-toolbar"><div><h3>Ligatabelle</h3><p>${standings.length} Spieler</p></div></div>
        <div class="standings-list">
          ${standings.length ? `<div class="standing-row standing-header"><span>#</span><span></span><span>Spieler</span><span>Sp</span><span>S</span><span>N</span><span>Diff</span><span>P</span></div>${standings.map((s, index) => `<div class="standing-row"><span class="standing-rank">${index + 1}</span><span class="match-player-avatar">${esc((memberDisplayName(s.member) || '?').slice(0, 2).toUpperCase())}</span><span class="standing-name">${esc(memberDisplayName(s.member))}</span><span class="standing-stat"><b>${s.played}</b></span><span class="standing-stat"><b>${s.wins}</b></span><span class="standing-stat loss"><b>${s.losses}</b></span><span class="standing-diff ${s.difference > 0 ? 'positive' : s.difference < 0 ? 'negative' : ''}">${s.difference > 0 ? '+' : ''}${s.difference}</span><span class="standing-points">${s.points}</span></div>`).join('')}` : '<div class="match-empty compact"><p>Noch keine Teilnehmer.</p></div>'}
        </div>
      </aside>
    </div>
  `;

  window.createLeagueSchedule = async () => {
    const expected = players.length > 1 ? players.length * (players.length - 1) / 2 : 0;
    if (!confirm(`Hinrunde mit ${expected} Matches für ${players.length} Spieler erstellen?`)) return;
    try {
      const created = await generateRoundRobinSchedule(t.id);
      toast(`${created} Matches erstellt`, 'success');
      renderTab('matches');
    } catch (err) { toast('Spielplan konnte nicht erstellt werden: ' + err.message, 'error'); }
  };

  window.submitCreateMatch = async () => {
    try {
      const playerA = document.getElementById('mm-a').value;
      const playerB = document.getElementById('mm-b').value;
      if (!playerA || !playerB) throw new Error('Bitte beide Spieler auswählen.');
      if (playerA === playerB) throw new Error('Ein Spieler kann nicht gegen sich selbst antreten.');
      await createMatch(t.id, {
        round: parseInt(document.getElementById('mm-round').value) || 1,
        playerAMemberId: playerA,
        playerBMemberId: playerB,
        notes: document.getElementById('mm-notes').value.trim(),
      });
      toast('Match angelegt ✓', 'success');
      renderTab('matches');
    } catch (err) { toast('Fehler: ' + err.message, 'error'); }
  };

  window.submitMatchResult = async (matchId, playerAId, playerBId) => {
    const scoreA = Number(document.getElementById(`match-score-a-${matchId}`).value);
    const scoreB = Number(document.getElementById(`match-score-b-${matchId}`).value);
    if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0) return toast('Bitte gültige Ergebnisse eintragen.', 'error');
    if (scoreA === scoreB) return toast('Ein Unentschieden wird aktuell nicht unterstützt.', 'error');
    try { await setMatchResult(matchId, { scoreA, scoreB }); toast('Ergebnis gespeichert ✓', 'success'); renderTab('matches'); }
    catch (err) { toast('Fehler: ' + err.message, 'error'); }
  };
  window.reopenTournamentMatch = async matchId => {
    if (!confirm('Ergebnis zur Korrektur wieder öffnen?')) return;
    try { await reopenMatch(matchId); toast('Match wieder geöffnet', 'success'); renderTab('matches'); }
    catch (err) { toast('Fehler: ' + err.message, 'error'); }
  };
  window.deleteTournamentMatch = async matchId => {
    if (!confirm('Match wirklich löschen?')) return;
    try { await deleteMatch(matchId); toast('Match gelöscht', 'success'); renderTab('matches'); }
    catch (err) { toast('Fehler: ' + err.message, 'error'); }
  };
  window.filterTournamentMatches = (filter, button) => {
    document.querySelectorAll('.match-filter button').forEach(item => item.classList.toggle('active', item === button));
    let visible = 0;
    document.querySelectorAll('#matches-list .match-card').forEach(card => {
      const show = filter === 'all' || card.dataset.status === filter;
      card.hidden = !show;
      if (show) visible++;
    });
    document.querySelectorAll('#matches-list .match-round-group').forEach(group => {
      group.hidden = !group.querySelector('.match-card:not([hidden])');
    });
    const result = document.getElementById('match-filter-result');
    if (result) result.textContent = `${visible} ${visible === 1 ? 'Match' : 'Matches'}`;
  };
}

function renderMatchGroups(matches, members, isHost) {
  const groups = new Map();
  matches.forEach(match => {
    const round = Number(match.round) || 1;
    if (!groups.has(round)) groups.set(round, []);
    groups.get(round).push(match);
  });
  return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([round, roundMatches]) => {
    const completed = roundMatches.filter(match => match.status === 'completed').length;
    return `<section class="match-round-group"><div class="match-round-heading"><div><span>Runde ${round}</span><small>${completed}/${roundMatches.length} beendet</small></div><span class="round-progress"><i style="width:${roundMatches.length ? completed / roundMatches.length * 100 : 0}%"></i></span></div>${roundMatches.map(match => renderMatchRow(match, members, isHost)).join('')}</section>`;
  }).join('');
}

function renderMatchRow(m, members, isHost) {
  const name = (id) => memberDisplayName(members.find(x => x.id === id)) || 'TBD';
  const initials = (id) => name(id).split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
  const done = m.status === 'completed';
  const winnerA = done && m.winner_member_id === m.player_a_member_id;
  const winnerB = done && m.winner_member_id === m.player_b_member_id;
  return `<article class="match-card ${done ? 'completed' : 'scheduled'}" data-status="${done ? 'completed' : 'scheduled'}">
    <div class="match-card-top"><span class="match-round">Runde ${m.round}</span><span class="badge ${done ? 'badge-success' : 'badge-purple'}">${done ? 'Abgeschlossen' : 'Offen'}</span>${isHost ? `<button class="match-delete" onclick="window.deleteTournamentMatch('${m.id}')" aria-label="Match löschen">×</button>` : ''}</div>
    <div class="match-players">
      <div class="match-player ${winnerA ? 'winner' : ''}"><span class="match-player-avatar">${esc(initials(m.player_a_member_id))}</span><strong>${esc(name(m.player_a_member_id))}</strong>${winnerA ? '<small>Sieger</small>' : ''}</div>
      <div class="match-score-area">${done ? `<strong>${m.score_a ?? 0}<span>:</span>${m.score_b ?? 0}</strong>` : '<span>VS</span>'}</div>
      <div class="match-player right ${winnerB ? 'winner' : ''}"><span class="match-player-avatar">${esc(initials(m.player_b_member_id))}</span><strong>${esc(name(m.player_b_member_id))}</strong>${winnerB ? '<small>Sieger</small>' : ''}</div>
    </div>
    ${m.notes ? `<p class="match-card-notes">${esc(m.notes)}</p>` : ''}
    ${isHost && done ? `<div class="match-correction"><button class="btn btn-ghost btn-xs" onclick="window.reopenTournamentMatch('${m.id}')">Ergebnis korrigieren</button></div>` : ''}
    ${isHost && !done ? `<div class="match-result-form"><label>Ergebnis</label><input id="match-score-a-${m.id}" type="number" min="0" value="0" aria-label="Punkte ${esc(name(m.player_a_member_id))}"><span>:</span><input id="match-score-b-${m.id}" type="number" min="0" value="0" aria-label="Punkte ${esc(name(m.player_b_member_id))}"><button class="btn btn-primary btn-sm" onclick="window.submitMatchResult('${m.id}','${m.player_a_member_id}','${m.player_b_member_id}')">Ergebnis speichern</button></div>` : ''}
  </article>`;
}

// ─── POOL ─────────────────────────────────────────────────────────────
async function renderPoolTab(content) {
  const t = ctx.tournament;
  const isHost = ctx.role === 'host';
  const pools = await listPoolsForTournament(t.id);
  const pool = pools[0] || null;
  const pokemon = pool ? await listPoolPokemon(pool.id) : [];

  content.innerHTML = `
    <div class="section-header">
      <span class="section-title">${pool ? esc(pool.name) : 'Draft Pool'}</span>
      ${isHost && !pool ? `<button class="btn btn-primary btn-sm" onclick="window.createPoolForTournament()">+ Pool anlegen</button>` : ''}
      ${isHost && pool ? `<div style="display:flex;gap:6px">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('pool-import-file').click()">↑ Import</button>
        <input type="file" id="pool-import-file" accept=".json" style="display:none" onchange="window.handlePoolImport(event)" />
        <button class="btn btn-ghost btn-sm" onclick="window.exportPoolNow()">↓ Export</button>
        <input type="file" id="ranking-import-file" accept=".json,application/json" style="display:none" onchange="window.handleRankingImport(event)" />
      </div>` : ''}
    </div>
    ${!pool ? '<div class="empty-state">Noch kein Pool für dieses Turnier.</div>' : `
      <div class="setup-row" style="margin-bottom:10px">
        <input class="form-input" id="pool-search" placeholder="Suche…" oninput="window.refreshPoolView()" style="max-width:220px" />
        <input class="form-input" id="pool-type" placeholder="Typ-Filter (z.B. electric)" oninput="window.refreshPoolView()" style="max-width:220px" />
        <select class="form-select" id="pool-tier" onchange="window.refreshPoolView()" style="max-width:140px"><option value="">Alle Tiers</option>${['S','A','B','C','D'].map(tier => `<option>${tier}</option>`).join('')}</select>
        <button class="btn btn-ghost btn-sm" onclick="window.pickRandomFromPool()">🎲 Zufall</button>
        ${isHost ? `<button class="btn btn-secondary btn-sm" onclick="window.toggleRankingEditor()">Rankings bearbeiten</button><button class="btn btn-secondary btn-sm" onclick="window.addGenOneToPool()">Gen 1 komplett</button><button class="btn btn-primary btn-sm" onclick="window.openAddPoolPokemon()">+ Pokémon</button>` : ''}
      </div>
      ${isHost ? `<section id="ranking-editor" class="ranking-editor" hidden>
        <div class="ranking-editor-head"><div><strong>Ranking-Editor</strong><span id="ranking-selection-count">0 ausgewählt</span></div><div class="ranking-editor-files"><button class="btn btn-ghost btn-sm" onclick="document.getElementById('ranking-import-file').click()">Ranking importieren</button><button class="btn btn-ghost btn-sm" onclick="window.exportRankingNow()">Ranking exportieren</button></div></div>
        <div class="ranking-bulk-bar">
          <button class="btn btn-ghost btn-sm" onclick="window.selectVisibleRankings()">Sichtbare auswählen</button><button class="btn btn-ghost btn-sm" onclick="window.clearRankingSelection()">Auswahl leeren</button>
          <label><span>Tier</span><select class="form-select" id="ranking-bulk-tier"><option value="">Unverändert</option>${['S','A','B','C','D'].map(tier => `<option>${tier}</option>`).join('')}</select></label>
          <label><span>Kosten</span><input class="form-input" id="ranking-bulk-cost" type="number" min="0" max="100" placeholder="Unverändert"></label>
          <label><span>Status</span><select class="form-select" id="ranking-bulk-status"><option value="">Unverändert</option><option value="active">Aktiv</option><option value="banned">Gebannt</option></select></label>
          <button class="btn btn-primary btn-sm" onclick="window.applyBulkRanking()">Anwenden</button><button class="btn btn-ghost btn-sm" onclick="window.resetSelectedRankings()">Standardwerte</button>
        </div>
      </section>` : ''}
      <div id="pool-random-result"></div>
      <div id="pool-grid" class="pokemon-grid pool-ranking-grid"></div>
    `}
  `;

  let currentList = pokemon;
  let rankingMode = false;
  const selectedRankingIds = new Set();
  let visibleRankingIds = [];
  const updateSelectionCount = () => {
    const label = document.getElementById('ranking-selection-count');
    if (label) label.textContent = `${selectedRankingIds.size} ausgewählt`;
  };
  window.refreshPoolView = () => {
    const search = document.getElementById('pool-search')?.value || '';
    const type = document.getElementById('pool-type')?.value || '';
    const tier = document.getElementById('pool-tier')?.value || '';
    const filtered = filterPool(currentList, { search, type, includeBanned: true }).filter(mon => !tier || mon.tier === tier);
    visibleRankingIds = filtered.map(mon => mon.pokemon_id);
    const grid = document.getElementById('pool-grid');
    if (!grid) return;
    grid.classList.toggle('ranking-mode', rankingMode);
    grid.innerHTML = filtered.map(p => {
      const types = (p.types || []).map(type => `<span class="draft-type type-${esc(type)}">${esc(type)}</span>`).join('');
      const cost = Number(p.cost) || 0;
      return `<div class="pokemon-card ranking-pokemon-card ${selectedRankingIds.has(p.pokemon_id) ? 'selected' : ''}">
        ${isHost ? `<label class="ranking-select-wrap"><input class="ranking-select" type="checkbox" data-pokemon-id="${esc(p.pokemon_id)}" ${selectedRankingIds.has(p.pokemon_id) ? 'checked' : ''} onchange="window.toggleRankingSelection('${esc(p.pokemon_id)}',this.checked)"><span>Auswählen</span></label>` : ''}
        <div class="pokemon-card-inner ranking-pokemon-card-inner">
          <div class="pokemon-sprite-col"><img src="https://play.pokemonshowdown.com/sprites/dex/${esc(p.pokemon_id)}.png" alt="${esc(p.pokemon_name)}" onerror="this.style.opacity=0.3" /></div>
          <div class="pokemon-info-col">
            <div class="pokemon-name-row"><span class="pokemon-name">${esc(p.pokemon_name)}${p.is_banned ? ' 🚫' : ''}</span></div>
            <div class="draft-mon-types pool-type-row">${types || '<span class="draft-type">Unbekannt</span>'}</div>
            <div class="pool-ranking-meta">
              <span class="pool-tier-badge"><small>Tier</small>${esc(p.tier || '—')}</span>
              <span class="pool-cost-badge"><small>Kosten</small>${cost}</span>
            </div>
            ${(p.tags || []).length ? `<div class="pool-tags">${p.tags.map(tg => `<span class="move-item">${esc(tg)}</span>`).join('')}</div>` : ''}
          </div>
        </div>
        ${isHost ? `<div class="ranking-inline-editor"><select class="form-select" id="rank-tier-${esc(p.pokemon_id)}">${['S','A','B','C','D'].map(tier => `<option ${p.tier === tier ? 'selected' : ''}>${tier}</option>`).join('')}</select><input class="form-input" id="rank-cost-${esc(p.pokemon_id)}" type="number" min="0" max="100" value="${Number(p.cost) || 0}" aria-label="Kosten ${esc(p.pokemon_name)}"><button class="btn btn-primary btn-xs" onclick="window.saveSingleRanking('${esc(p.pokemon_id)}')">Speichern</button></div>` : ''}
        ${isHost ? `<div class="ev-section"><button class="btn btn-danger btn-xs" onclick="window.removePoolMon('${p.id}')">Entfernen</button></div>` : ''}
      </div>`;
    }).join('') || '<div class="empty-state">Keine Treffer.</div>';
    updateSelectionCount();
  };
  window.refreshPoolView();

  window.toggleRankingEditor = () => {
    rankingMode = !rankingMode;
    const editor = document.getElementById('ranking-editor');
    if (editor) editor.hidden = !rankingMode;
    window.refreshPoolView();
  };
  window.toggleRankingSelection = (pokemonId, checked) => {
    if (checked) selectedRankingIds.add(pokemonId); else selectedRankingIds.delete(pokemonId);
    updateSelectionCount();
    document.querySelector(`[data-pokemon-id="${pokemonId}"]`)?.closest('.ranking-pokemon-card')?.classList.toggle('selected', checked);
  };
  window.selectVisibleRankings = () => {
    visibleRankingIds.forEach(id => selectedRankingIds.add(id));
    window.refreshPoolView();
  };
  window.clearRankingSelection = () => {
    selectedRankingIds.clear();
    window.refreshPoolView();
  };
  window.saveSingleRanking = async pokemonId => {
    const tier = document.getElementById(`rank-tier-${pokemonId}`)?.value;
    const cost = Number(document.getElementById(`rank-cost-${pokemonId}`)?.value);
    if (!tier || !Number.isInteger(cost) || cost < 0 || cost > 100) { toast('Tier oder Kosten sind ungültig', 'error'); return; }
    try {
      await updatePoolRankings(pool.id, [{ pokemon_id: pokemonId, tier, cost }]);
      toast('Ranking gespeichert', 'success');
      renderTab('pool');
    } catch (err) { toast('Fehler: ' + err.message, 'error'); }
  };
  window.applyBulkRanking = async () => {
    if (!selectedRankingIds.size) { toast('Bitte zuerst Pokémon auswählen', 'error'); return; }
    const tier = document.getElementById('ranking-bulk-tier').value;
    const costRaw = document.getElementById('ranking-bulk-cost').value.trim();
    const status = document.getElementById('ranking-bulk-status').value;
    if (!tier && !costRaw && !status) { toast('Keine Änderung ausgewählt', 'error'); return; }
    const cost = costRaw === '' ? null : Number(costRaw);
    if (cost !== null && (!Number.isInteger(cost) || cost < 0 || cost > 100)) { toast('Kosten müssen zwischen 0 und 100 liegen', 'error'); return; }
    const entries = [...selectedRankingIds].map(pokemonId => ({
      pokemon_id: pokemonId,
      ...(tier ? { tier } : {}),
      ...(cost !== null ? { cost } : {}),
      ...(status ? { is_banned: status === 'banned' } : {}),
    }));
    try {
      const result = await updatePoolRankings(pool.id, entries);
      toast(`${result.updated} Rankings aktualisiert`, 'success');
      renderTab('pool');
    } catch (err) { toast('Fehler: ' + err.message, 'error'); }
  };
  window.resetSelectedRankings = async () => {
    const ids = [...selectedRankingIds];
    const target = ids.length ? `${ids.length} ausgewählte Pokémon` : 'den gesamten Pool';
    if (!confirm(`Standard-Tiers und Kosten für ${target} wiederherstellen?`)) return;
    try {
      const updated = await resetPoolRankings(pool.id, ids.length ? ids : null);
      toast(`${updated} Rankings zurückgesetzt`, 'success');
      renderTab('pool');
    } catch (err) { toast('Fehler: ' + err.message, 'error'); }
  };
  window.exportRankingNow = () => downloadRankingJson(pool, currentList);
  window.handleRankingImport = async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const entries = await parseRankingFile(file);
      if (!confirm(`${entries.length} Ranking-Einträge aus „${file.name}“ importieren?`)) return;
      const result = await updatePoolRankings(pool.id, entries);
      const unknown = result.unknown || [];
      toast(`${result.updated} aktualisiert${unknown.length ? ` · ${unknown.length} unbekannt` : ''}`, unknown.length ? 'info' : 'success');
      renderTab('pool');
    } catch (err) { toast('Ranking-Import fehlgeschlagen: ' + err.message, 'error'); }
    finally { event.target.value = ''; }
  };

  window.createPoolForTournament = async () => {
    try { await createTournamentPool(t.id, t.name + ' Pool'); toast('Pool erstellt', 'success'); renderTab('pool'); }
    catch (err) { toast('Fehler: ' + err.message, 'error'); }
  };
  window.openAddPoolPokemon = async () => {
    try {
      const catalog = await listPokemonCatalog(1);
      const existing = new Set(currentList.map(mon => mon.pokemon_id));
      const select = document.getElementById('app-pokemon');
      select.innerHTML = catalog.map(mon => `<option value="${esc(mon.pokemon_id)}" ${existing.has(mon.pokemon_id) ? 'disabled' : ''}>#${String(mon.dex_number).padStart(3, '0')} ${esc(mon.pokemon_name)}${existing.has(mon.pokemon_id) ? ' – bereits enthalten' : ''}</option>`).join('');
      openModal('add-pool-pokemon');
    } catch (err) { toast('Katalog konnte nicht geladen werden: ' + err.message, 'error'); }
  };
  window.submitAddPoolPokemon = async () => {
    const pokemonId = document.getElementById('app-pokemon').value;
    if (!pokemonId) { toast('Bitte ein Pokémon auswählen', 'error'); return; }
    try {
      await addCatalogPokemonToPool(pool.id, pokemonId);
      closeModal('add-pool-pokemon');
      toast('Pokémon hinzugefügt', 'success');
      renderTab('pool');
    } catch (err) { toast('Fehler: ' + err.message, 'error'); }
  };
  window.addGenOneToPool = async () => {
    if (!confirm('Alle noch fehlenden 151 Pokémon aus Generation 1 hinzufügen?')) return;
    try {
      const added = await addGenerationToPool(pool.id, 1);
      toast(`${added} Pokémon hinzugefügt`, 'success');
      renderTab('pool');
    } catch (err) { toast('Fehler: ' + err.message, 'error'); }
  };
  window.removePoolMon = async (id) => {
    try { await removePoolPokemon(id); renderTab('pool'); } catch (err) { toast('Fehler: ' + err.message, 'error'); }
  };
  window.pickRandomFromPool = () => {
    const type = document.getElementById('pool-type')?.value || '';
    const pick = randomFromPool(currentList, { type });
    document.getElementById('pool-random-result').innerHTML = pick
      ? `<div class="winner-banner" style="padding:14px;margin-bottom:10px"><span class="winner-banner-name" style="font-size:18px">${esc(pick.pokemon_name)}</span></div>`
      : '<div class="empty-state" style="padding:10px">Keine passenden Pokémon im Pool.</div>';
  };
  window.exportPoolNow = async () => { try { await exportPool(pool); } catch (err) { toast('Fehler: ' + err.message, 'error'); } };
  window.handlePoolImport = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try { await importPoolFile(file, t.id); toast('Pool importiert ✓', 'success'); renderTab('pool'); }
    catch (err) { toast('Fehler: ' + err.message, 'error'); }
    e.target.value = '';
  };
}

// ─── DRAFT HUB ───────────────────────────────────────────────────────
async function renderDraftTab(content) {
  const isHost = ctx.role === 'host';
  const [members, pools, rulesets, sessions] = await Promise.all([
    listMembers(ctx.tournament.id), listPoolsForTournament(ctx.tournament.id),
    listRulesetsForTournament(ctx.tournament.id), listDraftSessions(ctx.tournament.id),
  ]);
  const players = members.filter(member => member.role !== 'viewer');
  const transferablePlayers = players.map(member => ({ id: member.id, name: memberDisplayName(member) }));
  const session = sessions[0] || null;

  if (!session) {
    disconnectDraftRealtime();
    content.innerHTML = `<section class="draft-empty-shell">
      <div><span class="eyebrow">Gemeinsamer Draft-Hub</span><h2>Live draften, Teams verfolgen und Pokémon tauschen</h2>
      <p>Der Host richtet eine Draft-Runde mit Pool, Ruleset und Teilnehmern ein. Danach sehen alle denselben Stand.</p></div>
      ${isHost ? `<div class="draft-setup-grid">
        <label class="form-group"><span class="form-label">Pokémon-Pool</span><select class="form-select" id="draft-pool">${pools.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label>
        <label class="form-group"><span class="form-label">Ruleset</span><select class="form-select" id="draft-rules">${rulesets.map(r => `<option value="${r.id}">${esc(r.name)} · ${r.team_size} Picks</option>`).join('')}</select></label>
      </div>
      <div class="draft-order-preview"><strong>Pick-Reihenfolge</strong>${players.map((m, i) => `<span><b>${i + 1}</b>${esc(memberDisplayName(m))}</span>`).join('') || '<p>Noch keine Spieler vorhanden.</p>'}</div>
      <div class="draft-config-actions">
        <button class="btn btn-primary" onclick="window.createTournamentDraft()" ${!pools.length || !rulesets.length || !players.length ? 'disabled' : ''}>Draft-Runde anlegen</button>
        <button class="btn btn-secondary" onclick="document.getElementById('draft-config-import').click()" ${!players.length ? 'disabled' : ''}>Draft-Konfiguration importieren</button>
        <input id="draft-config-import" type="file" accept=".json,application/json" hidden onchange="window.importTournamentDraftConfig(event)">
      </div>
      ${!pools.length || !rulesets.length ? '<p class="draft-help">Vorher werden mindestens ein Pool und ein Ruleset benötigt.</p>' : ''}` : '<div class="empty-state">Der Host hat noch keine Draft-Runde angelegt.</div>'}
    </section>`;
    window.createTournamentDraft = async () => {
      try {
        await createDraftSession(ctx.tournament.id, {
          poolId: document.getElementById('draft-pool').value,
          rulesetId: document.getElementById('draft-rules').value,
          pickOrder: players.map(member => member.id),
        });
        toast('Draft-Runde angelegt', 'success'); renderTab('draft');
      } catch (err) { toast('Fehler: ' + err.message, 'error'); }
    };
    window.importTournamentDraftConfig = async event => {
      const file = event.target.files[0];
      if (!file) return;
      try {
        if (!confirm(`Draft-Konfiguration aus „${file.name}“ importieren? Pool und Ruleset werden als neue Kopien angelegt.`)) return;
        const imported = await importDraftConfigFile(file, ctx.tournament.id, transferablePlayers);
        await createDraftSession(ctx.tournament.id, {
          poolId: imported.pool.id,
          rulesetId: imported.ruleset.id,
          pickOrder: imported.pickOrder,
        });
        toast(imported.importedOrderApplied ? 'Draft-Konfiguration vollständig importiert' : 'Konfiguration importiert · Pick-Reihenfolge an Zielspieler angepasst', 'success');
        renderTab('draft');
      } catch (err) { toast('Draft-Import fehlgeschlagen: ' + err.message, 'error'); }
      finally { event.target.value = ''; }
    };
    return;
  }

  ensureDraftRealtime(session.id);

  const ruleset = rulesets.find(item => item.id === session.ruleset_id) || null;
  const pool = pools.find(item => item.id === session.pool_id) || null;
  const [poolPokemon, picks, offers] = await Promise.all([
    pool ? listPoolPokemon(pool.id) : [], listDraftPicks(session.id),
    listTradeOffers(session.id).catch(() => []),
  ]);
  const myMember = members.find(member => member.profile_id === getCurrentUserId()) || null;
  const byMember = id => members.find(member => member.id === id);
  const byPick = id => picks.find(pick => pick.id === id);
  const turn = getDraftTurn(session, ruleset);
  const pickedIds = new Set(picks.map(pick => pick.pokemon_id));
  const available = poolPokemon.filter(mon => !mon.is_banned && (!pickedIds.has(mon.pokemon_id) || ruleset?.allow_duplicates));
  const currentName = memberDisplayName(byMember(turn.memberId)) || 'Draft beendet';
  const isMyTurn = !!myMember && myMember.id === turn.memberId;
  const canPick = !!pool && !!ruleset && players.length > 0
    && session.status === 'active' && (isHost || isMyTurn);
  const realtimeCopy = realtimeStatusCopy(draftRealtimeStatus);
  const configurationIssue = !pool
    ? 'Der verknüpfte Draft-Pool fehlt oder ist nicht mehr verfügbar.'
    : !ruleset
      ? 'Das verknüpfte Regelset fehlt oder ist nicht mehr verfügbar.'
      : !players.length
        ? 'Im Turnier sind keine aktiven Spieler vorhanden.'
        : null;
  const turnMessage = session.status === 'completed'
    ? 'Der Draft ist abgeschlossen.'
    : session.status !== 'active'
      ? 'Der Draft wartet auf den Start durch den Host.'
      : isMyTurn
        ? 'Du bist dran – wähle jetzt dein Pokémon.'
        : `Warte auf ${currentName}.`;

  const renderRoster = member => {
    const roster = picks.filter(pick => pick.member_id === member.id);
    const spent = rosterCost(picks, member.id, poolPokemon);
    return `<article class="draft-roster ${member.id === turn.memberId ? 'current' : ''}">
      <div class="draft-roster-head"><div><strong>${esc(memberDisplayName(member))}</strong><span>${roster.length}/${ruleset?.team_size || 6} Picks</span></div><b>${spent}${ruleset?.points_budget ? `/${ruleset.points_budget}` : ''} P</b></div>
      <div class="draft-roster-mons">${roster.map(pick => `<div title="${esc(pick.pokemon_name)}"><img ${spriteAttrs(pick.pokemon_name)}><span>${esc(pick.pokemon_name)}</span></div>`).join('') || '<small>Noch keine Picks</small>'}</div>
    </article>`;
  };
  const myDraftPicks = myMember ? picks.filter(pick => pick.member_id === myMember.id) : [];
  const canImportMyDraft = !!myMember && myDraftPicks.length > 0;

  content.innerHTML = `<div class="draft-hub draft-hub-expanded">
    <header class="draft-hub-header"><div><span class="eyebrow">Draft-Hub</span><h2>${esc(pool?.name || 'Draft')}</h2><p>${esc(ruleset?.name || 'Kein Ruleset')} · ${esc(ruleset?.draft_mode || 'snake')} · ${players.length} Spieler</p></div>
      <div class="draft-status-actions"><div id="draft-realtime-state" class="draft-realtime-state ${draftRealtimeStatus}" role="status" title="${esc(realtimeCopy.hint)}"><span aria-hidden="true"></span>${esc(realtimeCopy.label)}</div><span class="badge ${session.status === 'active' ? 'badge-success' : 'badge-purple'}">${esc(session.status)}</span>
      ${isHost && pool && ruleset ? '<button class="btn btn-ghost btn-sm" onclick="window.exportTournamentDraftConfig()">JSON exportieren</button>' : ''}
      ${isHost ? `<button class="btn btn-primary btn-sm" onclick="window.toggleDraftStatus()" ${session.status === 'completed' ? 'disabled' : ''}>${session.status === 'active' ? 'Pausieren' : session.status === 'completed' ? 'Abgeschlossen' : 'Draft starten'}</button>` : ''}</div></header>
    ${configurationIssue ? `<div class="draft-configuration-error"><strong>Draft-Konfiguration unvollständig</strong><span>${esc(configurationIssue)}</span>${isHost ? '<span>Bitte Pool, Regelset und Teilnehmer prüfen, bevor der Draft fortgesetzt wird.</span>' : ''}</div>` : ''}
    <nav class="draft-subnav"><button class="active" data-draft-view="live">Live-Draft</button><button data-draft-view="mine">Meine Picks</button><button data-draft-view="trade">Tauschbörse <span>${offers.filter(o => o.status === 'open').length}</span></button></nav>
    <section id="draft-view-live" class="draft-hub-view active">
      <div class="draft-turn-banner ${isMyTurn && session.status === 'active' ? 'mine' : ''}"><div><span>${session.status === 'active' ? 'Aktueller Zug' : 'Draft-Status'}</span><strong>${esc(currentName)}</strong></div><p>${esc(turnMessage)}</p><b>Runde ${turn.round || '–'} · Pick ${turn.pick || '–'}</b></div>
      <div class="draft-live-grid"><aside class="draft-team-rail"><div class="draft-rosters">${players.map(renderRoster).join('')}</div></aside>
      <main class="draft-pool-main"><div class="draft-pool-toolbar"><input class="form-input" id="draft-search" placeholder="Pokémon suchen …"><select class="form-select" id="draft-tier"><option value="">Alle Tiers</option>${[...new Set(poolPokemon.map(m => m.tier).filter(Boolean))].map(tier => `<option>${esc(tier)}</option>`).join('')}</select><span><strong>${available.length}</strong> verfügbar</span></div>
      <div id="draft-pokemon-grid" class="draft-pokemon-grid"></div></main>
      <aside><div class="draft-panel"><div class="draft-panel-header"><strong>Pick-Historie</strong>${isHost && picks.length ? `<button class="btn btn-ghost btn-xs" onclick="window.undoTournamentDraftPick()">Undo</button>` : ''}</div><div class="draft-history">${[...picks].reverse().slice(0, 12).map(pick => `<div><b>#${pick.pick_number}</b><img ${spriteAttrs(pick.pokemon_name)}><span><strong>${esc(pick.pokemon_name)}</strong><small>${esc(memberDisplayName(byMember(pick.member_id)))}</small></span></div>`).join('') || '<div class="empty-state">Noch kein Pick.</div>'}</div></div></aside></div>
    </section>
    <section id="draft-view-mine" class="draft-hub-view">${myMember ? `<div class="draft-my-summary"><div><span class="eyebrow">Mein Team</span><h3>${esc(memberDisplayName(myMember))}</h3><p>${myDraftPicks.length}/${ruleset?.team_size || 6} Pokémon · ${rosterCost(picks, myMember.id, poolPokemon)}${ruleset?.points_budget ? `/${ruleset.points_budget}` : ''} Punkte</p></div><div class="draft-my-actions"><button class="btn btn-primary" onclick="window.switchDraftHubView('trade')">Tausch anbieten</button><button class="btn btn-secondary" onclick="window.importMyDraftToPersonalBuilder()" ${canImportMyDraft ? '' : 'disabled'}>In persönliche Teams importieren</button><button class="btn btn-secondary" onclick="window.importMyDraftToTournamentTeam()" ${canImportMyDraft ? '' : 'disabled'}>Als Turnier-Team übernehmen</button></div></div>${renderRoster(myMember)}` : '<div class="empty-state">Du bist in diesem Turnier nicht als Spieler eingetragen.</div>'}</section>
    <section id="draft-view-trade" class="draft-hub-view">
      ${renderTradeCreator(myMember, players, picks)}
      <div class="draft-trade-list">${offers.length ? offers.map(offer => renderTradeOffer(offer, myMember, byMember, byPick)).join('') : '<div class="empty-state">Noch keine Tauschangebote.</div>'}</div>
    </section>
  </div>`;

  window.switchDraftHubView = view => {
    draftUiState.view = view;
    document.querySelectorAll('.draft-hub-view').forEach(el => el.classList.toggle('active', el.id === `draft-view-${view}`));
    document.querySelectorAll('[data-draft-view]').forEach(el => el.classList.toggle('active', el.dataset.draftView === view));
  };
  document.querySelectorAll('[data-draft-view]').forEach(button => button.onclick = () => window.switchDraftHubView(button.dataset.draftView));
  window.exportTournamentDraftConfig = async () => {
    try {
      await exportDraftConfig({ pool, ruleset, session, players: transferablePlayers });
      toast('Draft-Konfiguration exportiert', 'success');
    } catch (err) { toast('Draft-Export fehlgeschlagen: ' + err.message, 'error'); }
  };
  window.refreshDraftPokemon = () => {
    const query = (document.getElementById('draft-search')?.value || '').toLowerCase();
    const tier = document.getElementById('draft-tier')?.value || '';
    draftUiState.search = query;
    draftUiState.tier = tier;
    const filtered = available.filter(mon => mon.pokemon_name.toLowerCase().includes(query) && (!tier || mon.tier === tier));
    const grid = document.getElementById('draft-pokemon-grid');
    if (!grid) return;
    grid.innerHTML = filtered.map(mon => {
      const tierBadge = mon.tier ? `<span class="draft-meta-pill">Tier ${esc(mon.tier)}</span>` : '';
      const costBadge = Number(mon.cost) > 0 ? `<span class="draft-meta-pill draft-cost-pill">${Number(mon.cost)} P</span>` : '';
      const types = (mon.types || []).map(type => `<span class="draft-type type-${esc(type)}">${esc(type)}</span>`).join('');
      return `<article class="draft-mon-card ${canPick ? 'pickable' : ''}">
        <div class="draft-mon-sprite"><img ${spriteAttrs(mon.pokemon_name)}></div>
        <div class="draft-mon-info"><strong>${esc(mon.pokemon_name)}</strong><div class="draft-mon-types">${types || '<span class="draft-type">Unbekannt</span>'}</div>${tierBadge || costBadge ? `<div class="draft-mon-meta">${tierBadge}${costBadge}</div>` : ''}</div>
        ${canPick ? `<button class="btn btn-primary btn-sm" data-draft-pick onclick="window.pickDraftPokemon('${esc(mon.pokemon_id)}')" ${draftPickPending ? 'disabled' : ''}>${draftPickPending ? 'Wird gespeichert …' : 'Picken'}</button>` : ''}
      </article>`;
    }).join('') || '<div class="empty-state draft-grid-empty">Keine verfügbaren Pokémon gefunden.</div>';
  };
  document.getElementById('draft-search').value = draftUiState.search;
  document.getElementById('draft-tier').value = draftUiState.tier;
  document.getElementById('draft-search').oninput = window.refreshDraftPokemon;
  document.getElementById('draft-tier').onchange = window.refreshDraftPokemon;
  window.refreshDraftPokemon();
  window.switchDraftHubView(draftUiState.view);
  window.toggleDraftStatus = async () => { try { await setDraftStatus(session.id, session.status === 'active' ? 'paused' : 'active'); renderTab('draft'); } catch (err) { toast('Fehler: ' + err.message, 'error'); } };
  window.pickDraftPokemon = async pokemonId => {
    if (draftPickPending) return;
    draftPickPending = true;
    document.querySelectorAll('[data-draft-pick]').forEach(button => {
      button.disabled = true;
      button.textContent = 'Wird gespeichert …';
    });
    try {
      await makeDraftPick(session.id, pokemonId);
      toast('Pick gespeichert', 'success');
    } catch (err) {
      toast('Pick nicht möglich: ' + formatDraftError(err), 'error');
    } finally {
      draftPickPending = false;
      await renderTab('draft');
    }
  };
  window.undoTournamentDraftPick = async () => { try { await undoLastDraftPick(session.id); toast('Letzten Pick zurückgenommen', 'success'); renderTab('draft'); } catch (err) { toast('Fehler: ' + err.message, 'error'); } };
  window.importMyDraftToPersonalBuilder = async () => {
    try {
      if (!myMember) throw new Error('Du bist in diesem Turnier nicht als Spieler eingetragen.');
      const sets = draftPicksToPokemonSets(picks, myMember.id);
      if (!sets.length) throw new Error('Du hast noch keine Picks.');
      const title = `${tournament.name || 'Turnier'} · ${memberDisplayName(myMember)} Draft`;
      const sheet = await createPersonalSheet(title, {
        team_mode: 'standard',
        battle_format: battleFormatFromRuleset(ruleset),
        rules_profile: 'open',
      });
      await replacePokemonSets(sheet.id, sets);
      toast('Draft-Team im Team Builder angelegt', 'success');
      location.hash = `/builder/${sheet.id}`;
    } catch (err) {
      toast('Import fehlgeschlagen: ' + err.message, 'error');
    }
  };
  window.importMyDraftToTournamentTeam = async () => {
    try {
      if (!myMember) throw new Error('Du bist in diesem Turnier nicht als Spieler eingetragen.');
      const sets = draftPicksToPokemonSets(picks, myMember.id);
      if (!sets.length) throw new Error('Du hast noch keine Picks.');
      let sheet = await getMySheet(tournament.id);
      if (sheet && !confirm('Dein bestehendes Turnier-Team wird durch deine aktuellen Draft-Picks ersetzt. Fortfahren?')) return;
      if (!sheet) {
        sheet = await createSheet(tournament.id, myMember.id, `${memberDisplayName(myMember)} Draft-Team`);
      }
      await updateSheet(sheet.id, {
        title: sheet.title || `${memberDisplayName(myMember)} Draft-Team`,
        battle_format: battleFormatFromRuleset(ruleset),
        rules_profile: 'open',
        team_mode: 'standard',
      });
      await replacePokemonSets(sheet.id, sets);
      toast('Draft-Picks als Turnier-Team übernommen', 'success');
      location.hash = `/builder/${sheet.id}`;
    } catch (err) {
      toast('Import fehlgeschlagen: ' + err.message, 'error');
    }
  };
  window.updateTradeTarget = () => {
    const memberId = document.getElementById('trade-recipient')?.value;
    const select = document.getElementById('trade-requested');
    if (select) select.innerHTML = picks.filter(p => p.member_id === memberId).map(p => `<option value="${p.id}">${esc(p.pokemon_name)}</option>`).join('');
  };
  window.submitDraftTrade = async () => { try { await createTradeOffer(session.id, document.getElementById('trade-recipient').value, document.getElementById('trade-offered').value, document.getElementById('trade-requested').value, document.getElementById('trade-message').value); toast('Tauschangebot veröffentlicht', 'success'); renderTab('draft'); } catch (err) { toast('Fehler: ' + err.message, 'error'); } };
  window.resolveDraftTrade = async (id, action) => { try { await resolveTradeOffer(id, action); toast(action === 'accept' ? 'Tausch durchgeführt' : 'Angebot aktualisiert', 'success'); renderTab('draft'); } catch (err) { toast('Fehler: ' + err.message, 'error'); } };
}

function renderTradeCreator(myMember, players, picks) {
  if (!myMember) return '';
  const mine = picks.filter(p => p.member_id === myMember.id);
  const others = players.filter(p => p.id !== myMember.id && picks.some(pick => pick.member_id === p.id));
  if (!mine.length || !others.length) return '<div class="draft-trade-create"><p>Ein Tauschangebot ist möglich, sobald du und mindestens ein anderer Spieler Picks besitzen.</p></div>';
  const firstOther = others[0];
  return `<div class="draft-trade-create"><div><span class="eyebrow">Neues Angebot</span><h3>Pokémon direkt tauschen</h3><p>Nach Annahme wird der Besitz automatisch gewechselt. Budgets werden vorher geprüft.</p></div><div class="draft-trade-form">
    <label><span>Du bietest</span><select class="form-select" id="trade-offered">${mine.map(p => `<option value="${p.id}">${esc(p.pokemon_name)}</option>`).join('')}</select></label>
    <label><span>An</span><select class="form-select" id="trade-recipient" onchange="window.updateTradeTarget()">${others.map(m => `<option value="${m.id}">${esc(memberDisplayName(m))}</option>`).join('')}</select></label>
    <label><span>Du möchtest</span><select class="form-select" id="trade-requested">${picks.filter(p => p.member_id === firstOther.id).map(p => `<option value="${p.id}">${esc(p.pokemon_name)}</option>`).join('')}</select></label>
    <label class="wide"><span>Nachricht (optional)</span><input class="form-input" id="trade-message" maxlength="500" placeholder="Warum passt der Tausch für euch beide?"></label>
    <button class="btn btn-primary" onclick="window.submitDraftTrade()">Angebot veröffentlichen</button></div></div>`;
}

function renderTradeOffer(offer, myMember, byMember, byPick) {
  const offered = byPick(offer.offered_pick_id);
  const requested = byPick(offer.requested_pick_id);
  const incoming = myMember?.id === offer.recipient_member_id && offer.status === 'open';
  const own = myMember?.id === offer.proposer_member_id && offer.status === 'open';
  return `<article class="draft-trade-card"><div class="draft-trade-status"><span class="badge ${offer.status === 'open' ? 'badge-info' : offer.status === 'accepted' ? 'badge-success' : ''}">${esc(offer.status)}</span><small>${new Date(offer.created_at).toLocaleDateString('de-DE')}</small></div><div class="draft-trade-swap"><div><small>${esc(memberDisplayName(byMember(offer.proposer_member_id)))}</small><strong>${esc(offered?.pokemon_name || 'Nicht mehr verfügbar')}</strong></div><b>⇄</b><div><small>${esc(memberDisplayName(byMember(offer.recipient_member_id)))}</small><strong>${esc(requested?.pokemon_name || 'Nicht mehr verfügbar')}</strong></div></div>${offer.message ? `<p>${esc(offer.message)}</p>` : ''}${incoming ? `<div class="draft-trade-actions"><button class="btn btn-primary btn-sm" onclick="window.resolveDraftTrade('${offer.id}','accept')">Annehmen</button><button class="btn btn-ghost btn-sm" onclick="window.resolveDraftTrade('${offer.id}','reject')">Ablehnen</button></div>` : own ? `<button class="btn btn-ghost btn-sm" onclick="window.resolveDraftTrade('${offer.id}','withdraw')">Zurückziehen</button>` : ''}</article>`;
}

// ─── SETTINGS (Host only) ────────────────────────────────────────────
async function renderSettingsTab(content) {
  const t = ctx.tournament;
  const invites = await listInviteCodes(t.id).catch(() => []);
  content.innerHTML = `
    <div class="tournament-setup">
      <div class="tournament-setup-title">Turniereinstellungen</div>
      <div class="form-group"><label class="form-label">Name</label><input class="form-input" id="set-name" value="${esc(t.name)}" /></div>
      <div class="form-group"><label class="form-label">Beschreibung</label><textarea class="form-textarea" id="set-desc">${esc(t.description || '')}</textarea></div>
      <div class="setup-row">
        <div class="setup-group">
          <label class="form-label">Sichtbarkeit</label>
          <select class="form-select" id="set-visibility">
            ${['private', 'unlisted', 'public'].map(v => `<option value="${v}" ${v === t.visibility ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </div>
        <div class="setup-group">
          <label class="form-label">Status</label>
          <select class="form-select" id="set-status">
            ${['setup', 'active', 'completed'].map(v => `<option value="${v}" ${v === t.status ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group"><label><input type="checkbox" id="set-show-sheets" ${t.show_open_sheets ? 'checked' : ''} /> Open Sheets sichtbar</label></div>
      <div class="form-group"><label><input type="checkbox" id="set-hide-teams" ${t.hide_teams_until_start ? 'checked' : ''} /> Teams bis Start verbergen</label></div>
      <button class="btn btn-primary" onclick="window.submitTournamentSettings()">Speichern</button>
    </div>

    <div class="section-header" style="margin-top:24px"><span class="section-title">Einladungscodes</span></div>
    <div>
      ${invites.length ? invites.map(i => `<div class="team-list-item" style="cursor:default">
        <div style="flex:1"><div class="team-list-name" style="font-family:'Space Mono',monospace">${esc(i.code)}</div>
        <div class="team-list-meta">Rolle: ${esc(i.role)} · genutzt: ${i.used_count}${i.max_uses ? '/' + i.max_uses : ''}</div></div>
      </div>`).join('') : '<div class="empty-state" style="padding:16px">Noch keine Codes erstellt.</div>'}
    </div>
    <button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="window.openInviteCodeModal()">+ Einladungscode erstellen</button>
  `;

  window.submitTournamentSettings = async () => {
    try {
      await updateTournamentSettings(t.id, {
        name: document.getElementById('set-name').value.trim(),
        description: document.getElementById('set-desc').value.trim(),
        visibility: document.getElementById('set-visibility').value,
        status: document.getElementById('set-status').value,
        show_open_sheets: document.getElementById('set-show-sheets').checked,
        hide_teams_until_start: document.getElementById('set-hide-teams').checked,
      });
      toast('Gespeichert ✓', 'success');
    } catch (err) { toast('Fehler: ' + err.message, 'error'); }
  };
  window.openInviteCodeModal = () => openModal('invite-code');
  window.submitCreateInviteCode = async () => {
    const role = document.getElementById('ic-role').value;
    const maxUses = parseInt(document.getElementById('ic-maxuses').value) || null;
    try {
      const invite = await createInviteCode(t.id, { role, maxUses });
      document.getElementById('ic-result').textContent = invite.code;
      document.getElementById('ic-result-box').style.display = 'block';
      toast('Code erstellt ✓', 'success');
      renderTab('settings');
    } catch (err) { toast('Fehler: ' + err.message, 'error'); }
  };
}
