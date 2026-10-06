import test from 'node:test';
import assert from 'node:assert/strict';
import { makeReplay, replayFrame, mergeEvents, DAY_MS } from '../src/replay.js';
import { projectObject } from '../src/objects.js';
import { demoHistory } from '../src/demo.js';
import { CONFIG } from '../src/config.js';
const end = Date.parse('2026-10-06T04:00:00Z');
const event = (id, minutes, repo = 'instant-wallet', type = 'PushEvent', payload = {}) => ({ id: String(id), type, created_at: new Date(end - minutes * 60000).toISOString(), repo: { name: `clawdbotatg/${repo}` }, payload });
test('replay includes exactly the rolling day and excludes future events', () => {
  const plan = makeReplay([event(1, 1441), event(2, 1440), event(3, 5), event(4, -1)], { end });
  assert.deepEqual(plan.events.map(e => e.id), ['3', '2']);
  assert.equal(plan.start, end - DAY_MS);
});
test('adjacent updates are grouped, project switches and releases are preserved', () => {
  const plan = makeReplay([event(1, 200), event(2, 190), event(3, 185, 'wedgie-safe'), event(4, 180, 'instant-wallet'), event(5, 175, 'instant-wallet', 'ReleaseEvent', { action: 'published' })], { end });
  const chapters = plan.chapters.filter(c => !c.quiet);
  assert.equal(chapters.length, 4);
  assert.equal(chapters[0].events.length, 2);
  assert.equal(chapters.at(-1).state, 'shipping');
  assert.equal(plan.projectCount, 2);
});
test('every event is retained as chapter evidence exactly once, with duplicates removed', () => {
  const input = Array.from({ length: 70 }, (_, i) => event(i, 100 + i * 2, `project-${i % 4}`));
  const plan = makeReplay([...input, input[0]], { end });
  assert.equal(plan.chapters.flatMap(c => c.events).length, 70);
  assert.equal(mergeEvents(input, input).length, 70);
});
test('dense days extend playback instead of flashing chapters too fast', () => {
  const plan = makeReplay(Array.from({ length: 70 }, (_, i) => event(i, 100 + i * 2, `project-${i % 4}`)), { end, durationMs: 120000 });
  assert.ok(plan.durationMs > 120000);
  assert.ok(plan.chapters.every(c => c.durationMs >= CONFIG.minChapterMs));
  assert.ok(Math.abs(plan.chapters.at(-1).offsetMs + plan.chapters.at(-1).durationMs - plan.durationMs) < .01);
});
test('sparse days finish promptly and quiet gaps get at most ten seconds', () => {
  const plan = makeReplay([event(1, 500)], { end });
  assert.ok(plan.durationMs <= 50000);
  assert.ok(plan.chapters.filter(c => c.quiet).every(c => c.durationMs <= 10000));
  assert.ok(plan.chapters.filter(c => !c.quiet).every(c => c.durationMs <= 30000));
});
test('scrubbing boundaries and completion select the correct chapter without a time reversal', () => {
  const plan = makeReplay([event(1, 800), event(2, 400, 'wedgie-safe')], { end });
  assert.equal(replayFrame(plan, -10).index, 0);
  for (let i = 1; i < plan.chapters.length; i++) {
    const before = replayFrame(plan, plan.chapters[i].offsetMs - .01);
    const after = replayFrame(plan, plan.chapters[i].offsetMs);
    assert.equal(after.index, i); assert.ok(after.at >= before.at);
  }
  const last = replayFrame(plan, plan.durationMs + 1000);
  assert.equal(last.index, plan.chapters.length - 1); assert.equal(last.ended, true);
});
test('missing earlier feed coverage is shown as unavailable, not sleeping', () => {
  const plan = makeReplay([event(1, 120)], { end, partial: true, coverageStart: end - 120 * 60000 });
  assert.equal(plan.chapters[0].state, 'unknown');
  assert.equal(plan.chapters[0].title, 'Earlier activity unavailable');
});
test('empty history has no fabricated chapters or duration', () => {
  const plan = makeReplay([], { end });
  assert.equal(plan.durationMs, 0); assert.equal(replayFrame(plan, 0), null);
});
test('project names map to recognizable objects without matching incidental substrings', () => {
  for (const [name, kind] of Object.entries({ 'instant-wallet': 'wallet', 'wedgie-safe': 'vault', 'wedgie-grove': 'grove', 'wedgie-frog': 'frog', 'wedgie-keypad': 'keypad', 'slop-lessons': 'book', 'clawd-daily': 'newspaper', 'clawd-research': 'microscope', 'clawd-txn-simulator': 'simulator', 'liquidity-vesting': 'liquidity', 'agent-bot': 'bot', 'clawd-incinerator': 'incinerator', 'clawd-fomo3d-v2': 'frog', 'clawd-containers': 'bunker' })) {
    assert.equal(projectObject(`clawdbotatg/${name}`).kind, kind);
  }
  assert.equal(projectObject('clawdbotatg/botanical').kind, 'blueprint');
  assert.equal(projectObject('clawdbotatg/safety-net').kind, 'blueprint');
});
test('metadata and explicit mappings help without inventing an unknown project type', () => {
  assert.equal(projectObject('clawdbotatg/mystery', { description: 'A wallet for small payments.' }).kind, 'wallet');
  assert.equal(projectObject('clawdbotatg/mystery', { topics: ['dashboard'] }).kind, 'dashboard');
  assert.equal(projectObject('clawdbotatg/clawd-harness').label, 'Agent control dashboard');
  assert.equal(projectObject('clawdbotatg/mystery').known, false);
});
test('sample day fits the 24-hour window and contains distinct project props', () => {
  const history = demoHistory(end), plan = makeReplay(history.events, { end });
  assert.equal(plan.projectCount, 9);
  assert.ok(plan.events.every(e => Date.parse(e.created_at) >= end - DAY_MS && Date.parse(e.created_at) <= end));
  assert.ok(new Set(plan.events.map(e => projectObject(e.repo.name).kind)).size >= 8);
});
