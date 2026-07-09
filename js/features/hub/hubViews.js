import { esc, toast } from '../../utils.js';
import { listMyTournaments, listPublicTournaments } from '../tournaments/tournaments.js';
import {
  listPersonalSheets, listPublicSheets, listPersonalSheetsByMode, listPublicSheetsByMode, listPokemonForSheet, createPersonalSheet,
  updateSheet, deleteSheet, importShowdownIntoSheet, exportSheetAsShowdown,
  updatePokemonSet, deletePokemonSet, duplicatePersonalSheet, addPokemonSet, updatePokemonSetOrder,
} from '../teams/teamSheets.js?v=20260708a';
import { exportTeamSheet, importTeamSheetFile } from '../importExport/importExport.js?v=20260705b';
import { listPublicRulesetTemplates } from '../rulesets/rulesets.js';
import { listPublicPoolTemplates, listPoolPokemon, listPokemonCatalog } from '../pools/pools.js';
import { renderPokemonGrid, renderTeamBall } from '../openSheets/openSheets.js?v=20260704';
import { spriteAttrs } from '../../sprites.js';
import { listVisibleProfiles } from '../../profileService.js';
import { validateTeam } from '../teams/teamValidation.js?v=20260705e';
import { listReferenceCatalogs } from '../catalogs/referenceCatalogs.js?v=20260704c';

const STATUS_LABEL = { setup: 'Vorbereitung', active: 'Aktiv', completed: 'Abgeschlossen' };

function pageHeader(title, subtitle, actions = '') {
  return `<header class="hub-page-header"><div><h1>${title}</h1><p>${subtitle}</p></div><div class="hub-page-actions">${actions}</div></header>`;
}

function hubLoadError(area) {
  return `<div class="hub-empty error"><strong>${esc(area)} konnten nicht geladen werden.</strong><span>Bitte prüfe deine Verbindung und lade die Seite erneut.</span></div>`;
}

function pokemonPreview(pokemon) {
  const slots = pokemon.slice(0, 6).map(p => {
    const name = p.pokemon_name || p.name || 'Pokémon';
    return `<span class="hub-mon-slot"><img ${spriteAttrs(name)} alt="${esc(name)}" title="${esc(name)}"></span>`;
  });
  while (slots.length < 6) slots.push('<span class="hub-mon-slot empty" aria-hidden="true"></span>');
  return `<span class="hub-mon-preview" aria-label="Teamaufstellung mit ${pokemon.length} Pokémon">${slots.join('')}</span>`;
}

function tournamentCard(t, featured = false) {
  const status = STATUS_LABEL[t.status] || t.status;
  return `<article class="hub-tournament-card ${featured ? 'featured' : ''}">
    <div class="hub-card-icon tournament">♜</div>
    <div class="hub-card-copy"><div class="hub-card-title-row"><h3>${esc(t.name)}</h3><span class="badge ${t.status === 'active' ? 'badge-success' : t.status === 'setup' ? 'badge-warning' : ''}">${esc(status)}</span></div>
      <p>${esc(t.description || 'Keine Beschreibung hinterlegt.')}</p>
      <div class="hub-meta"><span>${esc(t.visibility || 'privat')}</span>${t.my_role ? `<span>${esc(t.my_role)}</span>` : ''}<span>#${esc(t.slug)}</span></div>
    </div>
    <button class="btn ${featured ? 'btn-primary' : 'btn-secondary'}" onclick="location.hash='/t/${esc(t.slug)}/overview'">Öffnen</button>
  </article>`;
}

export async function renderTournamentsPage(root) {
  root.innerHTML = pageHeader('Turniere', 'Aktuelles Turnier öffnen oder alle bisherigen Turniere verwalten.', '<button class="btn btn-secondary" onclick="window.openJoinTournamentModal()">Per Code beitreten</button><button class="btn btn-primary" onclick="window.openCreateTournamentModal()">+ Neues Turnier</button>') + '<div class="hub-loading">Turniere werden geladen…</div>';
  try {
    const [mine, publicTournaments] = await Promise.all([listMyTournaments(), listPublicTournaments()]);
    const lastSlug = localStorage.getItem('ots:last-tournament-slug');
    const current = mine.find(t => t.slug === lastSlug) || mine.find(t => t.status === 'active') || mine.find(t => t.status === 'setup') || mine[0];
    const remaining = mine.filter(t => t.id !== current?.id);
    root.innerHTML = `
      ${pageHeader('Turniere', 'Aktuelles Turnier öffnen oder alle bisherigen Turniere verwalten.', '<button class="btn btn-secondary" onclick="window.openJoinTournamentModal()">Per Code beitreten</button><button class="btn btn-primary" onclick="window.openCreateTournamentModal()">+ Neues Turnier</button>')}
      <section class="hub-section"><div class="hub-section-title"><h2>Aktuelles Turnier</h2></div>${current ? tournamentCard(current, true) : '<div class="hub-empty">Noch kein Turnier vorhanden.</div>'}</section>
      <section class="hub-section"><div class="hub-section-title"><h2>Meine Turniere</h2><span>${remaining.length}</span></div><div class="hub-list">${remaining.length ? remaining.map(t => tournamentCard(t)).join('') : '<div class="hub-empty">Keine weiteren eigenen Turniere.</div>'}</div></section>
      <section class="hub-section"><div class="hub-section-title"><h2>Weitere Turniere</h2><span>${publicTournaments.length}</span></div><div class="hub-list">${publicTournaments.length ? publicTournaments.map(t => tournamentCard(t)).join('') : '<div class="hub-empty">Aktuell sind keine weiteren Turniere sichtbar.</div>'}</div></section>`;
  } catch (err) {
    root.innerHTML = pageHeader('Turniere', 'Aktuelles Turnier öffnen oder alle bisherigen Turniere verwalten.') + hubLoadError('Turniere');
    console.error('[hub] Turniere konnten nicht geladen werden:', err);
  }
}

function teamCard(sheet, pokemon, owner = '', shared = false) {
  const isPublic = shared || sheet.visibility === 'public';
  const meta = shared ? `von ${esc(owner || 'Trainer')}` : `${pokemon.length}/6 Pokémon`;
  const action = shared ? `window.openHubTeam('${sheet.id}', true)` : `location.hash='/builder/${sheet.id}'`;
  return `<button type="button" class="hub-team-card ${shared ? 'shared' : 'own'}" data-team-id="${sheet.id}" aria-pressed="false" onclick="${action}">
    <div class="hub-team-head">${renderTeamBall(sheet.ball_variant, 'team-list-ball')}<span class="hub-team-copy"><strong>${esc(sheet.title || 'Team')}</strong><small>${meta}</small></span><span class="badge ${isPublic ? 'badge-success' : ''}">${isPublic ? 'Geteilt' : 'Privat'}</span></div>
    ${pokemonPreview(pokemon)}
    <span class="hub-team-card-footer"><span>${shared ? 'Team ansehen' : 'Im Builder öffnen'}</span><span aria-hidden="true">›</span></span>
  </button>`;
}

const EV_STATS = [
  ['HP', 'KP'], ['Atk', 'Angriff'], ['Def', 'Verteidigung'],
  ['SpA', 'Sp.-Angriff'], ['SpD', 'Sp.-Verteidigung'], ['Spe', 'Initiative'],
];

function renderPokemonSetEditor(mon, references = { moves: [], items: [], abilities: [] }) {
  const moves = [...(mon.moves || [])];
  while (moves.length < 4) moves.push('');
  const evs = mon.evs || {};
  const field = (id, label, value, placeholder = '', list = '') => `<label class="hub-set-field"><span>${label}</span><input class="form-input" id="${id}" value="${esc(value || '')}" placeholder="${esc(placeholder)}" ${list ? `list="${list}"` : ''}></label>`;
  const options = list => list.map(entry => `<option value="${esc(entry.display_name)}"></option>`).join('');
  return `<section class="hub-set-editor" aria-label="${esc(mon.pokemon_name)} bearbeiten">
    <header class="hub-set-editor-head"><div class="hub-set-editor-identity"><img ${spriteAttrs(mon.pokemon_name)} alt="${esc(mon.pokemon_name)}"><div><span>Pokémon-Set bearbeiten</span><h3>${esc(mon.pokemon_name)}</h3></div></div><button class="btn btn-ghost btn-sm" onclick="window.closeHubPokemonEditor()">Schließen</button></header>
    <div class="hub-set-fields">
      ${field('hub-set-nickname', 'Spitzname', mon.nickname, 'Optional')}
      ${field('hub-set-item', 'Item', mon.item, 'z. B. Überreste', 'hub-item-options')}
      ${field('hub-set-ability', 'Fähigkeit', mon.ability, 'z. B. Bedroher', 'hub-ability-options')}
      ${field('hub-set-tera', 'Tera-Typ', mon.tera_type, 'Optional')}
      ${field('hub-set-nature', 'Wesen', mon.nature, 'z. B. Froh')}
    </div>
    <div class="hub-set-editor-columns">
      <fieldset class="hub-set-panel"><legend>EV-Verteilung</legend><div class="hub-set-ev-grid">${EV_STATS.map(([key, label]) => `<label><span>${label}</span><input class="form-input hub-set-ev" id="hub-set-ev-${key}" type="number" min="0" max="252" step="1" value="${Number(evs[key]) || 0}"></label>`).join('')}</div><div class="hub-set-ev-total">Verteilt: <strong id="hub-set-ev-total">0</strong>/510 EV</div></fieldset>
      <fieldset class="hub-set-panel"><legend>Moves</legend><div class="hub-set-move-grid">${moves.slice(0, 4).map((move, index) => `<label><span>Move ${index + 1}</span><input class="form-input" id="hub-set-move-${index}" value="${esc(move)}" placeholder="Move eingeben" list="hub-move-options"></label>`).join('')}</div></fieldset>
    </div>
    <datalist id="hub-item-options">${options(references.items)}</datalist><datalist id="hub-ability-options">${options(references.abilities)}</datalist><datalist id="hub-move-options">${options(references.moves)}</datalist>
    <div class="hub-set-editor-actions"><button class="btn btn-danger btn-sm" onclick="window.removeHubPokemonSet('${mon.id}')">Pokémon entfernen</button><span id="hub-set-editor-status" role="status"></span><button class="btn btn-primary" onclick="window.saveHubPokemonSet('${mon.id}')">Änderungen speichern</button></div>
  </section>`;
}

function renderAddPokemonPanel(catalog, currentPokemon) {
  const existing = new Set(currentPokemon.map(mon => mon.pokemon_id));
  const available = catalog.filter(mon => !existing.has(mon.pokemon_id));
  const types = [...new Set(available.flatMap(mon => mon.types || []))].sort();
  const generations = [...new Set(available.map(mon => mon.generation).filter(Boolean))].sort((a, b) => a - b);
  return `<section class="hub-add-pokemon" aria-labelledby="hub-add-pokemon-title">
    <div class="hub-add-pokemon-copy"><span>Nächster Teamplatz</span><h3 id="hub-add-pokemon-title">Pokémon hinzufügen</h3><p>Wähle ein Pokémon aus dem Katalog. Das vollständige Set bearbeitest du direkt danach.</p></div>
    <div class="hub-add-pokemon-control"><label class="form-label" for="hub-add-pokemon-search">Katalog durchsuchen</label><div class="hub-add-pokemon-filters"><input class="form-input" id="hub-add-pokemon-search" type="search" placeholder="Name oder Pokédex-Nummer" oninput="window.filterHubPokemonCatalog()"><select class="form-select" id="hub-add-pokemon-type" aria-label="Typ filtern" onchange="window.filterHubPokemonCatalog()"><option value="">Alle Typen</option>${types.map(type => `<option value="${esc(type)}">${esc(type)}</option>`).join('')}</select><select class="form-select" id="hub-add-pokemon-generation" aria-label="Generation filtern" onchange="window.filterHubPokemonCatalog()"><option value="">Alle Generationen</option>${generations.map(generation => `<option value="${generation}">Generation ${generation}</option>`).join('')}</select></div><div class="hub-add-pokemon-result"><select class="form-select" id="hub-add-pokemon-select"><option value="">Pokémon auswählen …</option>${available.map(mon => `<option value="${esc(mon.pokemon_id)}">#${String(mon.dex_number || '').padStart(3, '0')} ${esc(mon.pokemon_name)}</option>`).join('')}</select><button class="btn btn-primary" onclick="window.addHubPokemon()" ${available.length ? '' : 'disabled'}>Zum Team hinzufügen</button></div><small id="hub-add-pokemon-count">${available.length} Pokémon verfügbar</small></div>
  </section>`;
}

function renderTeamRulesetPanel(sheet, rulesets, pokemonCount) {
  const selected = rulesets.find(ruleset => ruleset.id === sheet.ruleset_id);
  const sizeWarning = selected && pokemonCount > selected.team_size
    ? `<p class="hub-ruleset-warning">Das Team enthält ${pokemonCount} Pokémon, das Regelset sieht ${selected.team_size} vor.</p>`
    : '';
  const details = selected
    ? `<div class="hub-ruleset-facts"><span><strong>${esc(selected.format)}</strong> Format</span><span><strong>${selected.team_size}</strong> Teamgröße</span><span><strong>${selected.allow_duplicates ? 'Ja' : 'Nein'}</strong> Duplikate</span>${selected.points_budget != null ? `<span><strong>${selected.points_budget}</strong> Punkte</span>` : ''}</div>${selected.free_text_rules ? `<p class="hub-ruleset-note">${esc(selected.free_text_rules)}</p>` : ''}${sizeWarning}`
    : '<p class="hub-ruleset-note">Ohne Regelset wird das Team nur auf allgemeine Vollständigkeit geprüft.</p>';
  return `<section class="hub-ruleset-context"><div><span>Team-Kontext</span><h3>Regelset</h3></div><label><span class="form-label">Vorlage auswählen</span><select class="form-select" onchange="window.setHubTeamRuleset('${sheet.id}',this.value)"><option value="">Kein Regelset</option>${rulesets.map(ruleset => `<option value="${ruleset.id}" ${ruleset.id === sheet.ruleset_id ? 'selected' : ''}>${esc(ruleset.name)}</option>`).join('')}</select></label><div class="hub-ruleset-details">${details}</div></section>`;
}

function renderTeamCheck(pokemon, ruleset, editable) {
  const result = validateTeam(pokemon, ruleset);
  const label = { complete: 'Einsatzbereit', warning: 'Fast vollständig', error: 'Bitte korrigieren' }[result.status];
  const icon = { complete: '✓', warning: '!', error: '×' }[result.status];
  const renderIssues = (level, title) => {
    const entries = result.issues.filter(item => item.level === level);
    if (!entries.length) return '';
    return `<section class="hub-team-check-group ${level}"><h4>${title}<span>${entries.length}</span></h4><ul>${entries.map(item => `<li class="${item.level}"><span>${item.level === 'error' ? 'Fehler' : 'Hinweis'}</span><div><p>${esc(item.message)}</p><small>${esc(item.fix)}</small></div>${editable && item.pokemonId ? `<button class="btn btn-ghost btn-sm" onclick="window.openHubPokemonEditor('${item.pokemonId}')">Set bearbeiten</button>` : ''}</li>`).join('')}</ul></section>`;
  };
  const items = renderIssues('error', 'Zuerst beheben') + renderIssues('warning', 'Danach ergänzen');
  return `<details class="hub-team-check ${result.status}" ${result.status === 'error' ? 'open' : ''}><summary><span class="hub-team-check-icon">${icon}</span><span><strong>Team-Prüfung: ${label}</strong><small>${result.errors} Fehler · ${result.warnings} Hinweise</small></span><span class="hub-team-check-toggle">Details</span></summary>${items || '<p class="hub-team-check-success">Alle derzeit prüfbaren Angaben sind vollständig.</p>'}</details>`;
}

export async function renderTeamsPage(root) {
  root.innerHTML = pageHeader('Teams', 'Eigene Teams bearbeiten und geteilte Teams ansehen.', '<button class="btn btn-primary" onclick="window.createHubTeam()">+ Team anlegen</button>') + '<div class="hub-loading">Teams werden geladen…</div>';
  try {
    const [mine, shared, profiles, catalog, rulesets, referenceData] = await Promise.all([listPersonalSheetsByMode('standard'), listPublicSheetsByMode('standard'), listVisibleProfiles().catch(() => []), listPokemonCatalog().catch(() => []), listPublicRulesetTemplates().catch(() => []), listReferenceCatalogs().catch(() => ({ moves: [], items: [], abilities: [] }))]);
    const names = new Map();
    profiles.forEach(p => { if (p.id) names.set(p.id, p.display_name); if (p.user_id) names.set(p.user_id, p.display_name); });
    const ownIds = new Set(mine.map(sheet => sheet.id));
    const sharedFromOthers = shared.filter(sheet => !ownIds.has(sheet.id));
    const all = [...mine, ...sharedFromOthers];
    const pokemonResults = await Promise.allSettled(all.map(async sheet => [sheet.id, await listPokemonForSheet(sheet.id)]));
    const pokemon = new Map();
    const failedTeamIds = new Set();
    pokemonResults.forEach((result, index) => {
      if (result.status === 'fulfilled') pokemon.set(result.value[0], result.value[1]);
      else failedTeamIds.add(all[index].id);
    });
    root.innerHTML = `
      ${pageHeader('Teams', 'Eigene Teams bearbeiten und geteilte Teams ansehen.', '<button class="btn btn-primary" onclick="window.createHubTeam()">+ Team anlegen</button>')}
      <section class="hub-section"><div class="hub-section-title"><div><h2>Meine Teams</h2><p>Bearbeiten, importieren oder mit anderen teilen</p></div><span>${mine.length}</span></div><div class="hub-team-grid own-teams">${mine.length ? mine.map(s => teamCard(s, pokemon.get(s.id) || [])).join('') : '<div class="hub-empty"><strong>Noch kein eigenes Team</strong><span>Lege dein erstes Team an oder importiere später einen Showdown-Export.</span><button class="btn btn-primary btn-sm" onclick="window.createHubTeam()">Team anlegen</button></div>'}</div><section id="hub-own-team-detail" class="hub-team-detail"></section></section>
      <section class="hub-section"><div class="hub-section-title"><div><h2>Geteilte Teams</h2><p>Öffentliche Teams anderer Trainer</p></div><span>${sharedFromOthers.length}</span></div><div class="hub-team-grid shared-teams">${sharedFromOthers.length ? sharedFromOthers.map(s => teamCard(s, pokemon.get(s.id) || [], names.get(s.profile_id), true)).join('') : '<div class="hub-empty">Noch keine geteilten Teams vorhanden.</div>'}</div><section id="hub-shared-team-detail" class="hub-team-detail"></section></section>
      ${failedTeamIds.size ? `<div class="hub-inline-warning">${failedTeamIds.size} Team${failedTeamIds.size === 1 ? '' : 's'} konnte${failedTeamIds.size === 1 ? '' : 'n'} nicht vollständig geladen werden.</div>` : ''}`;

    let activeSheet = null;
    let activeMons = [];
    let activeIsShared = false;

    window.createHubTeam = async () => {
      const title = prompt('Teamname', 'Mein Team');
      if (title === null) return;
      try { await createPersonalSheet(title.trim() || 'Mein Team'); toast('Team angelegt', 'success'); await renderTeamsPage(root); }
      catch (err) { toast('Fehler: ' + err.message, 'error'); }
    };
    window.openHubTeam = async (sheetId, isShared) => {
      const selectedCard = document.querySelector(`.hub-team-card[data-team-id="${sheetId}"]`);
      if (selectedCard?.classList.contains('selected')) {
        window.closeHubTeamDetail();
        return;
      }
      const sheet = all.find(item => item.id === sheetId);
      const mons = pokemon.get(sheetId) || [];
      const detail = document.getElementById(isShared ? 'hub-shared-team-detail' : 'hub-own-team-detail');
      if (!sheet || !detail) return;
      activeSheet = sheet;
      activeMons = mons;
      activeIsShared = isShared;
      document.querySelectorAll('.hub-team-card').forEach(card => {
        const selected = card.dataset.teamId === sheetId;
        card.classList.toggle('selected', selected);
        card.setAttribute('aria-pressed', String(selected));
      });
      document.querySelectorAll('.hub-team-detail').forEach(panel => { if (panel !== detail) panel.innerHTML = ''; });
      const teamProgress = `<div class="hub-team-progress" aria-label="${mons.length} von 6 Teamplätzen belegt"><span style="width:${Math.min(mons.length / 6 * 100, 100)}%"></span></div>`;
      const addPanel = !isShared && mons.length < 6 ? renderAddPokemonPanel(catalog, mons) : '';
      const rulesetPanel = !isShared ? renderTeamRulesetPanel(sheet, rulesets, mons.length) : '';
      const selectedRuleset = rulesets.find(ruleset => ruleset.id === sheet.ruleset_id) || null;
      const teamCheck = renderTeamCheck(mons, selectedRuleset, !isShared);
      detail.innerHTML = `<div class="section-card hub-team-editor"><div class="hub-team-detail-head"><div class="hub-team-detail-title">${renderTeamBall(sheet.ball_variant, 'team-list-ball')}<div><h2>${esc(sheet.title || 'Team')}</h2><p>${mons.length}/6 Pokémon${isShared ? ` · von ${esc(names.get(sheet.profile_id) || 'Trainer')}` : ` · ${sheet.visibility === 'public' ? 'geteilt' : 'privat'}`}</p>${teamProgress}</div></div><div class="hub-page-actions hub-team-primary-actions"><button class="btn btn-secondary btn-sm" onclick="window.copyHubTeamShowdown('${sheet.id}')">Showdown kopieren</button><button class="btn btn-secondary btn-sm" onclick="window.exportHubTeamJson('${sheet.id}')">JSON exportieren</button>${sheet.visibility === 'public' && !sheet.tournament_id ? `<button class="btn btn-secondary btn-sm" onclick="window.copyHubPublicTeamLink('${sheet.id}')">Öffentlichen Link kopieren</button>` : ''}${isShared ? '' : `<button class="btn btn-secondary btn-sm" onclick="window.toggleHubTeamVisibility('${sheet.id}','${sheet.visibility}')">${sheet.visibility === 'public' ? 'Privat machen' : 'Team teilen'}</button>`}<button class="btn btn-ghost btn-sm" onclick="window.closeHubTeamDetail()">Schließen</button></div></div>${isShared ? '' : `<div class="hub-team-utility-bar"><button class="btn btn-ghost btn-sm" onclick="window.renameHubTeam('${sheet.id}')">Umbenennen</button><button class="btn btn-ghost btn-sm" onclick="window.duplicateHubTeam('${sheet.id}')">Duplizieren</button><button class="btn btn-ghost btn-sm" onclick="document.getElementById('hub-team-json-file').click()">JSON importieren</button><input id="hub-team-json-file" class="hub-hidden-file" type="file" accept="application/json,.json" onchange="window.importHubTeamJson('${sheet.id}',this)"><details class="hub-team-import"><summary>Showdown importieren</summary><div class="form-group"><label class="form-label" for="hub-team-paste">Showdown-Export einfügen</label><textarea class="form-textarea" id="hub-team-paste" placeholder="Pokémon @ Item&#10;Ability: ..."></textarea><div class="hub-team-import-actions"><button class="btn btn-primary btn-sm" onclick="window.importHubTeam('${sheet.id}')">Team übernehmen</button></div></div></details><button class="btn btn-danger btn-sm hub-delete-team" onclick="window.deleteHubTeam('${sheet.id}')">Team löschen</button></div>${rulesetPanel}${addPanel}`}${teamCheck}<div id="hub-pokemon-set-editor"></div><div class="hub-team-pokemon-detail">${renderPokemonGrid(mons, { editable: !isShared, reorderable: !isShared })}</div></div>`;
      detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    window.closeHubTeamDetail = () => {
      activeSheet = null;
      activeMons = [];
      activeIsShared = false;
      document.querySelectorAll('.hub-team-detail').forEach(panel => { panel.innerHTML = ''; });
      document.querySelectorAll('.hub-team-card').forEach(card => { card.classList.remove('selected'); card.setAttribute('aria-pressed', 'false'); });
    };
    const refreshOpenTeam = async (sheetId, isShared = false) => {
      await renderTeamsPage(root);
      await window.openHubTeam(sheetId, isShared);
    };
    window.openHubPokemonEditor = setId => {
      const mon = activeMons.find(item => item.id === setId);
      const editor = document.getElementById('hub-pokemon-set-editor');
      if (!mon || !editor || activeIsShared) return;
      editor.innerHTML = renderPokemonSetEditor(mon, referenceData);
      const updateTotal = () => {
        const values = EV_STATS.map(([key]) => Number(document.getElementById(`hub-set-ev-${key}`)?.value) || 0);
        const total = values.reduce((sum, value) => sum + value, 0);
        const output = document.getElementById('hub-set-ev-total');
        if (output) { output.textContent = String(total); output.classList.toggle('invalid', total > 510); }
      };
      document.querySelectorAll('.hub-set-ev').forEach(input => input.addEventListener('input', updateTotal));
      updateTotal();
      editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    window.closeHubPokemonEditor = () => {
      const editor = document.getElementById('hub-pokemon-set-editor');
      if (editor) editor.innerHTML = '';
    };
    window.filterHubPokemonCatalog = () => {
      const search = document.getElementById('hub-add-pokemon-search')?.value.trim().toLowerCase() || '';
      const type = document.getElementById('hub-add-pokemon-type')?.value || '';
      const generation = document.getElementById('hub-add-pokemon-generation')?.value || '';
      const existing = new Set(activeMons.map(mon => mon.pokemon_id));
      const filtered = catalog.filter(mon => {
        if (existing.has(mon.pokemon_id)) return false;
        const dex = String(mon.dex_number || '');
        if (search && !mon.pokemon_name.toLowerCase().includes(search) && !dex.includes(search.replace(/^#/, ''))) return false;
        if (type && !(mon.types || []).includes(type)) return false;
        if (generation && String(mon.generation) !== generation) return false;
        return true;
      });
      const select = document.getElementById('hub-add-pokemon-select');
      if (!select) return;
      select.replaceChildren();
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = filtered.length ? 'Pokémon auswählen …' : 'Keine Treffer';
      select.append(placeholder);
      filtered.forEach(mon => {
        const option = document.createElement('option');
        option.value = mon.pokemon_id;
        option.textContent = `#${String(mon.dex_number || '').padStart(3, '0')} ${mon.pokemon_name}`;
        select.append(option);
      });
      const button = select.parentElement?.querySelector('button');
      if (button) button.disabled = filtered.length === 0;
      const count = document.getElementById('hub-add-pokemon-count');
      if (count) count.textContent = `${filtered.length} Pokémon gefunden`;
    };
    window.moveHubPokemon = async (setId, direction) => {
      if (!activeSheet || activeIsShared) return;
      const index = activeMons.findIndex(mon => mon.id === setId);
      const targetIndex = index + Number(direction);
      if (index < 0 || targetIndex < 0 || targetIndex >= activeMons.length) return;
      const reordered = [...activeMons];
      [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
      try {
        await updatePokemonSetOrder(reordered);
        toast('Reihenfolge aktualisiert', 'success');
        await refreshOpenTeam(activeSheet.id, false);
      } catch (err) { toast('Sortieren fehlgeschlagen: ' + err.message, 'error'); }
    };
    window.addHubPokemon = async () => {
      if (!activeSheet || activeIsShared) return;
      if (activeMons.length >= 6) { toast('Das Team ist bereits vollständig.', 'error'); return; }
      const selectedId = document.getElementById('hub-add-pokemon-select')?.value;
      const selected = catalog.find(mon => mon.pokemon_id === selectedId);
      if (!selected) { toast('Bitte zuerst ein Pokémon auswählen.', 'error'); return; }
      try {
        const created = await addPokemonSet(activeSheet.id, selected, activeMons.length);
        toast(`${selected.pokemon_name} hinzugefügt`, 'success');
        await refreshOpenTeam(activeSheet.id, false);
        window.openHubPokemonEditor(created.id);
      } catch (err) { toast('Hinzufügen fehlgeschlagen: ' + err.message, 'error'); }
    };
    window.saveHubPokemonSet = async setId => {
      if (!activeSheet || activeIsShared) return;
      const status = document.getElementById('hub-set-editor-status');
      const evs = {};
      for (const [key] of EV_STATS) {
        const value = Number(document.getElementById(`hub-set-ev-${key}`)?.value);
        if (!Number.isInteger(value) || value < 0 || value > 252) {
          if (status) status.textContent = 'Jeder EV-Wert muss zwischen 0 und 252 liegen.';
          return;
        }
        evs[key] = value;
      }
      const total = Object.values(evs).reduce((sum, value) => sum + value, 0);
      if (total > 510) { if (status) status.textContent = `EV-Summe ${total}/510 ist zu hoch.`; return; }
      const moves = [0, 1, 2, 3].map(index => document.getElementById(`hub-set-move-${index}`)?.value.trim() || '').filter(Boolean);
      if (status) status.textContent = 'Speichern läuft …';
      try {
        await updatePokemonSet(setId, {
          nickname: document.getElementById('hub-set-nickname')?.value.trim() || null,
          item: document.getElementById('hub-set-item')?.value.trim() || null,
          ability: document.getElementById('hub-set-ability')?.value.trim() || null,
          tera_type: document.getElementById('hub-set-tera')?.value.trim() || null,
          nature: document.getElementById('hub-set-nature')?.value.trim() || null,
          evs,
          moves,
        });
        toast('Pokémon-Set gespeichert', 'success');
        await refreshOpenTeam(activeSheet.id, false);
      } catch (err) { if (status) status.textContent = 'Fehler: ' + err.message; }
    };
    window.removeHubPokemonSet = async setId => {
      if (!activeSheet || activeIsShared) return;
      if (!confirm('Dieses Pokémon aus dem Team entfernen?')) return;
      try { await deletePokemonSet(setId); toast('Pokémon entfernt', 'success'); await refreshOpenTeam(activeSheet.id, false); }
      catch (err) { toast('Fehler: ' + err.message, 'error'); }
    };
    window.copyHubTeamShowdown = async sheetId => {
      try {
        const text = exportSheetAsShowdown(pokemon.get(sheetId) || []);
        await navigator.clipboard.writeText(text);
        toast('Showdown-Text kopiert', 'success');
      } catch (err) { toast('Kopieren fehlgeschlagen: ' + err.message, 'error'); }
    };
    window.copyHubPublicTeamLink = async sheetId => {
      const url = `${location.origin}${location.pathname}#/public-team/${sheetId}`;
      try {
        await navigator.clipboard.writeText(url);
        toast('Öffentlicher Teamlink kopiert', 'success');
      } catch {
        toast('Link konnte nicht kopiert werden.', 'error');
      }
    };
    window.exportHubTeamJson = async sheetId => {
      const target = all.find(item => item.id === sheetId);
      if (!target) return;
      try { await exportTeamSheet(target); toast('Team als JSON exportiert', 'success'); }
      catch (err) { toast('Export fehlgeschlagen: ' + err.message, 'error'); }
    };
    window.importHubTeamJson = async (sheetId, input) => {
      const file = input?.files?.[0];
      if (!file) return;
      try {
        await importTeamSheetFile(file, sheetId);
        toast('Team aus JSON übernommen', 'success');
        await refreshOpenTeam(sheetId, false);
      } catch (err) {
        toast('JSON-Import fehlgeschlagen: ' + err.message, 'error');
        input.value = '';
      }
    };
    window.duplicateHubTeam = async sheetId => {
      try { await duplicatePersonalSheet(sheetId); toast('Team dupliziert', 'success'); await renderTeamsPage(root); }
      catch (err) { toast('Duplizieren fehlgeschlagen: ' + err.message, 'error'); }
    };
    window.renameHubTeam = async id => { const sheet = mine.find(s => s.id === id); const title = prompt('Teamname', sheet?.title || 'Team'); if (title === null) return; await updateSheet(id, { title: title.trim() || 'Team' }); toast('Team umbenannt', 'success'); await renderTeamsPage(root); };
    window.setHubTeamRuleset = async (id, rulesetId) => {
      try {
        await updateSheet(id, { ruleset_id: rulesetId || null });
        toast(rulesetId ? 'Regelset zugeordnet' : 'Regelset entfernt', 'success');
        await refreshOpenTeam(id, false);
      } catch (err) {
        const migrationHint = /ruleset_id|schema cache|column/i.test(err.message || '') ? ' Bitte zuerst SUPABASE_TEAM_RULESET_CONTEXT.sql in Supabase ausführen.' : '';
        toast('Regelset konnte nicht gespeichert werden.' + migrationHint, 'error');
      }
    };
    window.toggleHubTeamVisibility = async (id, visibility) => { await updateSheet(id, { visibility: visibility === 'public' ? 'private' : 'public' }); toast('Sichtbarkeit aktualisiert', 'success'); await renderTeamsPage(root); };
    window.deleteHubTeam = async id => { if (!confirm('Team wirklich löschen?')) return; await deleteSheet(id); toast('Team gelöscht', 'success'); await renderTeamsPage(root); };
    window.importHubTeam = async id => { const text = document.getElementById('hub-team-paste')?.value || ''; try { await importShowdownIntoSheet(id, text); toast('Team übernommen', 'success'); await renderTeamsPage(root); } catch (err) { toast('Fehler: ' + err.message, 'error'); } };
  } catch (err) {
    root.innerHTML = pageHeader('Teams', 'Eigene Teams bearbeiten und geteilte Teams ansehen.') + hubLoadError('Teams');
    console.error('[hub] Teams konnten nicht geladen werden:', err);
  }
}

export async function renderTemplatesPage(root) {
  root.innerHTML = pageHeader('Vorlagen & Pools', 'Verfügbare Rulesets und Pokémon-Pools für deine Turniere.') + '<div class="hub-loading">Vorlagen werden geladen…</div>';
  try {
    const [rulesets, pools] = await Promise.all([listPublicRulesetTemplates(), listPublicPoolTemplates()]);
    const poolCounts = new Map(await Promise.all(pools.map(async pool => [pool.id, (await listPoolPokemon(pool.id)).length])));
    root.innerHTML = `${pageHeader('Vorlagen & Pools', 'Verfügbare Rulesets und Pokémon-Pools für deine Turniere.')}
      <div class="hub-template-columns"><section class="hub-section"><div class="hub-section-title"><h2>Ruleset-Vorlagen</h2><span>${rulesets.length}</span></div><div class="hub-template-list">${rulesets.length ? rulesets.map(r => `<article class="hub-template-card"><div class="hub-card-icon purple">R</div><div><h3>${esc(r.name)}</h3><p>${esc(r.format)} · ${esc(r.draft_mode)} · Teamgröße ${r.team_size}</p></div><button class="btn btn-secondary btn-sm" onclick="window.openTournamentArea('rules')">Im Turnier öffnen</button></article>`).join('') : '<div class="hub-empty">Keine Ruleset-Vorlagen vorhanden.</div>'}</div></section>
      <section class="hub-section"><div class="hub-section-title"><h2>Pool-Vorlagen</h2><span>${pools.length}</span></div><div class="hub-template-list">${pools.length ? pools.map(p => `<article class="hub-template-card"><div class="hub-card-icon gold">P</div><div><h3>${esc(p.name)}</h3><p>${poolCounts.get(p.id) || 0} Pokémon · ${esc(p.description || 'Keine Beschreibung')}</p></div><button class="btn btn-secondary btn-sm" onclick="window.openTournamentArea('pool')">Im Turnier öffnen</button></article>`).join('') : '<div class="hub-empty">Keine Pool-Vorlagen vorhanden.</div>'}</div></section></div>`;
  } catch (err) {
    root.innerHTML = pageHeader('Vorlagen & Pools', 'Verfügbare Rulesets und Pokémon-Pools für deine Turniere.') + hubLoadError('Vorlagen und Pools');
    console.error('[hub] Vorlagen konnten nicht geladen werden:', err);
  }
}

export async function renderChampionsPage(root) {
  root.innerHTML = pageHeader('Champions', 'Teams für Pokémon Champions bauen, prüfen und teilen.', '<button class="btn btn-primary" onclick="window.createChampionsTeam()">+ Champions-Team</button>') + '<div class="hub-loading">Champions-Teams werden geladen…</div>';
  try {
    const [mine, shared, profiles] = await Promise.all([
      listPersonalSheetsByMode('champions'),
      listPublicSheetsByMode('champions'),
      listVisibleProfiles().catch(() => []),
    ]);
    const names = new Map();
    profiles.forEach(p => { if (p.id) names.set(p.id, p.display_name); if (p.user_id) names.set(p.user_id, p.display_name); });
    const ownIds = new Set(mine.map(sheet => sheet.id));
    const sharedFromOthers = shared.filter(sheet => !ownIds.has(sheet.id));
    const all = [...mine, ...sharedFromOthers];
    const pokemonResults = await Promise.allSettled(all.map(async sheet => [sheet.id, await listPokemonForSheet(sheet.id)]));
    const pokemon = new Map();
    pokemonResults.forEach(result => { if (result.status === 'fulfilled') pokemon.set(result.value[0], result.value[1]); });
    root.innerHTML = `${pageHeader('Champions', 'Teams für Pokémon Champions bauen, prüfen und teilen.', '<button class="btn btn-primary" onclick="window.createChampionsTeam()">+ Champions-Team</button>')}
      <section class="hub-section champions-intro">
        <div class="hub-section-title"><div><h2>Champions Builder</h2><p>Level 50, Singles/Doubles-Info, Mega-Formen und 0–32 Champions-Verteilung. Stats und Speed Order öffnest du im Builder.</p></div></div>
      </section>
      <section class="hub-section"><div class="hub-section-title"><div><h2>Meine Champions-Teams</h2><p>Eigene Teams bauen und teilen</p></div><span>${mine.length}</span></div><div class="hub-team-grid own-teams">${mine.length ? mine.map(s => teamCard(s, pokemon.get(s.id) || [])).join('') : '<div class="hub-empty"><strong>Noch kein Champions-Team</strong><span>Lege ein Team an und öffne es direkt im Builder.</span><button class="btn btn-primary btn-sm" onclick="window.createChampionsTeam()">Champions-Team anlegen</button></div>'}</div></section>
      <section class="hub-section"><div class="hub-section-title"><div><h2>Geteilte Champions-Teams</h2><p>Öffentliche Champions-Teams anderer Trainer</p></div><span>${sharedFromOthers.length}</span></div><div class="hub-team-grid shared-teams">${sharedFromOthers.length ? sharedFromOthers.map(s => teamCard(s, pokemon.get(s.id) || [], names.get(s.profile_id), true)).join('') : '<div class="hub-empty">Noch keine geteilten Champions-Teams vorhanden.</div>'}</div><section id="hub-shared-team-detail" class="hub-team-detail"></section></section>`;
    window.createChampionsTeam = async () => {
      const title = prompt('Teamname', 'Champions Team');
      if (title === null) return;
      try {
        const sheet = await createPersonalSheet(title.trim() || 'Champions Team', { team_mode: 'champions', battle_format: 'singles', rules_profile: 'champions' });
        toast('Champions-Team angelegt', 'success');
        location.hash = `/builder/${sheet.id}`;
      } catch (err) {
        const hint = /team_mode|battle_format|rules_profile|schema cache|column|null value|row-level security/i.test(err.message || '')
          ? ' Bitte zuerst SUPABASE_CHAMPIONS_TEAM_BUILDER_SETUP.sql in Supabase ausführen.'
          : '';
        toast('Champions-Team konnte nicht angelegt werden.' + hint, 'error');
      }
    };
  } catch (err) {
    root.innerHTML = pageHeader('Champions', 'Teams für Pokémon Champions bauen, prüfen und teilen.') + hubLoadError('Champions-Teams');
    console.error('[hub] Champions konnten nicht geladen werden:', err);
  }
}
