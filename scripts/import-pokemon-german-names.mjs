const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

const POKEAPI_BASE = 'https://pokeapi.co/api/v2';
const USER_AGENT = 'OTS-DraftHub/1.0 german-name-import';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY muessen gesetzt sein.');
  console.error('Optional: mit --dry-run wird nur geladen und zusammengefasst, aber nichts geschrieben.');
  process.exit(1);
}

async function requestJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': USER_AGENT } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function patch(table, query, patchBody) {
  if (DRY_RUN) return null;
  return supabaseRequest(`${table}?${query}`, {
    method: 'PATCH',
    headers: { prefer: 'return=minimal' },
    body: JSON.stringify(patchBody),
  });
}

async function selectAll(table, query = '') {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const chunk = await supabaseRequest(`${table}?select=*&limit=1000&offset=${offset}${query ? `&${query}` : ''}`);
    rows.push(...(chunk || []));
    if (!chunk || chunk.length < 1000) break;
  }
  return rows;
}

async function mapConcurrent(values, concurrency, mapper) {
  const results = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await mapper(values[index], index);
      if ((index + 1) % 100 === 0) console.log(`Pokémon-Spezies geladen: ${index + 1}/${values.length}`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

function germanNameFromSpecies(species) {
  return species.names?.find(entry => entry.language?.name === 'de')?.name
    || species.names?.find(entry => entry.language?.name === 'de-Hrkt')?.name
    || null;
}

function formGermanName(form, speciesGermanName) {
  if (!speciesGermanName) return null;
  const id = String(form.pokemon_id || '');
  const formName = String(form.form_name || form.pokemon_name || '').toLowerCase();
  if (id.includes('-mega-x') || /\bmega\b.*\bx\b/i.test(formName)) return `Mega-${speciesGermanName} X`;
  if (id.includes('-mega-y') || /\bmega\b.*\by\b/i.test(formName)) return `Mega-${speciesGermanName} Y`;
  if (id.includes('-mega') || formName.includes('mega')) return `Mega-${speciesGermanName}`;
  if (id.includes('-gmax') || formName.includes('gmax') || formName.includes('gigantamax')) return `Gigadynamax-${speciesGermanName}`;
  if (id.includes('-alola')) return `${speciesGermanName} (Alola)`;
  if (id.includes('-galar')) return `${speciesGermanName} (Galar)`;
  if (id.includes('-hisui')) return `${speciesGermanName} (Hisui)`;
  if (id.includes('-paldea')) return `${speciesGermanName} (Paldea)`;
  if (id.includes('-totem')) return `${speciesGermanName} (Herrscher)`;
  if (id.includes('-origin')) return `${speciesGermanName} (Urform)`;
  if (id.includes('-therian')) return `${speciesGermanName} (Tiergeistform)`;
  if (id.includes('-incarnate')) return `${speciesGermanName} (Inkarnationsform)`;
  return speciesGermanName;
}

async function main() {
  console.log('Lade Pokémon-Spezies aus PokéAPI ...');
  const index = await requestJson(`${POKEAPI_BASE}/pokemon-species?limit=2000`);
  const speciesRows = await mapConcurrent(index.results || [], 12, async item => {
    const species = await requestJson(item.url);
    const germanName = germanNameFromSpecies(species);
    return {
      dex_number: species.id,
      pokemon_id: species.name,
      german_name: germanName,
    };
  });
  const withGermanName = speciesRows.filter(row => row.german_name);
  console.log(`Deutsche Spezies-Namen gefunden: ${withGermanName.length}/${speciesRows.length}`);

  for (const row of withGermanName) {
    await patch('pokemon_catalog', `pokemon_id=eq.${encodeURIComponent(row.pokemon_id)}`, { german_name: row.german_name });
    await patch('pokemon_catalog', `dex_number=eq.${row.dex_number}&german_name=is.null`, { german_name: row.german_name });
  }

  console.log('Lade vorhandene Formen aus Supabase ...');
  const forms = await selectAll('pokemon_form_catalog', 'select=pokemon_id,species_pokemon_id,pokemon_name,form_name');
  const bySpeciesId = new Map(withGermanName.map(row => [row.pokemon_id, row.german_name]));
  let formUpdates = 0;
  for (const form of forms) {
    const germanName = formGermanName(form, bySpeciesId.get(form.species_pokemon_id));
    if (!germanName) continue;
    formUpdates++;
    await patch('pokemon_form_catalog', `pokemon_id=eq.${encodeURIComponent(form.pokemon_id)}`, { german_name: germanName });
  }

  console.log(DRY_RUN
    ? `Dry-run fertig. Wuerde ${withGermanName.length} Spezies und ${formUpdates} Formen aktualisieren.`
    : `Import fertig. Aktualisiert: ${withGermanName.length} Spezies, ${formUpdates} Formen.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
