// ─── SPRITES / TYPES ────────────────────────────────────────────────
// 1:1 Logik aus dem ursprünglichen app.js übernommen (inkl. aller Aliase),
// nur modularisiert. Bitte SPRITE_ALIASES weiter hier ergänzen, falls ein
// Sprite falsch/als Platzhalter angezeigt wird.

import { esc, initials } from './utils.js';

export const STAT_COLORS = { HP: '#4ade80', Atk: '#f87171', Def: '#fb923c', SpA: '#38bdf8', SpD: '#a78bfa', Spe: '#facc15' };

export const POKEMON_TYPES = {
  'tapu-koko': ['electric', 'fairy'], 'raichu-alola': ['electric', 'psychic'], 'raichu': ['electric'],
  'iron-hands': ['fighting', 'electric'], 'rotom-wash': ['electric', 'water'], 'rotom': ['electric'],
  'toxtricity': ['electric', 'poison'], 'pincurchin': ['electric'], 'pikachu': ['electric'],
  'magnezone': ['electric', 'steel'], 'jolteon': ['electric'], 'manectric': ['electric'],
  'luxray': ['electric'], 'garchomp': ['dragon', 'ground'], 'dragonite': ['dragon', 'flying'],
  'flutter-mane': ['ghost', 'fairy'], 'iron-bundle': ['ice', 'water'],
  'urshifu': ['fighting', 'dark'], 'urshifu-rapid-strike': ['fighting', 'water'],
  'incineroar': ['fire', 'dark'], 'landorus-therian': ['ground', 'flying'], 'landorus': ['ground', 'flying'],
  'tornadus': ['flying'], 'thundurus': ['electric', 'flying'], 'amoonguss': ['grass', 'poison'],
  'primarina': ['water', 'fairy'], 'calyrex-shadow': ['psychic', 'ghost'], 'calyrex-ice': ['psychic', 'ice'],
  'zacian': ['fairy'], 'zamazenta': ['fighting'], 'kyogre': ['water'], 'groudon': ['ground'],
  'rayquaza': ['dragon', 'flying'], 'palkia': ['water', 'dragon'], 'dialga': ['steel', 'dragon'],
  'giratina': ['ghost', 'dragon'], 'lunala': ['psychic', 'ghost'], 'solgaleo': ['psychic', 'steel'],
  'necrozma-dusk-mane': ['psychic', 'steel'], 'miraidon': ['electric', 'dragon'], 'koraidon': ['fighting', 'dragon'],
  'chien-pao': ['dark', 'ice'], 'chi-yu': ['dark', 'fire'], 'wo-chien': ['dark', 'grass'],
  'ting-lu': ['dark', 'ground'], 'annihilape': ['fighting', 'ghost'], 'clodsire': ['poison', 'ground'],
  'gholdengo': ['steel', 'ghost'], 'great-tusk': ['ground', 'fighting'], 'iron-valiant': ['fairy', 'fighting'],
  'roaring-moon': ['dragon', 'dark'], 'ogerpon': ['grass'], 'ogerpon-hearthflame': ['grass', 'fire'],
  'farigiraf': ['normal', 'psychic'], 'dondozo': ['water'], 'tatsugiri': ['dragon', 'water'],
  'kingambit': ['dark', 'steel'], 'iron-moth': ['fire', 'poison'], 'iron-thorns': ['rock', 'electric'],
  'sandy-shocks': ['electric', 'ground'],
};

export const MOVE_TYPE_MAP = {
  'thunderbolt': 'electric', 'thunder': 'electric', 'volt switch': 'electric', 'wild charge': 'electric',
  'discharge': 'electric', 'dazzling gleam': 'fairy', 'play rough': 'fairy', 'moonblast': 'fairy',
  'psychic': 'psychic', 'psyshock': 'psychic', 'fake out': 'normal', 'boomburst': 'normal',
  'protect': 'normal', 'recover': 'normal', 'spikes': 'ground', 'hydro pump': 'water', 'surf': 'water',
  'will-o-wisp': 'fire', 'flamethrower': 'fire', 'ice punch': 'ice', 'ice beam': 'ice',
  'sludge bomb': 'poison', 'overdrive': 'electric', 'drain punch': 'fighting',
  'close combat': 'fighting', 'superpower': 'fighting', 'earthquake': 'ground',
};

export const SPRITE_ALIASES = {
  'raichu-alola': ['raichu-alola', 'raichu-alolan', 'raichu'],
  'vulpix-alola': ['vulpix-alola', 'vulpix-alolan', 'vulpix'],
  'ninetales-alola': ['ninetales-alola', 'ninetales-alolan', 'ninetales'],
  'sandshrew-alola': ['sandshrew-alola', 'sandshrew-alolan', 'sandshrew'],
  'sandslash-alola': ['sandslash-alola', 'sandslash-alolan', 'sandslash'],
  'diglett-alola': ['diglett-alola', 'diglett-alolan', 'diglett'],
  'dugtrio-alola': ['dugtrio-alola', 'dugtrio-alolan', 'dugtrio'],
  'meowth-alola': ['meowth-alola', 'meowth-alolan', 'meowth'],
  'persian-alola': ['persian-alola', 'persian-alolan', 'persian'],
  'geodude-alola': ['geodude-alola', 'geodude-alolan', 'geodude'],
  'graveler-alola': ['graveler-alola', 'graveler-alolan', 'graveler'],
  'golem-alola': ['golem-alola', 'golem-alolan', 'golem'],
  'grimer-alola': ['grimer-alola', 'grimer-alolan', 'grimer'],
  'muk-alola': ['muk-alola', 'muk-alolan', 'muk'],
  'exeggutor-alola': ['exeggutor-alola', 'exeggutor-alolan', 'exeggutor'],
  'marowak-alola': ['marowak-alola', 'marowak-alolan', 'marowak'],
  'landorus-therian': ['landorus-therian', 'landorus'],
  'tornadus-therian': ['tornadus-therian', 'tornadus'],
  'thundurus-therian': ['thundurus-therian', 'thundurus'],
  'enamorus-therian': ['enamorus-therian', 'enamorus'],
  'urshifu-rapid-strike': ['urshifu-rapid-strike', 'urshifu'],
  'necrozma-dusk-mane': ['necrozma-dusk-mane', 'necrozma'],
  'necrozma-dawn-wings': ['necrozma-dawn-wings', 'necrozma'],
  'ogerpon-hearthflame': ['ogerpon-hearthflame', 'ogerpon'],
  'ogerpon-wellspring': ['ogerpon-wellspring', 'ogerpon'],
  'ogerpon-cornerstone': ['ogerpon-cornerstone', 'ogerpon'],
  'indeedee-f': ['indeedee-f', 'indeedee-female', 'indeedee'],
  'basculegion-f': ['basculegion-f', 'basculegion-female', 'basculegion'],
  'charizard-mega-x': ['charizard-megax', 'charizard-mega-x', 'charizard'],
  'charizard-mega-y': ['charizard-megay', 'charizard-mega-y', 'charizard'],
};

export function toPokemonId(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/♀/g, '-f').replace(/♂/g, '-m')
    .replace(/[’'.,:]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function getSpriteCandidates(name) {
  const id = toPokemonId(name);
  const ids = [...new Set(SPRITE_ALIASES[id] || [id])];
  const urls = [];
  ids.forEach(x => urls.push(`https://play.pokemonshowdown.com/sprites/dex/${x}.png`));
  ids.forEach(x => urls.push(`https://img.pokemondb.net/sprites/home/normal/${x}.png`));
  ids.forEach(x => urls.push(`https://play.pokemonshowdown.com/sprites/gen5/${x}.png`));
  return [...new Set(urls)];
}

export function missingSpriteSvg(name) {
  const label = encodeURIComponent(initials(name || '?'));
  return `data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' rx='18' fill='%231a2235'/%3E%3Cpath d='M26 62h44M31 36h34M36 48h24' stroke='%2364748b' stroke-width='5' stroke-linecap='round'/%3E%3Ctext x='48' y='83' text-anchor='middle' font-size='14' font-family='monospace' fill='%2394a3b8'%3E${label}%3C/text%3E%3C/svg%3E`;
}

export function spriteAttrs(name) {
  const candidates = getSpriteCandidates(name);
  return `src="${candidates[0]}" data-sprites="${btoa(JSON.stringify(candidates))}" data-sprite-index="0" data-pokemon-name="${esc(name)}" onerror="window.__nextSprite(this)"`;
}

export function nextSprite(img) {
  try {
    const list = JSON.parse(atob(img.dataset.sprites || 'W10='));
    const nextIndex = Number(img.dataset.spriteIndex || 0) + 1;
    if (nextIndex < list.length) {
      img.dataset.spriteIndex = String(nextIndex);
      img.src = list[nextIndex];
      return;
    }
  } catch { /* fällt durch zum Platzhalter */ }
  const name = img.dataset.pokemonName || img.alt || '?';
  img.onerror = null;
  img.classList.add('sprite-missing');
  img.src = missingSpriteSvg(name);
}

// Wird von inline onerror="" im HTML-String benötigt (kein Inline-<script type=module> Zugriff).
window.__nextSprite = nextSprite;

export function getSpriteUrl(name) {
  return getSpriteCandidates(name)[0];
}
export function getTypes(name) {
  const k = toPokemonId(name);
  return POKEMON_TYPES[k] || [];
}
export function getMoveType(m) {
  return MOVE_TYPE_MAP[String(m || '').toLowerCase()] || 'normal';
}
