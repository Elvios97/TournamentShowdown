const EV_KEYS = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe'];

function issue(level, code, message, fix, pokemonId = null) {
  return { level, code, message, fix, pokemonId };
}

export function validateTeam(pokemonList = [], ruleset = null) {
  const issues = [];
  const expectedSize = Number(ruleset?.team_size) || 6;
  const isChampions = ruleset?.team_mode === 'champions';
  const legalPokemonIds = ruleset?.legalPokemonIds instanceof Set ? ruleset.legalPokemonIds : null;

  if (!ruleset) issues.push(issue('warning', 'ruleset_missing', 'Für dieses Team ist kein Regelset ausgewählt.', 'Wähle oberhalb des Teams ein passendes Regelset aus.'));
  if (!pokemonList.length) issues.push(issue('error', 'team_empty', 'Das Team enthält noch keine Pokémon.', 'Füge mindestens ein Pokémon aus dem Katalog oder per Import hinzu.'));
  else if (pokemonList.length < expectedSize) issues.push(issue('warning', 'team_small', `${pokemonList.length} von ${expectedSize} Teamplätzen sind belegt.`, `Füge noch ${expectedSize - pokemonList.length} Pokémon hinzu.`));
  else if (pokemonList.length > expectedSize) issues.push(issue('error', 'team_large', `${pokemonList.length} Pokémon überschreiten die erlaubte Teamgröße von ${expectedSize}.`, `Entferne ${pokemonList.length - expectedSize} Pokémon.`));

  const pokemonCounts = new Map();
  pokemonList.forEach(mon => {
    const key = String(mon.pokemon_id || mon.pokemon_name || '').trim().toLocaleLowerCase('de-DE');
    if (key) pokemonCounts.set(key, (pokemonCounts.get(key) || 0) + 1);
  });
  if (ruleset && !ruleset.allow_duplicates) {
    [...pokemonCounts.entries()].filter(([, count]) => count > 1).forEach(([pokemonId]) => {
      const mon = pokemonList.find(item => String(item.pokemon_id || item.pokemon_name || '').trim().toLocaleLowerCase('de-DE') === pokemonId);
      issues.push(issue('error', 'pokemon_duplicate', `${mon?.pokemon_name || pokemonId} ist mehrfach enthalten.`, 'Entferne das doppelte Pokémon oder wähle ein anderes.', mon?.id));
    });
  }

  pokemonList.forEach(mon => {
    const name = mon.pokemon_name || 'Pokémon';
    if (!String(mon.pokemon_id || '').trim() || !String(mon.pokemon_name || '').trim()) issues.push(issue('error', 'pokemon_identity_missing', 'Ein Pokémon-Eintrag ist unvollständig.', 'Entferne den Eintrag und füge das Pokémon erneut aus dem Katalog hinzu.', mon.id));
    if (!String(mon.item || '').trim()) issues.push(issue('warning', 'item_missing', `${name}: Item fehlt.`, 'Trage im Set-Editor ein Item ein.', mon.id));
    if (!String(mon.ability || '').trim()) issues.push(issue('warning', 'ability_missing', `${name}: Fähigkeit fehlt.`, 'Wähle im Set-Editor eine Fähigkeit aus.', mon.id));
    if (!String(mon.nature || '').trim()) issues.push(issue('warning', 'nature_missing', `${name}: Wesen fehlt.`, 'Trage im Set-Editor ein Wesen ein.', mon.id));

    const rawMoves = Array.isArray(mon.moves) ? mon.moves : [];
    const moves = rawMoves.map(move => String(move).trim()).filter(Boolean);
    if (moves.length < 4) issues.push(issue('warning', 'moves_missing', `${name}: ${moves.length} von 4 Moves sind eingetragen.`, `Ergänze noch ${4 - moves.length} Move${moves.length === 3 ? '' : 's'}.`, mon.id));
    if (moves.length > 4) issues.push(issue('error', 'moves_large', `${name}: Mehr als vier Moves sind eingetragen.`, 'Entferne überzählige Moves.', mon.id));
    const normalizedMoves = moves.map(move => move.toLocaleLowerCase('de-DE'));
    if (new Set(normalizedMoves).size !== normalizedMoves.length) issues.push(issue('error', 'moves_duplicate', `${name}: Ein Move ist doppelt eingetragen.`, 'Ersetze einen der doppelten Moves.', mon.id));

    if (isChampions) {
      if (legalPokemonIds?.size && !legalPokemonIds.has(mon.pokemon_id)) {
        issues.push(issue('warning', 'champions_pokemon_illegal', `${name}: nicht in Pokemon Champions freigegeben.`, 'Waehle ein Champions-legales Pokemon oder stelle das Team auf Standard.', mon.id));
      }
      const dvs = mon.dvs || {};
      let invalidDv = false;
      EV_KEYS.forEach(key => {
        const value = Number(dvs[key] || 0);
        if (!Number.isInteger(value) || value < 0 || value > 32) invalidDv = true;
      });
      if (invalidDv) issues.push(issue('error', 'champions_dv_invalid', `${name}: Champions-Werte müssen zwischen 0 und 32 liegen.`, 'Korrigiere die Champions-Verteilung im Builder.', mon.id));
      return;
    }

    const evs = mon.evs || {};
    let total = 0;
    let invalid = false;
    EV_KEYS.forEach(key => {
      const value = Number(evs[key] || 0);
      if (!Number.isInteger(value) || value < 0 || value > 252) invalid = true;
      total += Number.isFinite(value) ? value : 0;
    });
    if (invalid) issues.push(issue('error', 'ev_invalid', `${name}: Mindestens ein EV-Wert liegt nicht zwischen 0 und 252.`, 'Korrigiere die markierten EV-Werte im Set-Editor.', mon.id));
    if (total > 510) issues.push(issue('error', 'ev_total', `${name}: ${total} von maximal 510 EV sind verteilt.`, `Entferne mindestens ${total - 510} EV.`, mon.id));
    else if (total === 0) issues.push(issue('warning', 'ev_empty', `${name}: Es sind noch keine EV verteilt.`, 'Verteile die EV im Set-Editor, falls das Format sie verwendet.', mon.id));
  });

  const errors = issues.filter(item => item.level === 'error').length;
  const warnings = issues.filter(item => item.level === 'warning').length;
  return { status: errors ? 'error' : warnings ? 'warning' : 'complete', errors, warnings, issues };
}
