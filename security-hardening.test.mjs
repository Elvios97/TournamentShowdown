import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql = await readFile(new URL('./SUPABASE_PUBLIC_BETA_HARDENING.sql', import.meta.url), 'utf8');
const rpcSql = await readFile(new URL('./SUPABASE_RPC_EXECUTE_HARDENING.sql', import.meta.url), 'utf8');

assert.match(sql, /members_update_host_only/);
assert.match(sql, /role = 'player'/);
assert.doesNotMatch(sql, /members_update_self_or_host/);
assert.match(sql, /sheets_read_public_anon[\s\S]*tournament_id is null and visibility = 'public'/);
assert.match(sql, /revoke all on[\s\S]*public\.invite_codes[\s\S]*from anon/);
assert.match(sql, /from public\.draft_sessions[\s\S]*for update/);
assert.match(sql, /idx_draft_picks_session_number/);
assert.match(sql, /p\.proname = 'create_tournament_with_host'/);
assert.match(sql, /revoke execute on function %s from anon/);
assert.match(sql, /^begin;/m);
assert.match(sql, /^commit;/m);
assert.match(rpcSql, /replace_team_sheet_pokemon/);
assert.match(rpcSql, /make_draft_pick/);
assert.match(rpcSql, /revoke all on function %s from public, anon/);
assert.match(rpcSql, /grant execute on function %s to authenticated/);
assert.match(rpcSql, /revoke all on function %s from public, anon, authenticated/);
assert.match(rpcSql, /^commit;/m);

console.log('security-hardening: OK');
