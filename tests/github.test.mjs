import test from 'node:test';
import assert from 'node:assert/strict';
import { GithubClient } from '../src/github.js';
const json = (data, headers = {}) => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json', ...headers } });
test('default fetch keeps the browser global receiver instead of the client instance', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = function () {
    // Browser fetch rejects receivers such as GithubClient with Illegal invocation.
    if (this !== globalThis) throw new TypeError('Illegal invocation');
    return Promise.resolve(json(['browser request succeeded']));
  };
  try {
    const c = new GithubClient();
    assert.deepEqual(await c.request('/test'), ['browser request succeeded']);
  } finally { globalThis.fetch = originalFetch; }
});
test('ETag is sent on the next request and 304 preserves data', async () => {
  let calls = 0;
  const c = new GithubClient(async (_url, options) => {
    if (++calls === 1) return json([1], { etag: '"test"' });
    assert.equal(options.headers['If-None-Match'], '"test"');
    return new Response(null, { status: 304 });
  });
  assert.deepEqual(await c.request('/test'), [1]);
  assert.deepEqual(await c.request('/test'), [1]);
});
test('rate limits block repeat calls and respect reset headers', async () => {
  let calls = 0;
  const reset = Math.ceil(Date.now() / 1000) + 300;
  const c = new GithubClient(async () => { calls++; return new Response('', { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset) } }); });
  await assert.rejects(c.request('/test'), /rate limit/);
  await assert.rejects(c.request('/test'), /rate limit/);
  assert.equal(calls, 1); assert.ok(c.blockedUntil >= reset * 1000);
});
test('workflow failure preserves real events with a warning', async () => {
  const c = new GithubClient(async url => {
    if (url.includes('/events/')) return json([{ type: 'PushEvent', repo: { name: 'clawdbotatg/x' }, created_at: new Date().toISOString() }]);
    if (url.includes('/actions/')) return new Response('', { status: 404 });
    return json([]);
  });
  const data = await c.snapshot();
  assert.equal(data.events.length, 1); assert.equal(data.runs.length, 0); assert.match(data.workflowWarning, /unavailable/);
});
test('workflow runs from other contributors cannot impersonate Clawd', async () => {
  const c = new GithubClient(async url => {
    if (url.includes('/events/')) return json([{ type: 'PushEvent', repo: { name: 'clawdbotatg/x' }, created_at: new Date().toISOString() }]);
    if (url.includes('/actions/')) return json({ workflow_runs: [{ id: 1, actor: { login: 'someone-else' }, status: 'in_progress' }, { id: 2, actor: { login: 'clawdbotatg' }, status: 'queued' }] });
    return json([]);
  });
  assert.deepEqual((await c.snapshot()).runs.map(r => r.id), [2]);
});
test('longer server poll advice is honored and repo data is cached', async () => {
  let repoCalls = 0;
  const c = new GithubClient(async url => {
    if (url.includes('/repos?')) repoCalls++;
    return json([], { 'x-poll-interval': '600' });
  });
  await c.snapshot(); await c.snapshot();
  assert.equal(repoCalls, 1); assert.equal(c.pollMs, 600000);
});
test('replay pages stop once the requested day is covered', async () => {
  const end = Date.now(), calls = [];
  const c = new GithubClient(async url => {
    calls.push(url);
    const page = new URL(url).searchParams.get('page') || '1';
    return json(Array.from({ length: 100 }, (_, i) => ({ id: `${page}-${i}`, type: 'PushEvent', repo: { name: 'clawdbotatg/wallet' }, created_at: new Date(end - (page === '1' ? i : 1400 + i) * 60000).toISOString() })));
  });
  const history = await c.history({}, end);
  assert.equal(calls.length, 2); assert.equal(history.partial, false);
  assert.ok(history.events.every(e => Date.parse(e.created_at) >= end - 86400000));
});
test('feed ceiling is labeled partial and collected snapshots are merged', async () => {
  const end = Date.now(); let calls = 0;
  const c = new GithubClient(async () => { const page = ++calls; return json(Array.from({ length: 100 }, (_, i) => ({ id: `${page}-${i}`, type: 'PushEvent', repo: { name: 'clawdbotatg/wallet' }, created_at: new Date(end - (page * 100 + i) * 1000).toISOString() }))); });
  const archived = { id: 'saved', type: 'PushEvent', repo: { name: 'clawdbotatg/safe' }, created_at: new Date(end - 10 * 3600000).toISOString() };
  const history = await c.history({ historyEvents: [archived] }, end);
  assert.equal(calls, 3); assert.equal(history.partial, true); assert.equal(history.events.length, 301);
  assert.match(history.warning, /300-event/);
});
test('later history page failures keep evidence and never present complete coverage', async () => {
  const end = Date.now(); let calls = 0;
  const c = new GithubClient(async () => {
    if (++calls > 1) throw new Error('Network unavailable');
    return json(Array.from({ length: 100 }, (_, i) => ({ id: String(i), type: 'PushEvent', repo: { name: 'clawdbotatg/wallet' }, created_at: new Date(end - i * 1000).toISOString() })));
  });
  const history = await c.history({}, end);
  assert.equal(history.events.length, 100); assert.equal(history.partial, true); assert.match(history.warning, /Network unavailable/);
});
