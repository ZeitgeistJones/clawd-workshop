import test from 'node:test';
import assert from 'node:assert/strict';
import { knockLine, momentLine, postcardCaption, postcardModel, returnNote, selectWindowBirds, visitSnapshot } from '../src/moment.js';

const now = Date.parse('2026-10-07T18:00:00Z');
const event = (id, minutes, repo = 'clawdbotatg/little-workshop', extra = {}) => ({
  id,
  type: 'PushEvent',
  created_at: new Date(now - minutes * 60000).toISOString(),
  repo: { name: repo },
  payload: { ref: 'refs/heads/main', size: 1, ...extra.payload },
  ...extra,
});

test('window birds keep the newest public updates and only GitHub links', () => {
  const events = [
    event('new', 5),
    event('pr', 20, 'clawdbotatg/wallet', { type: 'PullRequestEvent', payload: { action: 'opened', pull_request: { title: 'A coin slot', html_url: 'javascript:alert(1)' } } }),
    event('old', 60 * 30),
    null,
    { id: 'bad-time', created_at: 'nope', type: 'PushEvent', repo: { name: 'clawdbotatg/x' } },
    event('future', -90),
    ...Array.from({ length: 8 }, (_, i) => event(`more-${i}`, 40 + i)),
  ];
  const birds = selectWindowBirds(events, now);
  assert.equal(birds.length, 6);
  assert.equal(birds[0].id, 'new');
  assert.equal(birds[0].repo, 'little-workshop');
  assert.match(birds[0].url, /^https:\/\/github\.com\/clawdbotatg\/little-workshop/);
  assert.match(birds[1].url, /^https:\/\/github\.com\//);
  assert.doesNotMatch(birds[1].url, /javascript:/);
  assert.ok(birds.every(bird => bird.x >= 0 && bird.x <= 100 && bird.y >= 0 && bird.y <= 100));
  assert.equal(selectWindowBirds([event('only', 10)], now, 6)[0].label.includes('little-workshop'), true);
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

test('postcard caption labels sample and replay moments', () => {
  const live = postcardModel({ status: { state: 'shipping', repo: 'clawdbotatg/robot' }, mode: 'current', data: { checkedAt: new Date(now).toISOString() } }, 'https://clawd-workshop.vercel.app/');
  assert.match(live.caption, /not a live camera/);
  assert.match(live.caption, /robot is boxed/);
  assert.equal(live.stamp, 'PUBLIC SIGNALS · not a camera');
  const sample = postcardCaption({ line: 'Sample · Hammer.', repo: 'clawdbotatg/x', demo: true, replay: false, href: 'https://example.com/' });
  assert.match(sample, /Sample activity, not a live feed/);
  const replay = postcardModel({ status: { state: 'idle' }, mode: 'replay', demo: false }, 'https://example.com/');
  assert.match(replay.caption, /public replay/);
  assert.equal(visitSnapshot({ allEvents: [{ id: 9 }], status: { repo: 'clawdbotatg/x', state: 'building' } }, now).latestId, '9');
});
