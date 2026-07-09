// ─── FEATURE: OPEN TEAM SHEETS (Anzeige) ────────────────────────────
// Render-Logik 1:1 aus dem ursprünglichen renderPokemonCard()/Matchup
// übernommen, nur an das neue pokemon_sets-Datenmodell angepasst
// (item/ability/tera_type/nature/evs/moves kommen jetzt aus der DB
// statt aus lokalem State).

import { esc } from '../../utils.js';
import { spriteAttrs, getTypes, getMoveType, STAT_COLORS } from '../../sprites.js';

export const TEAM_BALL_VARIANTS = [
  { value: 'poke', label: 'Poke Ball', className: 'poke-ball-icon' },
  { value: 'great', label: 'Superball', className: 'great-ball-icon' },
  { value: 'ultra', label: 'Hyperball', className: 'ultra-ball-icon' },
  { value: 'premier', label: 'Premierball', className: 'premier-ball-icon' },
  { value: 'luxury', label: 'Luxusball', className: 'luxury-ball-icon' },
  { value: 'dive', label: 'Tauchball', className: 'dive-ball-icon' },
  { value: 'heal', label: 'Heilball', className: 'heal-ball-icon' },
  { value: 'dusk', label: 'Finsterball', className: 'dusk-ball-icon' },
];

const TEAM_BALL_BY_VALUE = new Map(TEAM_BALL_VARIANTS.map(v => [v.value, v]));

export function normalizeTeamBall(value) {
  return TEAM_BALL_BY_VALUE.has(value) ? value : 'poke';
}

export function teamBallClass(value) {
  return TEAM_BALL_BY_VALUE.get(normalizeTeamBall(value)).className;
}

export function renderTeamBall(value, extraClass = '') {
  return `<div class="profile-avatar pokemon-card-icon team-icon ${teamBallClass(value)} ${extraClass}" aria-hidden="true"></div>`;
}

export function renderTeamBallSelect(value, onchange) {
  const active = normalizeTeamBall(value);
  return `<select class="form-select team-ball-select" style="width:auto;min-width:150px" onchange="${onchange}">
    ${TEAM_BALL_VARIANTS.map(v => `<option value="${v.value}" ${v.value === active ? 'selected' : ''}>${v.label}</option>`).join('')}
  </select>`;
}

export function renderPokemonCard(p, { editable = false, index = -1, total = 0, reorderable = false } = {}) {
  const name = p.pokemon_name || p.name;
  const types = getTypes(name);
  const typeBadges = types.map(t => `<span class="type-chip type-${t.toLowerCase()}">${t}</span>`).join('');
  const moves = (p.moves || []).map(m => `<div class="move-item"><span class="move-dot" style="background:var(--move-${getMoveType(m)},var(--text-muted))"></span>${esc(m)}</div>`).join('');
  const evs = p.evs || {};
  const evBars = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe'].map(s => {
    const v = evs[s] || 0, pct = Math.round(v / 252 * 100), c = STAT_COLORS[s] || '#64748b';
    return `<div class="ev-bar-row ${v ? 'has-value' : 'is-zero'}"><span class="ev-stat-name">${s}</span><div class="ev-bar-bg"><div class="ev-bar-fill" style="width:${pct}%;background:${c}"></div></div><span class="ev-stat-val">${v}</span></div>`;
  }).join('');
  const tera = p.tera_type ? `<div class="tera-row">Tera: <span class="tera-name">${esc(p.tera_type)}</span></div>` : '';
  const nickname = p.nickname ? `<div class="pokemon-nickname">"${esc(p.nickname)}"</div>` : '';
  const editAttrs = editable && p.id
    ? ` role="button" tabindex="0" aria-label="${esc(name)} bearbeiten" onclick="window.openHubPokemonEditor('${p.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.openHubPokemonEditor('${p.id}')}"`
    : '';
  return `<div class="pokemon-card ${editable ? 'is-editable' : ''}" data-set-id="${p.id || ''}"${editAttrs}>
    ${editable ? '<span class="pokemon-edit-hint">Bearbeiten</span>' : ''}
    ${reorderable ? `<div class="pokemon-order-actions" aria-label="Position von ${esc(name)} ändern"><button type="button" title="Nach links" aria-label="${esc(name)} nach links verschieben" onclick="event.stopPropagation();window.moveHubPokemon('${p.id}',-1)" ${index <= 0 ? 'disabled' : ''}>←</button><span>${index + 1}</span><button type="button" title="Nach rechts" aria-label="${esc(name)} nach rechts verschieben" onclick="event.stopPropagation();window.moveHubPokemon('${p.id}',1)" ${index >= total - 1 ? 'disabled' : ''}>→</button></div>` : ''}
    <div class="pokemon-card-inner">
      <div class="pokemon-sprite-col"><img ${spriteAttrs(name)} alt="${esc(name)}" /></div>
      <div class="pokemon-info-col">
        ${nickname}
        <div class="pokemon-name-row"><span class="pokemon-name">${esc(name)}</span><div class="pokemon-types">${typeBadges}</div></div>
        <div class="item-row">🎒 <span class="item-name">${esc(p.item || '—')}</span></div>
        <div class="ability-row">✨ <span class="ability-name">${esc(p.ability || '—')}</span></div>
        ${tera}
        <div class="moves-list">${moves}</div>
      </div>
    </div>
    <div class="ev-section"><div class="ev-label-row"><span class="ev-label">EV Verteilung</span><span class="ev-nature">Natur: <span>${esc(p.nature || '—')}</span></span></div><div class="ev-bars">${evBars}</div></div>
  </div>`;
}

export function renderPokemonGrid(pokemonList, options = {}) {
  if (!pokemonList.length) return '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">Noch keine Pokémon im Sheet</div></div>';
  return `<div class="pokemon-grid">${pokemonList.map((p, index) => renderPokemonCard(p, { ...options, index, total: pokemonList.length })).join('')}</div>`;
}

export function renderSheetCard(sheet, pokemonCount, memberName) {
  const lockBadge = sheet.is_locked ? '<span class="type-chip" style="background:var(--surface3);color:var(--text-muted)">🔒 gesperrt</span>' : '';
  const visBadge = { private: '🔒 privat', tournament: '👥 Turnier', public: '🌐 öffentlich' }[sheet.visibility] || '';
  return `<div class="team-list-item" onclick="window.openSheetDetail('${sheet.id}')">
    ${renderTeamBall(sheet.ball_variant, 'team-list-ball')}
    <div style="flex:1">
      <div class="team-list-name">${esc(sheet.title || 'Team')} ${lockBadge}</div>
      <div class="team-list-meta">${esc(memberName || '')} · ${pokemonCount} Pokémon · ${visBadge}</div>
    </div>
  </div>`;
}

export function renderMatchupSide(label, title, pokemonList) {
  const rows = pokemonList.map(p => `<div class="matchup-pokemon-row">
    <img class="matchup-sprite" ${spriteAttrs(p.pokemon_name)} alt="${esc(p.pokemon_name)}" />
    <div class="matchup-poke-info">
      <div class="matchup-poke-name">${esc(p.pokemon_name)}</div>
      <div class="matchup-poke-meta"><span class="matchup-poke-item">${esc(p.item || '')}</span> · ${esc(p.ability || '')}</div>
      <div class="matchup-moves-mini">${(p.moves || []).map(m => `<span class="move-mini">${esc(m)}</span>`).join('')}</div>
    </div>
  </div>`).join('');
  return `<div class="matchup-side ${label}"><div class="matchup-side-title">${esc(title)}</div>${rows}</div>`;
}
