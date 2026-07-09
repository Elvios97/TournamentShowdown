const STATS = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe'];
export const MAX_TEAM_IMPORT_BYTES = 1_000_000;

export function normalizeImportedTeam(pokemon, maxSize = 100) {
  if (!Array.isArray(pokemon) || !pokemon.length) throw new Error('Das importierte Team enthält keine Pokémon.');
  if (pokemon.length > maxSize) throw new Error(`Das importierte Team darf höchstens ${maxSize} Pokémon enthalten.`);
  return pokemon.map((entry, index) => {
    const pokemonName = String(entry?.pokemon_name || entry?.name || '').trim();
    const pokemonId = String(entry?.pokemon_id || pokemonName).trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!pokemonId || !pokemonName) throw new Error(`Pokémon ${index + 1}: ID oder Name fehlt.`);
    if (pokemonName.length > 100 || pokemonId.length > 100) throw new Error(`Pokémon ${index + 1}: ID oder Name ist zu lang.`);
    if (entry.moves != null && !Array.isArray(entry.moves)) throw new Error(`${pokemonName}: Moves müssen eine Liste sein.`);
    const moves = (entry.moves || []).map(move => String(move).trim());
    if (moves.length > 4) throw new Error(`${pokemonName}: Maximal vier Moves erlaubt.`);
    if (moves.some(move => !move || move.length > 100)) throw new Error(`${pokemonName}: Ein Move ist leer oder länger als 100 Zeichen.`);
    if (entry.evs != null && (typeof entry.evs !== 'object' || Array.isArray(entry.evs))) throw new Error(`${pokemonName}: EVs müssen ein Objekt sein.`);
    const unknownStats = Object.keys(entry.evs || {}).filter(stat => !STATS.includes(stat));
    if (unknownStats.length) throw new Error(`${pokemonName}: Unbekannter EV-Wert ${unknownStats[0]}.`);
    const evs = {};
    let total = 0;
    for (const stat of STATS) {
      const value = Number(entry.evs?.[stat] || 0);
      if (!Number.isInteger(value) || value < 0 || value > 252) throw new Error(`${pokemonName}: ${stat}-EV muss zwischen 0 und 252 liegen.`);
      evs[stat] = value;
      total += value;
    }
    if (total > 510) throw new Error(`${pokemonName}: EV-Summe ${total}/510 ist zu hoch.`);
    return {
      pokemon_id: pokemonId, pokemon_name: pokemonName,
      nickname: String(entry.nickname || '').trim().slice(0, 100) || null,
      item: String(entry.item || '').trim().slice(0, 100) || null,
      ability: String(entry.ability || '').trim().slice(0, 100) || null,
      tera_type: String(entry.tera_type || entry.tera || '').trim().slice(0, 30) || null,
      nature: String(entry.nature || '').trim().slice(0, 50) || null,
      evs, moves: moves.map(move => move.slice(0, 100)),
      notes: String(entry.notes || '').slice(0, 2000),
    };
  });
}

export function assertImportFileSize(file) {
  if (!file) throw new Error('Keine Datei ausgewählt.');
  if (file.size > MAX_TEAM_IMPORT_BYTES) throw new Error('Die Importdatei ist größer als 1 MB.');
}
