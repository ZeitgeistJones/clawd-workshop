import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBrief, safeWebsite } from '../src/builds.js';
import { LofiRadio, barScore, createSession, makeRng, STATIONS } from '../src/music.js';

test('build briefs keep real descriptions and chapter evidence, with safe website links', () => {
  const events = [{ type: 'PushEvent', repo: { name: 'clawdbotatg/wallet' }, created_at: new Date().toISOString(), payload: { ref: 'refs/heads/main' } }, { type: 'PushEvent', repo: { name: 'clawdbotatg/other' }, created_at: new Date().toISOString(), payload: {} }];
  const brief = buildBrief('clawdbotatg/wallet', { description: 'A wallet.', language: 'TypeScript', homepage: 'javascript:alert(1)', topics: ['wallet'], license: { spdx_id: 'MIT' } }, events, true);
  assert.equal(brief.description, 'A wallet.'); assert.equal(brief.updates, 1); assert.equal(brief.website, null); assert.match(brief.context, /current/);
  assert.equal(safeWebsite('https://user:pass@example.com'), null); assert.equal(safeWebsite('https://example.com'), 'https://example.com/');
});

test('radio stays silent until asked to play, and failed starts recover cleanly', async () => {
  let constructed = 0, closed = 0;
  const radio = new LofiRadio(() => { constructed++; return { state: 'suspended', resume: async () => { throw new Error('blocked'); }, close: async () => { closed++; } }; });
  assert.equal(constructed, 0); await radio.stop(); assert.equal(constructed, 0);
  await assert.rejects(radio.play()); assert.equal(constructed, 1); assert.equal(closed, 1); assert.equal(radio.playing, false);
  radio.setVolume(2); assert.equal(radio.volume, 1); radio.setVolume(-1); assert.equal(radio.volume, 0);
});

test('each play rolls a live session and bars stay musical but not identical', () => {
  const a = createSession(STATIONS[0], makeRng(11));
  const b = createSession(STATIONS[0], makeRng(99));
  assert.notEqual(a.key, b.key); assert.ok(a.bpm >= STATIONS[0].bpm[0] && a.bpm <= STATIONS[0].bpm[1]);
  const sameA = barScore(0, a, makeRng(7));
  const sameB = barScore(0, a, makeRng(7));
  assert.deepEqual(sameA.notes.map(n => `${n.kind}:${n.note}:${n.at.toFixed(3)}`), sameB.notes.map(n => `${n.kind}:${n.note}:${n.at.toFixed(3)}`));
  const other = barScore(0, a, makeRng(8));
  assert.notDeepEqual(sameA.notes.map(n => `${n.kind}:${n.at.toFixed(3)}`), other.notes.map(n => `${n.kind}:${n.at.toFixed(3)}`));
  for (const station of STATIONS) {
    const session = createSession(station, makeRng(3));
    for (let i = 0; i < 8; i++) {
      const score = barScore(i, session, makeRng(100 + i));
      assert.ok(score.duration > 1.5 && score.duration < 5);
      assert.ok(score.notes.every(n => n.at >= 0 && n.at < score.duration && n.length > 0));
      assert.ok(score.notes.some(n => n.kind === 'keys'));
      assert.ok(score.notes.some(n => n.kind === 'bass'));
      assert.ok(score.notes.some(n => n.kind === 'kick'));
    }
  }
});
