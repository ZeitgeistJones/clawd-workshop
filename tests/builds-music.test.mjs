import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBrief, safeWebsite } from '../src/builds.js';
import { TRACKS, TrackRadio, playlistLength, scheduleAt, trackGithubUrl } from '../src/playlist.js';

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
  assert.ok(TRACKS.every(t => t.repo && trackGithubUrl(t)?.startsWith('https://github.com/')));
  assert.equal(trackGithubUrl({ repo: 'wedgie-frog' }), 'https://github.com/clawdbotatg/wedgie-frog');
  assert.equal(trackGithubUrl({ repo: 'clawdbotatg/fwaah' }), 'https://github.com/clawdbotatg/fwaah');
  assert.equal(trackGithubUrl({}), null);
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

test('audible radio starts unmuted and reuses one media element across track changes', async () => {
  let now = 10000, count = 0;
  const played = [];
  const radio = new TrackRadio(src => {
    count++;
    return { src, readyState: 1, duration: TRACKS[0].duration, currentTime: 0,
      play() { played.push({src: this.src, muted: this.muted}); return Promise.resolve(); },
      pause() {}, load() { this.duration = TRACKS.find(t => t.src === this.src)?.duration; }, removeAttribute() {} };
  }, () => now);
  try {
    await radio.play();
    assert.equal(played[0].muted, false);
    const element = radio.audio;
    now = (TRACKS[0].duration + 4) * 1000;
    await radio.play();
    assert.equal(count, 1); assert.equal(radio.audio, element);
    assert.equal(element.src, TRACKS[1].src); assert.ok(Math.abs(element.currentTime - 4) < 0.01);
  } finally { await radio.stop(); }
});

test('pending playback cannot revive a stopped player and media errors remain visible', async () => {
  let resolve;
  const radio = new TrackRadio(() => ({readyState: 1, duration: 300, currentTime: 0,
    play: () => new Promise(r => resolve = r), pause() {}, load() {}, removeAttribute() {}}), () => 10000);
  const pending = radio.play();
  await radio.stop(); resolve(); await pending;
  assert.equal(radio.playing, false); assert.equal(radio.audio, null);
  radio.factory = () => ({readyState: 1, duration: 300, currentTime: 0, play: async () => {}, pause() {}, load() {}, removeAttribute() {}});
  await radio.play(); radio.audio.onerror();
  assert.equal(radio.playing, false); assert.match(radio.error.message, /could not load/); assert.equal(radio.syncTimer, 0);
  await radio.play(); assert.equal(radio.error, null); assert.equal(radio.playing, true);
  await radio.stop();
});

test('browser sound denial is distinct from a missing track', async () => {
  const radio = new TrackRadio(() => ({play: async () => { const e = new Error('Sound blocked'); e.name = 'NotAllowedError'; throw e; },pause() {},load() {},removeAttribute() {}}));
  await assert.rejects(radio.play(), {name: 'NotAllowedError'});
  assert.equal(radio.blocked, true); assert.equal(radio.error, null); assert.equal(radio.loading, false);
  assert.ok(radio.audio, 'keep the media element so a click can unmute it');
  await radio.stop();
  const aborted = new TrackRadio(() => ({play: async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; },pause() {},load() {},removeAttribute() {}}));
  await assert.rejects(aborted.play(), {name: 'AbortError'});
  assert.equal(aborted.blocked, true); assert.equal(aborted.error, null);
});
