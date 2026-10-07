import test from 'node:test';
import assert from 'node:assert/strict';
import { knockLine, momentLine, returnNote, selectWindowNotes, visitSnapshot } from '../src/moment.js';

const now = Date.parse('2026-10-07T18:00:00Z');
const event = (id, minutes, repo = 'clawdbotatg/little-workshop', extra = {}) => ({
  id,
  type: 'PushEvent',
  created_at: new Date(now - minutes * 60000).toISOString(),
  repo: { name: repo },
  payload: { ref: 'refs/heads/main', size: 1, ...extra.payload },
  ...extra,
});

test('the window keeps the newest public updates and only GitHub links', () => {
  const events = [
    event('new', 5),
    event('pr', 20, 'clawdbotatg/wallet', { type: 'PullRequestEvent', payload: { action: 'opened', pull_request: { title: 'A coin slot', html_url: 'javascript:alert(1)' } } }),
    event('old', 60 * 30),
    null,
    { id: 'bad-time', created_at: 'nope', type: 'PushEvent', repo: { name: 'clawdbotatg/x' } },
    event('future', -90),
    ...Array.from({ length: 8 }, (_, i) => event(`more-${i}`, 40 + i)),
  ];
  const notes = selectWindowNotes(events, now);
  assert.equal(notes.length, 6);
  assert.equal(notes[0].id, 'new');
  assert.equal(notes[0].repo, 'little-workshop');
  assert.match(notes[0].url, /^https:\/\/github\.com\/clawdbotatg\/little-workshop/);
  assert.match(notes[1].url, /^https:\/\/github\.com\//);
  assert.doesNotMatch(notes[1].url, /javascript:/);
  assert.equal(selectWindowNotes([event('only', 10)], now, 6)[0].label.includes('little-workshop'), true);
});

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
