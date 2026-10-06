import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEvents, deriveStatus, pulse, describeEvent, repoUrl, safeGithubUrl, timeAgo } from '../src/activity.js';
import { demoSnapshot } from '../src/demo.js';
const now = Date.parse('2026-10-06T04:00:00Z');
const event = (type, minutes = 1, payload = {}) => ({ type, created_at: new Date(now - minutes * 60000).toISOString(), repo: { name: 'clawdbotatg/workshop' }, payload });
test('recent pushes, old activity, and missing signals produce distinct honest states', () => {
  assert.equal(deriveStatus([event('PushEvent')], [], now).state, 'building');
  assert.equal(deriveStatus([event('PushEvent', 46)], [], now).state, 'idle');
  assert.equal(deriveStatus([], [], now).state, 'idle');
  assert.equal(deriveStatus([event('PushEvent')], [], now, true).state, 'unknown');
});
test('queued workflows override event inference, but completed jobs do not', () => {
  assert.equal(deriveStatus([], [{ status: 'queued', repo: 'clawdbotatg/workshop' }], now).state, 'testing');
  assert.equal(deriveStatus([], [{ status: 'completed' }], now).state, 'idle');
});
test('only a published fresh release is a shipping signal', () => {
  assert.equal(deriveStatus([event('ReleaseEvent', 1, { action: 'published' })], [], now).state, 'shipping');
  assert.notEqual(deriveStatus([event('ReleaseEvent', 16, { action: 'published' })], [], now).state, 'shipping');
  assert.notEqual(deriveStatus([event('ReleaseEvent', 1, { action: 'edited' })], [], now).state, 'shipping');
});
test('pulse decays, ignores future events, and stays within bounds', () => {
  const events = [event('PushEvent')];
  assert.ok(pulse(events, now) > pulse(events, now + 1800000));
  assert.equal(pulse([event('PushEvent', -2)], now), 0);
  assert.equal(pulse([event('PushEvent', 1500)], now), 0);
  assert.equal(pulse([], now), 0);
  assert.equal(pulse(Array.from({ length: 1000 }, () => event('PushEvent')), now), 100);
});
test('normalization rejects malformed data and excludes stars and invalid dates', () => {
  assert.throws(() => normalizeEvents({}));
  const result = normalizeEvents([event('WatchEvent'), { ...event('PushEvent'), created_at: 'bad' }, event('CreateEvent', 3), event('PushEvent', 1)]);
  assert.deepEqual(result.map(e => e.type), ['PushEvent', 'CreateEvent']);
});
test('push descriptions work with current payloads that omit commit arrays', () => {
  assert.equal(describeEvent(event('PushEvent', 1, { head: 'abcdef1234567' })).title, 'Pushed code');
  assert.equal(describeEvent(event('PushEvent', 1, { size: 3 })).title, 'Pushed 3 commits');
  assert.ok(describeEvent(event('PushEvent', 1, { head: 'abcdef1234567' })).url.endsWith('/commit/abcdef1234567'));
});
test('untrusted external links do not leave GitHub', () => {
  for (const value of ['javascript:alert(1)', 'https://github.com.evil.test/foo', 'http://github.com/foo', '//evil.test']) assert.equal(safeGithubUrl(value), 'https://github.com');
  assert.equal(repoUrl('../../bad'), 'https://github.com');
});
test('each demo preset yields its advertised state', () => {
  for (const state of ['building', 'planning', 'testing', 'shipping', 'idle']) {
    const data = demoSnapshot(state, now);
    assert.equal(deriveStatus(data.events, data.runs, now).state, state);
  }
});
test('relative time handles minute, hour, and day boundaries', () => {
  assert.equal(timeAgo(new Date(now - 59000).toISOString(), now), 'Just now');
  assert.equal(timeAgo(new Date(now - 60000).toISOString(), now), '1m ago');
  assert.equal(timeAgo(new Date(now - 3600000).toISOString(), now), '1h ago');
  assert.equal(timeAgo(null, now), 'No signal yet');
});
