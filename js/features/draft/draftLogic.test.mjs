import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./draftLogic.js', import.meta.url), 'utf8');
const logic = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

const order = ['a', 'b', 'c'];
assert.deepEqual(logic.getDraftTurn({ pick_order: order, current_pick_index: 0 }, { draft_mode: 'snake' }), { memberId: 'a', round: 1, pick: 1 });
assert.equal(logic.getDraftTurn({ pick_order: order, current_pick_index: 3 }, { draft_mode: 'snake' }).memberId, 'c');
assert.equal(logic.getDraftTurn({ pick_order: order, current_pick_index: 4 }, { draft_mode: 'snake' }).memberId, 'b');
assert.equal(logic.getDraftTurn({ pick_order: order, current_pick_index: 3 }, { draft_mode: 'linear' }).memberId, 'a');
assert.equal(logic.normalizeRealtimeStatus('SUBSCRIBED'), 'connected');
assert.equal(logic.normalizeRealtimeStatus('CHANNEL_ERROR'), 'error');
assert.match(logic.formatDraftError({ code: '23505', message: 'duplicate key' }), /bereits verarbeitet/);
assert.equal(logic.rosterCost([{ member_id: 'a', pokemon_id: 'x' }], 'a', [{ pokemon_id: 'x', cost: 12 }]), 12);
console.log('draftLogic: OK');
