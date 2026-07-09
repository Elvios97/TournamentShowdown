import { esc } from '../../utils.js';
import { getSheet, listPokemonForSheet } from '../teams/teamSheets.js?v=20260705b';
import { renderPokemonGrid, renderTeamBall } from '../openSheets/openSheets.js?v=20260705b';

function appEntryUrl() {
  return `${location.origin}${location.pathname}?app=1#/teams`;
}

function unavailableView() {
  return `<section class="public-team-state" role="status">
    <span class="public-team-state-icon" aria-hidden="true">?</span>
    <h1>Team nicht verfügbar</h1>
    <p>Der Link ist ungültig, das Team ist privat oder wurde entfernt.</p>
    <a class="btn btn-primary" href="${esc(appEntryUrl())}">Zur Anmeldung</a>
  </section>`;
}

export async function renderPublicTeamPage(root, sheetId) {
  root.innerHTML = '<section class="public-team-state"><div class="hub-loading">Öffentliches Team wird geladen…</div></section>';
  try {
    const sheet = await getSheet(sheetId);
    if (!sheet || sheet.visibility !== 'public' || sheet.tournament_id !== null) {
      root.innerHTML = unavailableView();
      return;
    }
    const pokemon = await listPokemonForSheet(sheet.id);
    root.innerHTML = `<div class="public-team-page">
      <header class="public-team-header">
        <a class="public-team-brand" href="${esc(appEntryUrl())}" aria-label="Zur Anmeldung"><span class="brand-mark" aria-hidden="true"><span></span></span><strong>OTS DraftHub</strong></a>
        <a class="btn btn-secondary" href="${esc(appEntryUrl())}">Anmelden</a>
      </header>
      <main class="public-team-content">
        <section class="public-team-hero">
          <div class="public-team-title">${renderTeamBall(sheet.ball_variant, 'public-team-ball')}<div><span class="public-team-eyebrow">Geteiltes Team · Nur-Lese-Ansicht</span><h1>${esc(sheet.title || 'Team')}</h1><p>${pokemon.length} Pokémon im Team</p></div></div>
          <span class="badge badge-success">Öffentlich</span>
        </section>
        <section class="public-team-roster" aria-labelledby="public-team-roster-title">
          <div class="public-team-section-title"><div><span>Teamübersicht</span><h2 id="public-team-roster-title">Pokémon und Sets</h2></div><strong>${pokemon.length}</strong></div>
          ${renderPokemonGrid(pokemon)}
        </section>
        <p class="public-team-disclaimer">Unofficial fan-made tool. Not affiliated with Nintendo, Game Freak, Creatures Inc., or The Pokémon Company.</p>
      </main>
    </div>`;
  } catch {
    root.innerHTML = unavailableView();
  }
}
