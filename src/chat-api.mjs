// Shared workshop chat helpers — Upstash Redis REST, no npm package.
// Keys are namespaced so this can share a Redis DB with other apps.

export const CHAT_KEY = 'clawd-workshop:chat:messages';
export const MAX_MESSAGES = 80;
export const MESSAGE_TTL_MS = 24 * 60 * 60 * 1000;
import { cleanName, cleanText, MAX_NAME, MAX_TEXT } from './chat-validation.js';
export { cleanName, cleanText, MAX_NAME, MAX_TEXT };
export const RATE_SECONDS = 3;

function messageTime(message) {
  return Date.parse(message?.at);
}
export function isFreshMessage(message, now = Date.now()) {
  const at = messageTime(message);
  return Number.isFinite(at) && at >= now - MESSAGE_TTL_MS;
}
function parseRow(row) {
  try { return JSON.parse(row); } catch { return null; }
}
function validStoredMessage(m) {
  return m && typeof m.id === 'string' && m.id.length <= 100 && cleanName(m.name) && cleanText(m.text) && Number.isFinite(messageTime(m));
}

/** @param {string} raw */
export function redisConfigured(env = process.env) {
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

/**
 * Run one Upstash Redis REST command.
 * @param {string[]} args
 * @param {Record<string, string|undefined>} [env]
 */
export async function redisCommand(args, env = process.env) {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Chat storage is not configured.');
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(8000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) throw new Error(payload.error || `Redis error ${response.status}`);
  return payload.result;
}

function rateKey(ip) {
  const safe = String(ip || 'unknown').replace(/[^a-zA-Z0-9:._-]/g, '').slice(0, 80) || 'unknown';
  return `clawd-workshop:chat:rate:${safe}`;
}

/**
 * Newest-first fresh messages. Rewrites Redis when anything older than 24h remains.
 * @param {{ redis?: typeof redisCommand, env?: Record<string, string|undefined>, now?: number }} [opts]
 */
export async function loadFreshMessages(opts = {}) {
  const redis = opts.redis || redisCommand;
  const env = opts.env || process.env;
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();
  const rows = await redis(['LRANGE', CHAT_KEY, '0', String(MAX_MESSAGES - 1)], env);
  const parsed = (Array.isArray(rows) ? rows : []).map(parseRow).filter(validStoredMessage);
  const fresh = parsed.filter(m => isFreshMessage(m, now)).slice(0, MAX_MESSAGES);
  if (fresh.length !== parsed.length) {
    await redis(['DEL', CHAT_KEY], env);
    // LPUSH oldest→newest so index 0 stays the newest message.
    for (const message of [...fresh].reverse()) {
      await redis(['LPUSH', CHAT_KEY, JSON.stringify(message)], env);
    }
  }
  return fresh;
}

/**
 * @param {{ redis?: typeof redisCommand, env?: Record<string, string|undefined>, since?: string|null, after?: string|null, now?: number }} [opts]
 */
export async function listMessages(opts = {}) {
  const redis = opts.redis || redisCommand;
  const env = opts.env || process.env;
  if (!redisConfigured(env)) return { ok: false, status: 503, error: 'Chat is not configured on this deployment.' };
  const sinceMs = opts.since ? Date.parse(opts.since) : NaN;
  const newestFirst = await loadFreshMessages({ redis, env, now: opts.now });
  const messages = [...newestFirst].reverse();
  // A message ID also distinguishes posts in the same millisecond. If a cursor
  // has aged out of the retained window, return that window for client deduping.
  const cursor = typeof opts.after === 'string' ? messages.findIndex(m => m.id === opts.after) : -1;
  return { ok: true, status: 200, messages: opts.after ? cursor >= 0 ? messages.slice(cursor + 1) : messages
    : messages.filter(m => !Number.isFinite(sinceMs) || Date.parse(m.at) >= sinceMs) };
}

/**
 * Store one chat line without the visitor rate limit. Used for Clawd's own replies.
 * @param {{ name: string, text: string, redis?: typeof redisCommand, env?: Record<string, string|undefined> }} input
 */
export async function appendChatMessage(input) {
  const redis = input.redis || redisCommand;
  const env = input.env || process.env;
  if (!redisConfigured(env)) return { ok: false, status: 503, error: 'Chat is not configured on this deployment.' };
  const name = cleanName(input.name);
  const text = cleanText(input.text);
  if (!name || !text) return { ok: false, status: 400, error: 'Unusable chat line.' };
  const message = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    text,
    at: new Date().toISOString(),
  };
  await redis(['LPUSH', CHAT_KEY, JSON.stringify(message)], env);
  await redis(['LTRIM', CHAT_KEY, '0', String(MAX_MESSAGES - 1)], env);
  return { ok: true, status: 201, message };
}

/**
 * @param {{ name: string, text: string, ip?: string, redis?: typeof redisCommand, env?: Record<string, string|undefined> }} input
 */
export async function postMessage(input) {
  const redis = input.redis || redisCommand;
  const env = input.env || process.env;
  if (!redisConfigured(env)) return { ok: false, status: 503, error: 'Chat is not configured on this deployment.' };
  const name = cleanName(input.name);
  const text = cleanText(input.text);
  if (!name) return { ok: false, status: 400, error: 'Pick a short display name (letters, numbers, spaces).' };
  if (!text) return { ok: false, status: 400, error: `Say something under ${MAX_TEXT} characters.` };

  // Atomic expiry avoids leaving an IP blocked forever if a second call fails.
  const allowed = await redis(['SET', rateKey(input.ip), '1', 'NX', 'EX', String(RATE_SECONDS)], env);
  if (allowed !== 'OK') return { ok: false, status: 429, error: 'Slow down a second — the workshop is listening.' };

  const message = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    text,
    at: new Date().toISOString(),
  };
  await redis(['LPUSH', CHAT_KEY, JSON.stringify(message)], env);
  await redis(['LTRIM', CHAT_KEY, '0', String(MAX_MESSAGES - 1)], env);
  // Drop anything older than 24 hours so the room never keeps stale posts.
  await loadFreshMessages({ redis, env });
  return { ok: true, status: 201, message };
}

/**
 * @param {{ method: string, body?: any, ip?: string, since?: string|null, after?: string|null, redis?: typeof redisCommand, env?: Record<string, string|undefined> }} req
 */
export async function handleChatRequest(req) {
  const method = String(req.method || 'GET').toUpperCase();
  try {
    if (method === 'GET') return await listMessages({ since: req.since, after: req.after, redis: req.redis, env: req.env });
    if (method === 'POST') {
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return { ok: false, status: 400, error: 'Send a display name and a message.' };
      return await postMessage({ name: req.body.name, text: req.body.text, ip: req.ip, redis: req.redis, env: req.env });
    }
    return { ok: false, status: 405, error: 'Use GET or POST.' };
  } catch (error) {
    console.error('workshop chat failed', error);
    return { ok: false, status: 502, error: 'Chat is having a moment. Try again shortly.' };
  }
}
