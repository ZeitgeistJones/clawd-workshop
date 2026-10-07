// Vercel serverless endpoint for the public workshop chat.
import { handleChatRequest } from '../src/chat-api.mjs';

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
  const since = typeof req.query?.since === 'string' ? req.query.since : null;
  const result = await handleChatRequest({ method: req.method, body, ip: clientIp(req), since });
  if (result.ok) {
    res.status(result.status).json(result.message ? { message: result.message } : { messages: result.messages });
    return;
  }
  res.status(result.status).json({ error: result.error });
}
