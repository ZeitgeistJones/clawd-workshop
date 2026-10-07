import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleChatRequest } from '../src/chat-api.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2' };
const port = Number(process.env.PORT || 3000);

async function loadEnvFile() {
  try {
    const text = await readFile(path.join(root, '.env'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch { /* Local .env is optional. */ }
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

await loadEnvFile();

http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, 'http://localhost');
    const requestPath = decodeURIComponent(requestUrl.pathname);

    if (requestPath === '/api/chat' || requestPath === '/api/chat/') {
      const result = await handleChatRequest({
        method: req.method,
        body: req.method === 'POST' ? await readBody(req) : undefined,
        ip: req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket.remoteAddress || 'local',
        since: requestUrl.searchParams.get('since'),
      });
      const payload = result.ok
        ? (result.message ? { message: result.message } : { messages: result.messages })
        : { error: result.error };
      res.writeHead(result.status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(payload));
      return;
    }

    const relative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
    // Serve only the deployable site files, never .env, tests, or other source.
    if (!(relative === 'index.html' || /^(src|public)\//.test(relative)) || relative.split('/').some(part => part.startsWith('.') || part.includes('\\'))) {
      res.writeHead(404); res.end('Not found'); return;
    }
    const absolute = path.resolve(root, relative);
    if (!absolute.startsWith(root + path.sep)) { res.writeHead(403); res.end('Forbidden'); return; }
    const body = await readFile(absolute);
    res.writeHead(200, { 'Content-Type': types[path.extname(absolute)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '0.0.0.0', () => console.log(`Clawd's workshop: http://localhost:${port}`));
