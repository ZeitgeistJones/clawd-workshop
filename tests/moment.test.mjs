import test from 'node:test';
import assert from 'node:assert/strict';
import { knockLine, momentLine, returnNote, visitSnapshot } from '../src/moment.js';

const now = Date.parse('2026-10-07T18:00:00Z');

test('moment and knock lines stay honest about public signals', () => {
  assert.equal(momentLine({ state: 'building', repo: 'clawdbotatg/little-workshop' }), `Hammer's out on little-workshop.`);
  assert.match(momentLine({ state: 'idle' }, { demo: true }), /^Sample · /);
  assert.match(momentLine({ state: 'unknown' }, { replay: true }), /^Replay · Checking/);
  for (const state of ['building', 'planning', 'testing', 'shipping', 'idle', 'unknown']) {
    const line = knockLine(state);
    assert.ok(line.length > 8);
    assert.doesNotMatch(line, /keystroke|typing|watching you|productivity/i);
  }
});

test('return note compares the last look without inventing a count', () => {
  const previous = { at: now - 3 * 3600000, latestId: 'a', repo: 'clawdbotatg/wallet' };
  assert.equal(returnNote(previous, { latestId: 'a', repo: 'clawdbotatg/wallet' }, now), 'Same bench as when you left. Still wallet, and nothing newer in the public feed.');
  assert.match(returnNote(previous, { latestId: 'b', repo: 'clawdbotatg/grove' }, now), /wallet to grove/);
  assert.match(returnNote(previous, { latestId: 'b', repo: 'clawdbotatg/wallet' }, now), /Something new/);
  assert.equal(returnNote({ at: now - 5 * 60000, latestId: 'a', repo: 'clawdbotatg/wallet' }, { latestId: 'b', repo: 'clawdbotatg/grove' }, now), '');
  assert.equal(returnNote(null, { latestId: 'b' }, now), '');
});

test('a saved look remembers the latest public signal', () => {
  assert.equal(visitSnapshot({ allEvents: [{ id: 9 }], status: { repo: 'clawdbotatg/x', state: 'building' } }, now).latestId, '9');
});
