// Server-side @clawd answers. The Gemini key stays here, never in the static page.
import { describeEvent, normalizeEvents } from './activity.js';
import { allowedRepo, buildAskPrompt, readModelAnswer } from './ask.js';
import { appendChatMessage, redisCommand, redisConfigured } from './chat-api.mjs';

const OWNER = 'clawdbotatg';
const ASK_RATE_SECONDS = 12;
const MODEL = 'gemini-3.5-flash-lite';
const memoryRates = new Map();

function memoryAllowed(ip, now = Date.now()) {
  const last = memoryRates.get(ip) || 0;
  if (now - last < ASK_RATE_SECONDS * 1000) return false;
  memoryRates.set(ip, now);
  return true;
}

function safeWebsite(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch { return ''; }
}

async function github(fetcher, path, accept = 'application/vnd.github+json') {
  const response = await fetcher(`https://api.github.com${path}`, {
    headers: {
      Accept: accept,
      'User-Agent': 'clawd-workshop',
      'X-GitHub-Api-Version': '2026-03-10',
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  if (accept === 'application/vnd.github.raw') return response.text();
  return response.json();
}

export async function gatherRepo(repo, fetcher) {
  const [meta, readme, events] = await Promise.all([
    github(fetcher, `/repos/${repo}`),
    github(fetcher, `/repos/${repo}/readme`, 'application/vnd.github.raw'),
    github(fetcher, `/repos/${repo}/events?per_page=20`),
  ]);
  const own = normalizeEvents(Array.isArray(events) ? events : []).filter(event => event.actor?.login?.toLowerCase() === OWNER);
  return {
    found: Boolean(meta && typeof meta === 'object' && !meta.message),
    description: typeof meta?.description === 'string' ? meta.description.slice(0, 500) : '',
    website: safeWebsite(meta?.homepage),
    readme: typeof readme === 'string' ? readme.replace(/\u0000/g, '').slice(0, 3500) : '',
    events: own.slice(0, 6).map(event => {
      const described = describeEvent(event);
      return [described.title, described.detail].filter(Boolean).join(': ');
    }),
  };
}

/**
 * @param {{ method?: string, body?: any, ip?: string, env?: Record<string, string|undefined>, fetcher?: typeof fetch, redis?: Function }} req
 */
export async function handleAskRequest(req) {
  const method = String(req.method || 'GET').toUpperCase();
  if (method !== 'POST') return { ok: false, status: 405, error: 'Use POST.' };
  const env = req.env || process.env;
  const fetcher = req.fetcher || globalThis.fetch;
  if (!env.GEMINI_API_KEY) return { ok: false, status: 503, error: 'Clawd cannot answer on this deployment yet.' };

  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, status: 400, error: 'Send a question and a repository.' };
  const repo = allowedRepo(body.repo);
  const question = typeof body.question === 'string' ? body.question.replace(/\s+/g, ' ').trim().slice(0, 240) : '';
  if (!repo) return { ok: false, status: 400, error: 'Ask about one of this builder’s public repositories.' };
  if (!question) return { ok: false, status: 400, error: 'Ask a question about the repo on the bench.' };

  const ip = String(req.ip || 'unknown').replace(/[^a-zA-Z0-9:._-]/g, '').slice(0, 80) || 'unknown';
  if (!redisConfigured(env) && !memoryAllowed(ip)) return { ok: false, status: 429, error: 'Give me a moment.' };
  if (redisConfigured(env)) {
    const redis = req.redis || redisCommand;
    try {
      const allowed = await redis(['SET', `clawd-workshop:ask:rate:${ip}`, '1', 'NX', 'EX', String(ASK_RATE_SECONDS)], env);
      if (allowed !== 'OK') return { ok: false, status: 429, error: 'Give me a moment.' };
    } catch (error) {
      console.error('ask rate limit failed', error);
      return { ok: false, status: 502, error: 'I could not answer from the public repo just now.' };
    }
  }

  let material;
  try {
    material = await gatherRepo(repo, fetcher);
  } catch (error) {
    console.error('ask repo lookup failed', error);
    return { ok: false, status: 502, error: 'I could not read the public repo just now.' };
  }
  if (!material.found && !material.readme && !material.events.length) {
    return { ok: false, status: 502, error: 'I could not read the public repo just now.' };
  }

  const prompt = buildAskPrompt({ repo, question, ...material });
  const model = /^[a-zA-Z0-9._-]+$/.test(env.GEMINI_MODEL || '') ? env.GEMINI_MODEL : MODEL;
  let payload;
  try {
    const response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 256, thinkingConfig: { thinkingLevel: 'MINIMAL' } },
      }),
      signal: AbortSignal.timeout(15000),
    });
    payload = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = typeof payload?.error?.message === 'string' ? payload.error.message : '';
      console.error('gemini answer failed', response.status, detail.slice(0, 240));
      return { ok: false, status: 502, error: 'I could not answer from the public repo just now.' };
    }
  } catch (error) {
    console.error('gemini answer failed', error);
    return { ok: false, status: 502, error: 'I could not answer from the public repo just now.' };
  }

  const answer = readModelAnswer(payload) || 'I do not know that from the public repo.';
  if (redisConfigured(env)) {
    try {
      await appendChatMessage({ name: 'Clawd', text: answer, redis: req.redis, env });
    } catch (error) {
      console.error('ask chat post failed', error);
    }
  }
  return { ok: true, status: 200, answer };
}
