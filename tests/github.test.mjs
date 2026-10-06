import test from 'node:test';
import assert from 'node:assert/strict';
import { GithubClient } from '../src/github.js';
const json = (data, headers = {}) => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json', ...headers } });
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
