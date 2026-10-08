// Vercel endpoint for @clawd. The Gemini key is read from the deployment environment.
import { handleAskRequest } from '../src/ask-api.mjs';

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body || '{}'); } catch { body = {}; }
  }
  const result = await handleAskRequest({ method: req.method, body, ip: clientIp(req) });
  if (result.ok) {
    res.status(result.status).json({ answer: result.answer });
    return;
  }
  res.status(result.status).json({ error: result.error });
}
