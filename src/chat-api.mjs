// Shared workshop chat helpers — Upstash Redis REST, no npm package.
// Keys are namespaced so this can share a Redis DB with other apps.

export const CHAT_KEY = 'clawd-workshop:chat:messages';
export const MAX_MESSAGES = 80;
export const MAX_NAME = 20;
export const MAX_TEXT = 240;
export const RATE_SECONDS = 3;

/** @param {string} raw */
export function cleanName(raw) {
  const name = String(raw || '').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  if (!name || name.length > MAX_NAME) return null;
  if (!/^[\p{L}\p{N} _.'-]+$/u.test(name)) return null;
  return name;
}

/** @param {string} raw */
export function cleanText(raw) {
  const text = String(raw || '').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  if (!text || text.length > MAX_TEXT) return null;
  return text;
}

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
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Redis error ${response.status}`);
  return payload.result;
}

function rateKey(ip) {
  const safe = String(ip || 'unknown').replace(/[^a-zA-Z0-9:._-]/g, '').slice(0, 80) || 'unknown';
  return `clawd-workshop:chat:rate:${safe}`;
}

/**
 * @param {{ redis?: typeof redisCommand, env?: Record<string, string|undefined>, since?: string|null }} [opts]
 */
export async function listMessages(opts = {}) {
  const redis = opts.redis || redisCommand;
  const env = opts.env || process.env;
  if (!redisConfigured(env)) return { ok: false, status: 503, error: 'Chat is not configured on this deployment.' };
  const rows = await redis(['LRANGE', CHAT_KEY, '0', String(MAX_MESSAGES - 1)], env);
  const sinceMs = opts.since ? Date.parse(opts.since) : NaN;
  const messages = (Array.isArray(rows) ? rows : [])
    .map(row => { try { return JSON.parse(row); } catch { return null; } })
    .filter(Boolean)
    .filter(m => !Number.isFinite(sinceMs) || Date.parse(m.at) > sinceMs)
    .reverse();
  return { ok: true, status: 200, messages };
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

  const hits = await redis(['INCR', rateKey(input.ip)], env);
  if (Number(hits) === 1) await redis(['EXPIRE', rateKey(input.ip), String(RATE_SECONDS)], env);
  if (Number(hits) > 1) return { ok: false, status: 429, error: 'Slow down a second — the workshop is listening.' };

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
 * @param {{ method: string, body?: any, ip?: string, since?: string|null, redis?: typeof redisCommand, env?: Record<string, string|undefined> }} req
 */
export async function handleChatRequest(req) {
  const method = String(req.method || 'GET').toUpperCase();
  try {
    if (method === 'GET') return await listMessages({ since: req.since, redis: req.redis, env: req.env });
    if (method === 'POST') return await postMessage({ name: req.body?.name, text: req.body?.text, ip: req.ip, redis: req.redis, env: req.env });
    return { ok: false, status: 405, error: 'Use GET or POST.' };
  } catch (error) {
    console.error('workshop chat failed', error);
    return { ok: false, status: 502, error: 'Chat is having a moment. Try again shortly.' };
  }
}
