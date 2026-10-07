import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBrief, safeWebsite } from '../src/builds.js';
import { TRACKS, TrackRadio } from '../src/playlist.js';

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

test('playlist tracks loop and switching stops the previous audio element', async () => {
  assert.ok(TRACKS.length >= 2);
  assert.ok(TRACKS.every(t => t.id && t.name && t.src.startsWith('./public/music/')));
  const plays = [];
  const radio = new TrackRadio(src => {
    const node = {
      src,
      loop: false,
      volume: 1,
      play: async () => { plays.push(src); node.loop = true; },
      pause() { node.paused = true; },
      removeAttribute() {},
      load() {},
    };
    return node;
  });
  await radio.play(0);
  assert.equal(radio.playing, true);
  assert.equal(radio.audio.loop, true);
  assert.equal(plays.at(-1), TRACKS[0].src);
  await radio.play(1);
  assert.equal(plays.at(-1), TRACKS[1].src);
  assert.equal(radio.current().id, TRACKS[1].id);
  await radio.stop();
  assert.equal(radio.playing, false);
  assert.equal(radio.audio, null);
});
