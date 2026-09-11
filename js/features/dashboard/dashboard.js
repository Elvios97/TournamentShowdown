// ─── FEATURE: DASHBOARD ──────────────────────────────────────────────
import { esc, toast, openModal, closeModal } from '../../utils.js';
import { navigate } from '../../router.js';
import {
  listMyTournaments, listPublicTournaments, createTournament,
  redeemInviteCode, joinPublicTournament,
} from '../tournaments/tournaments.js';
import { listPublicRulesetTemplates } from '../rulesets/rulesets.js';
import { listPublicPoolTemplates } from '../pools/pools.js';
import {
  listPersonalSheets, listPublicSheets, createPersonalSheet, listPokemonForSheet,
  importShowdownIntoSheet, updateSheet, deleteSheet, exportSheetAsShowdown,
} from '../teams/teamSheets.js?v=20260705b';
import { renderPokemonGrid, renderTeamBall, renderTeamBallSelect } from '../openSheets/openSheets.js';
import { spriteAttrs } from '../../sprites.js';
import { exportTeamSheet, importTeamSheetFile } from '../importExport/importExport.js?v=20260705b';
import { listVisibleProfiles } from '../../profileService.js';
import { getCurrentProfile } from '../../auth.js';

const VISIBILITY_LABEL = { private: '🔒 privat', unlisted: '🔗 unlisted', public: '🌐 öffentlich' };
const STATUS_LABEL = { setup: 'Vorbereitung', active: 'Läuft', completed: 'Abgeschlossen' };

function renderSectionHeader(title, action = '') {
  return `<div class="section-card-header"><h2>${title}</h2>${action}</div>`;
}

function renderStat(icon, label, id, value, meta, tone) {
  const symbols = { trophy: '♜', team: '●', match: '⚔', pool: '◉' };
  return `<article class="stat-card stat-${tone}"><span class="stat-icon">${symbols[icon]}</span><div><span class="stat-label">${label}</span><strong class="stat-value" ${id ? `id="${id}"` : ''}>${value}</strong><small>${meta}</small></div></article>`;
}

function renderDashboardLoadError(area) {
  return `<div class="empty-state compact load-error"><div class="empty-title">${esc(area)} konnte nicht geladen werden</div><div>Bitte prüfe deine Verbindung und lade die Seite erneut.</div></div>`;
}

export async function renderDashboard(focusSection = 'dashboard') {
  const root = document.getElementById('view-dashboard');
  const profileName = getCurrentProfile()?.display_name || 'Trainer';
  root.innerHTML = `
    <section class="dashboard-header">
      <div><h1>Willkommen zurück, ${esc(profileName)}</h1><p>Hier ist dein Überblick über Turniere, Teams und Matches.</p></div>
      <div class="dashboard-actions"><button class="btn btn-secondary" onclick="window.openJoinTournamentModal()">Per Code beitreten</button><button class="btn btn-primary" onclick="window.openCreateTournamentModal()">+ Neues Turnier</button></div>
    </section>
    <section class="stats-grid" aria-label="Übersicht">
      ${renderStat('trophy', 'Aktive Turniere', 'dash-stat-tournaments', '–', 'Laufend & geplant', 'coral')}
      ${renderStat('team', 'Meine Teams', 'dash-stat-teams', '–', 'Privat & geteilt', 'teal')}
      ${renderStat('match', 'Offene Matches', '', '–', 'Im Turnierbereich', 'purple')}
      ${renderStat('pool', 'Pokémon verfügbar', '', '–', 'In allen Pools', 'gold')}
    </section>
    <div class="dashboard-grid">
      <div class="dashboard-primary">
        <section class="section-card" id="dashboard-tournaments-section">
          ${renderSectionHeader('Meine Turniere', `<button class="section-link" onclick="location.hash='/tournaments'">Alle anzeigen →</button>`)}
          <div id="dash-my-tournaments" class="dashboard-list"><div class="empty-state compact">Lade…</div></div>
        </section>
        <section class="section-card" id="dashboard-teams-section">
          ${renderSectionHeader('Meine Teams', `<button class="section-link" onclick="location.hash='/teams'">Alle anzeigen →</button>`)}
          <div id="dash-my-teams" class="dashboard-list"><div class="empty-state compact">Lade…</div></div>
          <div id="dash-team-detail" class="dashboard-detail"></div>
        </section>
      </div>
      <aside class="dashboard-secondary">
        <section class="section-card">
          ${renderSectionHeader('Nächste Matches', '<button class="section-link" onclick="window.openTournamentArea(\'matches\')">Alle anzeigen →</button>')}
          <div class="empty-state compact"><div class="empty-title">Matches werden pro Turnier verwaltet</div><div>Öffne ein Turnier, um Begegnungen und Ergebnisse zu sehen.</div></div>
        </section>
        <section class="section-card activity-panel">
          ${renderSectionHeader('Letzte Aktivität', '')}
          <div class="empty-state compact"><div class="empty-title">Noch keine Aktivitätsübersicht</div><div>Deine aktuellen Turniere und Teams findest du direkt links.</div></div>
        </section>
      </aside>
    </div>
    <section class="section-card dashboard-wide-section" id="dashboard-shared-teams-section">
      ${renderSectionHeader('Geteilte Teams', '<button class="section-link" onclick="location.hash=\'/teams\'">Alle anzeigen →</button>')}
      <div id="dash-public-teams" class="compact-card-grid"><div class="empty-state compact">Lade…</div></div>
      <div id="dash-public-team-detail" class="dashboard-detail"></div>
    </section>
    <div class="dashboard-bottom-grid">
      <section class="section-card" id="dashboard-more-tournaments-section">
        ${renderSectionHeader('Weitere Turniere', '<button class="section-link" onclick="location.hash=\'/tournaments\'">Alle anzeigen →</button>')}
        <div id="dash-public-tournaments" class="compact-card-grid"><div class="empty-state compact">Lade…</div></div>
      </section>
      <section class="section-card" id="dashboard-templates-section">
        ${renderSectionHeader('Vorlagen & Pools', '<button class="section-link" onclick="location.hash=\'/templates\'">Alle anzeigen →</button>')}
        <div id="dash-templates" class="template-grid"><div class="empty-state compact">Lade…</div></div>
      </section>
      <section class="champions-teaser">
        <div class="champion-crown" aria-hidden="true">♕</div><h2>Champions</h2>
        <p>Baue Level-50-Champions-Teams mit Mega-Formen, Verteilung, Speed Order und Team-Prüfung.</p>
        <button class="btn btn-champion" onclick="location.hash='/champions'">Champions öffnen</button>
      </section>
    </div>
  `;

  try {
    const mine = await listMyTournaments();
    document.getElementById('dash-stat-tournaments').textContent = mine.filter(t => t.status !== 'completed').length;
    document.getElementById('dash-my-tournaments').innerHTML = mine.length
      ? mine.map(renderTournamentCard).join('')
      : `<div class="empty-state compact"><div class="empty-title">Noch kein Turnier</div><div>Erstelle ein Turnier oder tritt per Einladungscode bei.</div></div>`;
  } catch (err) {
    document.getElementById('dash-my-tournaments').innerHTML = renderDashboardLoadError('Turniere');
    console.error('[dashboard] Turniere konnten nicht geladen werden:', err);
  }

  await renderPersonalTeamsSection();
  await renderPublicTeamsSection();

  try {
    const pub = await listPublicTournaments();
    document.getElementById('dash-public-tournaments').innerHTML = pub.length
      ? pub.map(t => renderTournamentCard(t, true)).join('')
      : `<div class="empty-state compact">Noch keine weiteren Turniere</div>`;
  } catch (err) {
    document.getElementById('dash-public-tournaments').innerHTML = renderDashboardLoadError('Öffentliche Turniere');
    console.error('[dashboard] Öffentliche Turniere konnten nicht geladen werden:', err);
  }

  try {
    const [rulesets, pools] = await Promise.all([listPublicRulesetTemplates(), listPublicPoolTemplates()]);
    const items = [
      ...rulesets.map(r => ({ kind: 'Ruleset', name: r.name, sub: `${r.format} · ${r.draft_mode}` })),
      ...pools.map(p => ({ kind: 'Pool', name: p.name, sub: p.description || '' })),
    ];
    document.getElementById('dash-templates').innerHTML = items.length
      ? items.map(i => `<div class="template-card"><span class="template-icon">${i.kind[0]}</span><div><strong>${esc(i.name)}</strong><small>${esc(i.kind)} · ${esc(i.sub)}</small></div><span class="badge badge-success">Aktiv</span></div>`).join('')
      : `<div class="empty-state compact">Noch keine Vorlagen oder Pools</div>`;
    document.getElementById('dash-templates').insertAdjacentHTML('beforeend', '<button class="template-add" type="button" onclick="location.hash=\'/templates\'">+ Vorlagen und Pools öffnen</button>');
  } catch (err) {
    document.getElementById('dash-templates').innerHTML = renderDashboardLoadError('Vorlagen und Pools');
    console.error('[dashboard] Vorlagen konnten nicht geladen werden:', err);
  }

  const focusTargets = {
    tournaments: 'dashboard-tournaments-section',
    teams: 'dashboard-teams-section',
    templates: 'dashboard-templates-section',
  };
  const focusId = focusTargets[focusSection];
  if (focusId) requestAnimationFrame(() => document.getElementById(focusId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}

async function renderPersonalTeamsSection() {
  const listEl = document.getElementById('dash-my-teams');
  const detailEl = document.getElementById('dash-team-detail');
  if (!listEl || !detailEl) return;
  let openPersonalTeamId = null;

  window.createPersonalTeam = async () => {
    const title = prompt('Teamname', 'Mein Team');
    if (title === null) return;
    try {
      const sheet = await createPersonalSheet(title.trim() || 'Mein Team');
      toast('Team angelegt', 'success');
      await renderPersonalTeamsSection();
      setTimeout(() => window.openPersonalTeam?.(sheet.id), 30);
    } catch (err) {
      toast('Fehler: ' + formatTeamError(err), 'error');
      console.error('[personal teams] Team konnte nicht angelegt werden:', err);
    }
  };

  try {
    const sheets = await listPersonalSheets();
    const teamStat = document.getElementById('dash-stat-teams');
    if (teamStat) teamStat.textContent = sheets.length;
    const pokemonBySheet = {};
    await Promise.all(sheets.map(async (s) => {
      pokemonBySheet[s.id] = await listPokemonForSheet(s.id);
    }));

    listEl.innerHTML = sheets.length
      ? sheets.map(s => renderPersonalTeamCard(s, pokemonBySheet[s.id] || [])).join('')
      : `<div class="empty-state compact"><div class="empty-title">Noch kein persönliches Team</div><div>Lege ein Team an und importiere deinen Showdown-Export.</div></div>`;

    window.openPersonalTeam = async (sheetId) => {
      if (openPersonalTeamId === sheetId && detailEl.innerHTML.trim()) {
        openPersonalTeamId = null;
        detailEl.innerHTML = '';
        return;
      }
      const sheet = sheets.find(s => s.id === sheetId);
      if (!sheet) return;
      openPersonalTeamId = sheetId;
      const pokemon = await listPokemonForSheet(sheet.id);
      detailEl.innerHTML = `
        <div class="tournament-setup">
          <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px">
            <div class="tournament-setup-title">${esc(sheet.title)}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${renderTeamBallSelect(sheet.ball_variant, `window.updatePersonalTeamBall('${sheet.id}', this.value)`)}
              <select class="form-select" style="width:auto;min-width:150px" onchange="window.updatePersonalTeamVisibility('${sheet.id}', this.value)">
                ${['private', 'public'].map(v => `<option value="${v}" ${v === sheet.visibility ? 'selected' : ''}>${v === 'public' ? 'public' : 'privat'}</option>`).join('')}
              </select>
              <button class="btn btn-ghost btn-sm" onclick="window.renamePersonalTeam('${sheet.id}')">Umbenennen</button>
              <button class="btn btn-ghost btn-sm" onclick="window.exportPersonalTeam('${sheet.id}')">JSON</button>
              <button class="btn btn-ghost btn-sm" onclick="window.exportPersonalTeamShowdown('${sheet.id}')">Showdown</button>
              <button class="btn btn-ghost btn-sm" onclick="document.getElementById('personal-team-import').click()">Import</button>
              <input type="file" id="personal-team-import" accept=".txt,.json" style="display:none" onchange="window.handlePersonalTeamImport(event,'${sheet.id}')" />
              <button class="btn btn-danger btn-sm" onclick="window.deletePersonalTeam('${sheet.id}')">Löschen</button>
            </div>
          </div>
          <div class="form-group" style="margin-top:10px">
            <label class="form-label">Showdown-Export einfügen</label>
            <textarea class="form-textarea" id="personal-team-paste-${sheet.id}" placeholder="Tapu Koko @ Life Orb&#10;Ability: Electric Surge&#10;..."></textarea>
            <button class="btn btn-primary btn-sm" style="margin-top:6px" onclick="window.pastePersonalTeam('${sheet.id}')">Übernehmen</button>
          </div>
          <div style="margin-top:14px">${renderPokemonGrid(pokemon)}</div>
        </div>
      `;
    };

    window.renamePersonalTeam = async (sheetId) => {
      const sheet = sheets.find(s => s.id === sheetId);
      const title = prompt('Teamname', sheet?.title || 'Mein Team');
      if (title === null) return;
      try {
        await updateSheet(sheetId, { title: title.trim() || 'Mein Team' });
        toast('Team gespeichert', 'success');
        await renderPersonalTeamsSection();
        window.openPersonalTeam(sheetId);
      } catch (err) { toast('Fehler: ' + formatTeamError(err), 'error'); }
    };

    window.updatePersonalTeamVisibility = async (sheetId, visibility) => {
      try {
        await updateSheet(sheetId, { visibility });
        toast(visibility === 'public' ? 'Team ist public' : 'Team ist privat', 'success');
        await renderPersonalTeamsSection();
        await renderPublicTeamsSection();
        window.openPersonalTeam(sheetId);
      } catch (err) { toast('Fehler: ' + formatTeamError(err), 'error'); }
    };

    window.updatePersonalTeamBall = async (sheetId, ballVariant) => {
      try {
        await updateSheet(sheetId, { ball_variant: ballVariant });
        toast('Team-Marker gespeichert', 'success');
        await renderPersonalTeamsSection();
        await renderPublicTeamsSection();
        window.openPersonalTeam(sheetId);
      } catch (err) { toast('Fehler: ' + formatTeamError(err), 'error'); }
    };

    window.deletePersonalTeam = async (sheetId) => {
      if (!confirm('Persönliches Team löschen?')) return;
      try {
        await deleteSheet(sheetId);
        detailEl.innerHTML = '';
        toast('Team gelöscht', 'success');
        await renderPersonalTeamsSection();
      } catch (err) { toast('Fehler: ' + formatTeamError(err), 'error'); }
    };

    window.handlePersonalTeamImport = async (e, sheetId) => {
      const file = e.target.files[0]; if (!file) return;
      try {
        if (file.name.endsWith('.json')) await importTeamSheetFile(file, sheetId);
        else await importShowdownIntoSheet(sheetId, await file.text());
        toast('Team importiert', 'success');
        await renderPersonalTeamsSection();
        window.openPersonalTeam(sheetId);
      } catch (err) { toast('Fehler: ' + formatTeamError(err), 'error'); }
      e.target.value = '';
    };

    window.pastePersonalTeam = async (sheetId) => {
      const text = document.getElementById(`personal-team-paste-${sheetId}`)?.value.trim();
      if (!text) { toast('Kein Text', 'error'); return; }
      try {
        await importShowdownIntoSheet(sheetId, text);
        toast('Team übernommen', 'success');
        await renderPersonalTeamsSection();
        window.openPersonalTeam(sheetId);
      } catch (err) { toast('Fehler: ' + formatTeamError(err), 'error'); }
    };

    window.exportPersonalTeam = async (sheetId) => {
      const sheet = sheets.find(s => s.id === sheetId);
      try { await exportTeamSheet(sheet); } catch (err) { toast('Fehler: ' + formatTeamError(err), 'error'); }
    };

    window.exportPersonalTeamShowdown = async (sheetId) => {
      try {
        const pokemon = await listPokemonForSheet(sheetId);
        const text = exportSheetAsShowdown(pokemon);
        navigator.clipboard?.writeText(text).catch(() => {});
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'team.txt'; a.click();
        URL.revokeObjectURL(url);
        toast('Showdown-Export gespeichert', 'success');
      } catch (err) { toast('Fehler: ' + formatTeamError(err), 'error'); }
    };
  } catch (err) {
    listEl.innerHTML = renderDashboardLoadError('Eigene Teams');
    console.error('[personal teams] Teamliste konnte nicht geladen werden:', err);
  }
}

async function renderPublicTeamsSection() {
  const listEl = document.getElementById('dash-public-teams');
  const detailEl = document.getElementById('dash-public-team-detail');
  if (!listEl || !detailEl) return;
  let openPublicTeamId = null;

  try {
    const sheets = await listPublicSheets();
    const profiles = await listVisibleProfiles().catch(() => []);
    const profileNameById = new Map();
    profiles.forEach((p) => {
      const name = p.display_name || 'Trainer';
      if (p.id) profileNameById.set(p.id, name);
      if (p.user_id) profileNameById.set(p.user_id, name);
    });
    const pokemonBySheet = {};
    await Promise.all(sheets.map(async (s) => {
      pokemonBySheet[s.id] = await listPokemonForSheet(s.id);
    }));

    listEl.innerHTML = sheets.length
      ? sheets.map(s => renderPublicTeamCard(s, pokemonBySheet[s.id] || [], profileNameById.get(s.profile_id))).join('')
      : `<div class="empty-state compact">Noch keine geteilten Teams.</div>`;

    window.openPublicTeam = async (sheetId) => {
      if (openPublicTeamId === sheetId && detailEl.innerHTML.trim()) {
        openPublicTeamId = null;
        detailEl.innerHTML = '';
        return;
      }
      const sheet = sheets.find(s => s.id === sheetId);
      if (!sheet) return;
      openPublicTeamId = sheetId;
      const pokemon = await listPokemonForSheet(sheet.id);
      detailEl.innerHTML = `
        <div class="tournament-setup">
          <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px">
            <div>
              <div class="tournament-setup-title">${esc(sheet.title || 'Team')}</div>
              <div style="font-size:12px;color:var(--text-muted)">${esc(profileNameById.get(sheet.profile_id) || 'Unbekannter Trainer')} · Geteilt</div>
            </div>
            <button class="btn btn-ghost btn-sm" onclick="document.getElementById('dash-public-team-detail').innerHTML=''">Schließen</button>
          </div>
          <div style="margin-top:14px">${renderPokemonGrid(pokemon)}</div>
        </div>
      `;
    };
  } catch (err) {
    listEl.innerHTML = renderDashboardLoadError('Geteilte Teams');
    console.error('[public teams] Teamliste konnte nicht geladen werden:', err);
  }
}

function formatTeamError(err) {
  const raw = [err?.message, err?.details, err?.hint, err?.code].filter(Boolean).join(' ');
  if (/null value.*tournament_id|not-null|null value.*member_id/i.test(raw)) {
    return 'Supabase-Migration fehlt: SUPABASE_FIX_PERSONAL_TEAMS.sql im SQL Editor ausführen.';
  }
  if (/row-level security|violates row-level security|403|42501/i.test(raw)) {
    return 'RLS blockiert den Zugriff. Bitte SUPABASE_FIX_PERSONAL_TEAMS.sql im SQL Editor ausführen.';
  }
  if (/ball_variant|column .* does not exist|PGRST204/i.test(raw)) {
    return 'Supabase-Migration fehlt: SUPABASE_FIX_TEAM_BALL_VARIANT.sql im SQL Editor ausführen.';
  }
  return err?.message || 'Unbekannter Fehler';
}

function renderTeamSprites(pokemon) {
  const slots = pokemon.slice(0, 6).map(p => {
    const name = p.pokemon_name || p.name || 'Pokémon';
    return `<span class="team-sprite-slot"><img ${spriteAttrs(name)} alt="${esc(name)}" title="${esc(name)}" /></span>`;
  });
  while (slots.length < 6) slots.push('<span class="team-sprite-slot empty" aria-hidden="true"></span>');
  return `<span class="team-sprite-rail" aria-label="Teamaufstellung">${slots.join('')}</span>`;
}

function sheetModeLabel(sheet) {
  if ((sheet.team_mode || 'standard') === 'champions' || sheet.rules_profile === 'champions') return 'Champions';
  if (sheet.rules_profile === 'current') return 'Aktuelle Generation';
  return 'Open Sheet';
}

function sheetFormatLabel(sheet) {
  return (sheet.battle_format || 'singles') === 'doubles' ? 'Doubles' : 'Singles';
}

function renderPersonalTeamCard(sheet, pokemon) {
  const pokemonCount = pokemon.length;
  const shared = sheet.visibility === 'public';
  const meta = `${sheetModeLabel(sheet)} · ${sheetFormatLabel(sheet)} · ${pokemonCount} Pokémon`;
  return `<button class="dashboard-row team-row" onclick="window.openPersonalTeam('${sheet.id}')">
    ${renderTeamBall(sheet.ball_variant)}<span class="row-copy"><strong>${esc(sheet.title || 'Team')}</strong><small>${esc(meta)}</small></span>
    ${renderTeamSprites(pokemon)}<span class="badge ${shared ? 'badge-success' : ''}">${shared ? 'Geteilt' : 'Privat'}</span><span class="btn btn-secondary btn-sm">Ansehen</span><span class="row-chevron">›</span>
  </button>`;
}

function renderPublicTeamCard(sheet, pokemon, ownerName = '') {
  const pokemonCount = pokemon.length;
  return `<button class="compact-team-card" onclick="window.openPublicTeam('${sheet.id}')">
    ${renderTeamBall(sheet.ball_variant)}<span><strong>${esc(sheet.title || 'Team')}</strong><small>von ${esc(ownerName || 'Unbekannter Trainer')} · ${pokemonCount} Pokémon</small></span>${renderTeamSprites(pokemon)}<span class="badge badge-success">Geteilt</span>
  </button>`;
}

function renderTournamentCard(t, isPublicListing = false) {
  const vis = VISIBILITY_LABEL[t.visibility] || t.visibility;
  const status = STATUS_LABEL[t.status] || t.status;
  const roleBadge = t.my_role ? `<span class="type-chip" style="background:rgba(250,204,21,.12);color:var(--accent)">${esc(t.my_role)}</span>` : '';
  const statusClass = t.status === 'active' ? 'badge-success' : t.status === 'setup' ? 'badge-warning' : '';
  return `<button class="dashboard-row tournament-row" onclick="location.hash='/t/${esc(t.slug)}'">
    <span class="league-icon" aria-hidden="true"></span><span class="row-copy"><strong>${esc(t.name)}</strong><small>${esc(t.description || `/t/${t.slug}`)}</small></span>
    ${roleBadge}<span class="badge ${statusClass}">${esc(status)}</span><span class="badge">${esc(vis)}</span><span class="btn btn-secondary btn-sm">${isPublicListing ? 'Details' : 'Öffnen'}</span><span class="row-chevron">›</span>
  </button>`;
}

// ─── CREATE TOURNAMENT MODAL ─────────────────────────────────────────
export function openCreateTournamentModal() {
  openModal('create-tournament');
}

export async function submitCreateTournament() {
  const name = document.getElementById('ct-name').value.trim();
  if (!name) { toast('Name fehlt', 'error'); return; }
  const form = {
    name,
    description: document.getElementById('ct-desc').value.trim(),
    visibility: document.getElementById('ct-visibility').value,
    show_open_sheets: document.getElementById('ct-show-sheets').checked,
    hide_teams_until_start: document.getElementById('ct-hide-teams').checked,
  };
  try {
    const t = await createTournament(form);
    closeModal('create-tournament');
    toast('Turnier erstellt 🏆', 'success');
    navigate(`/t/${t.slug}`);
  } catch (err) {
    toast('Fehler: ' + err.message, 'error');
  }
}

// ─── JOIN BY CODE MODAL ──────────────────────────────────────────────
export function openJoinTournamentModal() {
  openModal('join-tournament');
}

export async function submitJoinTournament() {
  const code = document.getElementById('jt-code').value.trim().toUpperCase();
  if (!code) { toast('Code fehlt', 'error'); return; }
  try {
    const result = await redeemInviteCode(code);
    closeModal('join-tournament');
    toast('Turnier beigetreten ✓', 'success');
    navigate(`/t/${result.tournament_slug}`);
  } catch (err) {
    const msg = {
      not_authenticated: 'Bitte zuerst einloggen.',
      profile_missing: 'Zu deinem Login wurde kein Profil gefunden. Bitte einmal neu einloggen.',
      invalid_code: 'Ungültiger Code.',
      code_expired: 'Dieser Code ist abgelaufen.',
      code_exhausted: 'Dieser Code wurde bereits zu oft verwendet.',
    }[err.message] || ('Fehler: ' + err.message);
    toast(msg, 'error');
  }
}

export function initDashboardFeature() {
  window.openCreateTournamentModal = openCreateTournamentModal;
  window.submitCreateTournament = submitCreateTournament;
  window.openJoinTournamentModal = openJoinTournamentModal;
  window.submitJoinTournament = submitJoinTournament;
}
