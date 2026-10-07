import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBrief, safeWebsite } from '../src/builds.js';
import { TRACKS, TrackRadio, playlistLength, scheduleAt } from '../src/playlist.js';

test('build briefs keep real descriptions and chapter evidence, with safe website links', () => {
  const events = [{ type: 'PushEvent', repo: { name: 'clawdbotatg/wallet' }, created_at: new Date().toISOString(), payload: { ref: 'refs/heads/main' } }, { type: 'PushEvent', repo: { name: 'clawdbotatg/other' }, created_at: new Date().toISOString(), payload: {} }];
  const brief = buildBrief('clawdbotatg/wallet', { description: 'A wallet.', language: 'TypeScript', homepage: 'javascript:alert(1)', topics: ['wallet'], license: { spdx_id: 'MIT' } }, events, true);
  assert.equal(brief.description, 'A wallet.'); assert.equal(brief.updates, 1); assert.equal(brief.website, null); assert.match(brief.context, /current/);
  assert.equal(safeWebsite('https://user:pass@example.com'), null); assert.equal(safeWebsite('https://example.com'), 'https://example.com/');
});

test('radio stays silent until asked to play, and failed starts recover cleanly', async () => {
  let constructed = 0;
  const radio = new TrackRadio(() => {
    constructed++;
    return {
      loop: false,
      volume: 1,
      readyState: 1,
      duration: 10,
      currentTime: 0,
      play: async () => { throw new Error('blocked'); },
      pause() {},
      removeAttribute() {},
      load() {},
    };
  });
  assert.equal(constructed, 0);
  await radio.stop();
  assert.equal(constructed, 0);
  await assert.rejects(radio.play());
  assert.equal(constructed, 1);
  assert.equal(radio.playing, false);
  radio.setVolume(2); assert.equal(radio.volume, 1);
  radio.setVolume(-1); assert.equal(radio.volume, 0);
});

test('shared playlist schedule keeps listeners on the same live offset', async () => {
  assert.ok(TRACKS.length >= 2);
  assert.ok(TRACKS.every(t => t.id && t.name && t.src.startsWith('./public/music/') && t.duration > 0));
  const total = playlistLength();
  const midFirst = scheduleAt(30_000);
  assert.equal(midFirst.index, 0);
  assert.ok(Math.abs(midFirst.offset - 30) < 0.001);
  const intoSecond = scheduleAt((TRACKS[0].duration + 12) * 1000);
  assert.equal(intoSecond.index, 1);
  assert.ok(Math.abs(intoSecond.offset - 12) < 0.001);
  const wrapped = scheduleAt(total * 1000 + 5_000);
  assert.equal(wrapped.index, 0);
  assert.ok(Math.abs(wrapped.offset - 5) < 0.001);

  const seeks = [];
  let now = (TRACKS[0].duration + 12) * 1000;
  const radio = new TrackRadio(src => {
    const node = {
      src,
      loop: true,
      volume: 1,
      readyState: 1,
      duration: TRACKS.find(t => t.src === src)?.duration || 1,
      currentTime: 0,
      play: async () => {},
      pause() {},
      removeAttribute() {},
      load() {},
    };
    Object.defineProperty(node, 'currentTime', {
      get() { return this._time || 0; },
      set(value) { this._time = value; seeks.push({ src, value }); },
      configurable: true,
    });
    return node;
  }, () => now);
  const intervals = [];
  const realSetInterval = globalThis.setInterval;
  const realClearInterval = globalThis.clearInterval;
  globalThis.setInterval = (fn, ms) => { intervals.push(fn); return realSetInterval(() => {}, ms); };
  globalThis.clearInterval = id => realClearInterval(id);
  try {
    await radio.play();
    assert.equal(radio.playing, true);
    assert.equal(radio.track, 1);
    assert.ok(seeks.some(s => s.src === TRACKS[1].src && Math.abs(s.value - 12) < 0.05));
  } finally {
    globalThis.setInterval = realSetInterval;
    globalThis.clearInterval = realClearInterval;
    await radio.stop();
  }
});
