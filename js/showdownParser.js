// ─── SHOWDOWN IMPORT/EXPORT PARSER ─────────────────────────────────
// 1:1 Logik aus dem ursprünglichen app.js übernommen, nur modularisiert.

export function parsePokemonHeader(line) {
  let raw = String(line || '').trim();
  let item = '';
  const itemMatch = raw.match(/\s@\s(.+)$/);
  if (itemMatch) {
    item = itemMatch[1].trim();
    raw = raw.slice(0, itemMatch.index).trim();
  }

  // Showdown erlaubt Nicknames: "Surfer (Raichu-Alola) @ Life Orb".
  const parens = [...raw.matchAll(/\(([^()]+)\)/g)].map(m => m[1].trim());
  const speciesInParens = [...parens].reverse().find(x => !/^(M|F)$/i.test(x));
  if (speciesInParens) {
    const nickname = raw.replace(/\s*\([^()]+\)\s*$/g, '').replace(/\s*\([MF]\)\s*$/i, '').trim();
    return { name: speciesInParens, nickname: nickname && nickname !== speciesInParens ? nickname : '', item };
  }

  const name = raw.replace(/\s*\([MF]\)\s*$/i, '').trim();
  return { name, nickname: '', item };
}

export function parseShowdown(text) {
  const mons = [];
  const blocks = text.trim().split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    const mon = { name: '', nickname: '', item: '', ability: '', tera: '', nature: '', evs: { HP: 0, Atk: 0, Def: 0, SpA: 0, SpD: 0, Spe: 0 }, ivs: {}, moves: [] };
    const header = parsePokemonHeader(lines[0]);
    mon.name = header.name;
    mon.nickname = header.nickname;
    mon.item = header.item;
    for (let i = 1; i < lines.length; i++) {
      const l = lines[i];
      if (l.startsWith('Ability:')) mon.ability = l.replace('Ability:', '').trim();
      else if (l.startsWith('Tera Type:')) mon.tera = l.replace('Tera Type:', '').trim();
      else if (l.includes('Nature')) mon.nature = l.replace('Nature', '').trim();
      else if (l.startsWith('EVs:')) {
        l.replace('EVs:', '').trim().split('/').forEach(p => {
          const m = p.trim().match(/(\d+)\s+(\w+)/);
          if (m) mon.evs[m[2]] = parseInt(m[1]);
        });
      } else if (l.startsWith('IVs:')) {
        l.replace('IVs:', '').trim().split('/').forEach(p => {
          const m = p.trim().match(/(\d+)\s+(\w+)/);
          if (m) mon.ivs[m[2]] = parseInt(m[1]);
        });
      } else if (l.startsWith('- ')) mon.moves.push(l.slice(2).trim());
    }
    if (mon.name) mons.push(mon);
  }
  return mons;
}

// ─── EXPORT: aus unserem internen pokemon_sets-Format wieder Showdown-Text bauen ───
export function exportShowdown(pokemonList) {
  return pokemonList.map(p => {
    const header = p.nickname ? `${p.nickname} (${p.pokemon_name || p.name})` : (p.pokemon_name || p.name);
    const lines = [];
    lines.push(header + (p.item ? ` @ ${p.item}` : ''));
    if (p.ability) lines.push(`Ability: ${p.ability}`);
    if (p.tera_type || p.tera) lines.push(`Tera Type: ${p.tera_type || p.tera}`);
    const evs = p.evs || {};
    const evParts = Object.entries(evs).filter(([, v]) => v).map(([k, v]) => `${v} ${k}`);
    if (evParts.length) lines.push(`EVs: ${evParts.join(' / ')}`);
    if (p.nature) lines.push(`${p.nature} Nature`);
    (p.moves || []).forEach(m => lines.push(`- ${m}`));
    return lines.join('\n');
  }).join('\n\n');
}
