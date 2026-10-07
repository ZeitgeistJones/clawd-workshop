import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanName, cleanText, handleChatRequest, CHAT_KEY, MAX_TEXT } from '../src/chat-api.mjs';

test('display names and messages are sanitized without inventing content', () => {
  assert.equal(cleanName('  Tea Friend  '), 'Tea Friend');
  assert.equal(cleanName('<script>'), null);
  assert.equal(cleanName(''), null);
  assert.equal(cleanText(' hello workshop '), 'hello workshop');
  assert.equal(cleanText('x'.repeat(MAX_TEXT + 1)), null);
});

test('chat posts append, trim, and rate-limit through the redis command layer', async () => {
  const store = { [CHAT_KEY]: [] };
  const rates = new Map();
  const redis = async (args) => {
    const [cmd, key, value, end] = args;
    if (cmd === 'LRANGE') return [...store[key] || []];
    if (cmd === 'LPUSH') { store[key] = store[key] || []; store[key].unshift(value); return store[key].length; }
    if (cmd === 'LTRIM') { store[key] = (store[key] || []).slice(Number(value), Number(end) + 1); return 'OK'; }
    if (cmd === 'INCR') { const next = (rates.get(key) || 0) + 1; rates.set(key, next); return next; }
    if (cmd === 'EXPIRE') return 1;
    throw new Error(`unexpected ${cmd}`);
  };
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
