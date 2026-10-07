import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanName, cleanText, handleChatRequest, CHAT_KEY, MAX_TEXT, MESSAGE_TTL_MS, listMessages } from '../src/chat-api.mjs';
import { muteKey } from '../src/chat-validation.js';

test('display names and messages are sanitized without inventing content', () => {
  assert.equal(cleanName('  Tea Friend  '), 'Tea Friend');
  assert.equal(cleanName('<script>'), null);
  assert.equal(cleanName(''), null);
  assert.equal(cleanText(' hello workshop '), 'hello workshop');
  assert.equal(cleanText('x'.repeat(MAX_TEXT + 1)), null);
});

test('mute keys are case-insensitive and reject unclean names', () => {
  assert.equal(muteKey('  Tea Friend  '), 'tea friend');
  assert.equal(muteKey('TEA FRIEND'), 'tea friend');
  assert.equal(muteKey('<script>'), null);
  const muted = new Set([muteKey('SpamBot')]);
  assert.ok(muted.has(muteKey('spambot')));
  assert.equal(muted.has(muteKey('Nice Person')), false);
});

function memoryRedis(store, rates = new Map()) {
  return async (args) => {
    const [cmd, key, value, end] = args;
    if (cmd === 'LRANGE') return [...store[key] || []];
    if (cmd === 'LPUSH') { store[key] = store[key] || []; store[key].unshift(value); return store[key].length; }
    if (cmd === 'LTRIM') { store[key] = (store[key] || []).slice(Number(value), Number(end) + 1); return 'OK'; }
    if (cmd === 'DEL') { const had = store[key] ? 1 : 0; delete store[key]; return had; }
    if (cmd === 'SET') { assert.deepEqual(args.slice(2), ['1', 'NX', 'EX', '3']); if (rates.has(key)) return null; rates.set(key, 1); return 'OK'; }
    throw new Error(`unexpected ${cmd}`);
  };
}

test('chat posts append, trim, and rate-limit through the redis command layer', async () => {
  const store = { [CHAT_KEY]: [] };
  const rates = new Map();
  const redis = memoryRedis(store, rates);
  const env = { UPSTASH_REDIS_REST_URL: 'https://example.upstash.io', UPSTASH_REDIS_REST_TOKEN: 'test' };

  const empty = await handleChatRequest({ method: 'GET', redis, env });
  assert.equal(empty.ok, true);
  assert.deepEqual(empty.messages, []);

  const first = await handleChatRequest({ method: 'POST', body: { name: 'Clawd', text: 'tea first' }, ip: '1.1.1.1', redis, env });
  assert.equal(first.ok, true);
  assert.equal(first.message.text, 'tea first');

  const burst = await handleChatRequest({ method: 'POST', body: { name: 'Clawd', text: 'too fast' }, ip: '1.1.1.1', redis, env });
  assert.equal(burst.status, 429);

  rates.clear();
  const second = await handleChatRequest({ method: 'POST', body: { name: 'Friend', text: 'hello back' }, ip: '2.2.2.2', redis, env });
  assert.equal(second.ok, true);

  const listed = await handleChatRequest({ method: 'GET', redis, env });
  assert.equal(listed.messages.length, 2);
  assert.equal(listed.messages[0].text, 'tea first');
  assert.equal(listed.messages[1].text, 'hello back');
});

test('missing redis config fails honestly instead of inventing a room', async () => {
  const result = await handleChatRequest({ method: 'GET', env: {} });
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
});

test('message ID cursors preserve same-millisecond posts and recover after history trimming', async () => {
  const env = { UPSTASH_REDIS_REST_URL: 'https://example.upstash.io', UPSTASH_REDIS_REST_TOKEN: 'test' };
  const at = new Date().toISOString();
  const rows = ['c','b','a'].map(id => JSON.stringify({id, name:'Friend', text:id, at}));
  const redis = async () => rows;
  const result = await handleChatRequest({method:'GET', after:'a', env, redis});
  assert.deepEqual(result.messages.map(m=>m.id), ['b','c']);
  const missing = await handleChatRequest({method:'GET', after:'expired', env, redis});
  assert.deepEqual(missing.messages.map(m=>m.id), ['a','b','c']);
});

test('malformed chat bodies and non-string values are rejected before storage', async () => {
  const env = { UPSTASH_REDIS_REST_URL: 'https://example.upstash.io', UPSTASH_REDIS_REST_TOKEN: 'test' };
  const redis = async () => { throw new Error('Unexpected storage call'); };
  for (const body of [null, [], 4, {name:42,text:'hello'}, {name:'Friend',text:{text:'hello'}}]) {
    const result = await handleChatRequest({method:'POST',body,env,redis});
    assert.equal(result.status,400);
  }
});

test('chat messages older than 24 hours are hidden and pruned from storage', async () => {
  const env = { UPSTASH_REDIS_REST_URL: 'https://example.upstash.io', UPSTASH_REDIS_REST_TOKEN: 'test' };
  const now = Date.parse('2026-10-07T12:00:00.000Z');
  const store = {
    [CHAT_KEY]: [
      JSON.stringify({ id: 'new', name: 'Friend', text: 'still here', at: new Date(now - 60_000).toISOString() }),
      JSON.stringify({ id: 'old', name: 'Friend', text: 'gone', at: new Date(now - MESSAGE_TTL_MS - 1).toISOString() }),
    ],
  };
  const listed = await listMessages({ redis: memoryRedis(store), env, now });
  assert.deepEqual(listed.messages.map(m => m.id), ['new']);
  assert.equal(store[CHAT_KEY].length, 1);
  assert.match(store[CHAT_KEY][0], /"id":"new"/);
});
