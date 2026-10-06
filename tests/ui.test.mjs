// Controller integration tests with a small DOM harness, not a layout browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import * as activity from '../src/activity.js';
import * as replayHelpers from '../src/replay.js';
import { CONFIG } from '../src/config.js';
import { GithubClient } from '../src/github.js';
import { demoSnapshot, demoHistory } from '../src/demo.js';
import { projectObject } from '../src/objects.js';
class Element {
  constructor(tag = 'div') {
    this.tagName = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.events = {}; this.hidden = false; this.textContent = ''; this.classes = new Set();
    this.classList = { toggle: (key, force) => { const enabled = force ?? !this.classes.has(key); enabled ? this.classes.add(key) : this.classes.delete(key); return enabled; } };
  }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(name, fn) { this.events[name] = fn; }
  querySelectorAll(tag) { return this.children.flatMap(n => [n.tagName === tag ? n : null, ...(n.querySelectorAll?.(tag) || [])]).filter(Boolean); }
  showModal() { this.open = true; }
  close() { this.open = false; }
}
async function harness({ demo = true, fail = false, saved = null } = {}) {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const source = (await readFile(new URL('../src/app.js', import.meta.url), 'utf8')).replace(/^import .*;\n/gm, '');
  const elements = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m => [m[1], new Element()]));
  elements['replay-length'].value = '300000';
  const fixture = demoHistory(), storage = new Map(), handlers = {};
  if (saved) storage.set(CONFIG.cacheKey, JSON.stringify({ username: CONFIG.username, data: saved }));
  let calls = 0, raf;
  class Client extends GithubClient {
    constructor() { super(async url => {
      calls++; if (fail) throw new Error('Offline');
      const data = url.includes('/events/') ? fixture.events : url.includes('/actions/') ? { workflow_runs: [] } : fixture.repos;
      return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
    }); }
  }
  const document = { hidden: false, getElementById: id => { assert.ok(elements[id], `missing HTML element ${id}`); return elements[id]; }, createElement: tag => new Element(tag), createElementNS: (_ns, tag) => new Element(tag), createTextNode: text => ({ textContent: text }), addEventListener: (name, fn) => { handlers[name] = fn; } };
  vm.runInNewContext(source, {
    ...activity, ...replayHelpers, CONFIG, GithubClient: Client, demoSnapshot, demoHistory, projectObject, URL, URLSearchParams, Date,
    location: { search: demo ? '?demo=1' : '' }, localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) }, document,
    window: { addEventListener() {} }, setTimeout() { return 1; }, clearTimeout() {}, setInterval() { return 1; }, requestAnimationFrame(fn) { raf = fn; }
  });
  for (let i = 0; i < 15; i++) await new Promise(resolve => setImmediate(resolve));
  return { elements, storage, document, handlers, calls: () => calls, step: t => raf(t) };
}
test('all current demo states, artwork updates, motion controls and dialog work', async () => {
  const h = await harness(), e = h.elements;
  assert.equal(h.calls(), 0); assert.equal(e.scene.dataset.state, 'building');
  for (const state of ['planning', 'testing', 'shipping', 'idle', 'building']) {
    e['demo-state'].events.change({ target: { value: state } }); assert.equal(e.scene.dataset.state, state);
  }
  e['motion-button'].events.click(); assert.equal(e['motion-button'].attributes['aria-pressed'], 'true');
  e['about-button'].events.click(); assert.equal(e['about-dialog'].open, true);
  e['close-dialog'].events.click(); assert.equal(e['about-dialog'].open, false);
});
test('replay loads a day, starts playing, pauses, scrubs, changes duration and returns to current mode', async () => {
  const h = await harness(), e = h.elements;
  await e['replay-mode'].events.click();
  assert.equal(h.calls(), 0); assert.equal(e['replay-panel'].hidden, false);
  assert.match(e['replay-coverage'].textContent, /9 projects/); assert.equal(e.scene.dataset.projectKind, 'wallet');
  assert.match(e['project-visual'].attributes.href, /#wallet$/);
  h.step(100); h.step(1100); const elapsed = Number(e['replay-progress'].value); assert.ok(elapsed > 0);
  e['replay-play'].events.click(); h.step(2100); assert.equal(Number(e['replay-progress'].value), elapsed);
  e['replay-next'].events.click(); assert.equal(e.scene.dataset.state, 'shipping');
  e['replay-progress'].events.input({ target: { value: e['replay-progress'].max } });
  assert.equal(e['replay-play'].textContent, '↺ Play again');
  e['replay-play'].events.click(); assert.equal(Number(e['replay-progress'].value), 0);
  e['replay-length'].value = '480000'; e['replay-length'].events.change(); assert.equal(e['replay-elapsed'].textContent, '0:00 / 8:00');
  e['current-mode'].events.click(); assert.equal(e['replay-panel'].hidden, true); assert.equal(e['refresh-button'].hidden, false);
});
test('replay objects follow the selected chapter and hidden tabs pause time', async () => {
  const h = await harness(), e = h.elements;
  await e['replay-mode'].events.click();
  const chapters = e['replay-chapters'].querySelectorAll('button');
  const dashboard = chapters.find(b => b.children[1].children[0].textContent === 'clawd-harness');
  dashboard.events.click(); assert.equal(e.scene.dataset.projectKind, 'dashboard'); assert.match(e['object-name'].textContent, /dashboard/);
  assert.equal(e['project-object'].attributes.visibility, 'visible');
  e['replay-play'].events.click(); h.step(100); h.step(1100);
  const at = e['replay-progress'].value;
  h.document.hidden = true; h.handlers.visibilitychange(); h.step(999999);
  assert.equal(e['replay-progress'].value, at); assert.equal(e['replay-play'].textContent, '▶ Play');
});
test('public fixtures render and offline recovery preserves evidence without claiming a current state', async () => {
  const live = await harness({ demo: false }); assert.equal(live.calls(), 3);
  assert.ok(live.storage.get(CONFIG.cacheKey)); assert.ok(live.elements.timeline.children.length > 0);
  await live.elements['replay-mode'].events.click();
  assert.ok(live.elements['replay-chapters'].children.length > 0);
  const saved = JSON.parse(live.storage.get(CONFIG.cacheKey)).data;
  const offline = await harness({ demo: false, fail: true, saved });
  assert.equal(offline.elements.scene.dataset.state, 'unknown'); assert.match(offline.elements.notice.textContent, /saved snapshot/);
  assert.ok(offline.elements.timeline.children.length > 0);
});
