import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql = await readFile(new URL('./SUPABASE_ATOMIC_TEAM_IMPORT.sql', import.meta.url), 'utf8');
const validationPosition = sql.indexOf('for v_set in select value from jsonb_array_elements(p_sets)');
const deletePosition = sql.indexOf('delete from public.pokemon_sets');

assert.match(sql, /security definer/i);
assert.match(sql, /for update/i);
assert.match(sql, /p_sets is null or jsonb_typeof\(p_sets\) <> 'array'/i);
assert.ok(validationPosition >= 0 && deletePosition > validationPosition, 'Validierung muss vor dem Löschen stattfinden');
assert.match(sql, /revoke all on function public\.replace_team_sheet_pokemon\(uuid, jsonb\) from public/i);
assert.match(sql, /grant execute on function public\.replace_team_sheet_pokemon\(uuid, jsonb\) to authenticated/i);
console.log('atomic-team-import: OK');
