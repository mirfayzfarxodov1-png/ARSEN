import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');

async function loadEnv() {
  try {
    const source = await readFile(path.join(ROOT, '.env'), 'utf8');
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match || Object.hasOwn(process.env, match[1])) continue;
      let value = match[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      } else {
        value = value.replace(/\s+#.*$/, '');
      }
      process.env[match[1]] = value;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

await loadEnv();

const PORT = Number(process.env.PORT || 3000);
const AI_BASE_URL = (process.env.AI_BASE_URL || '').replace(/\/$/, '');
const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_MODEL = process.env.AI_MODEL || '';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean);
const aiConfigured = Boolean(AI_BASE_URL && AI_API_KEY && AI_MODEL);

const systemPrompt = `You are ARGON V1, the reasoning and orchestration core of ARSEN, a multilingual AI assistant. Respond in the user's selected language. Be accurate, useful and clear. Be honest about capabilities: never claim to have controlled a device, played a game, posted content, called someone, or completed an external action unless a connected tool confirms it. Explain when an integration is not connected. Require explicit confirmation before consequential external actions.`;

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function securityHeaders(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
}

async function readJson(req, maxBytes = 1024 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw Object.assign(new Error('Request body is too large.'), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 }); }
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8'
};

async function serveStatic(urlPath, res) {
  let decoded;
  try { decoded = decodeURIComponent(urlPath); }
  catch { return sendJson(res, 400, { error: 'Invalid URL path.' }); }
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const filePath = path.resolve(PUBLIC, relative);
  if (filePath !== PUBLIC && !filePath.startsWith(PUBLIC + path.sep)) {
    return sendJson(res, 403, { error: 'Forbidden.' });
  }
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw Object.assign(new Error('Not found'), { code: 'ENOENT' });
    const content = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': content.length,
      'Cache-Control': path.extname(filePath) === '.html' ? 'no-cache' : 'public, max-age=3600'
    });
    res.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') return sendJson(res, 404, { error: 'Not found.' });
    throw error;
  }
}

async function handleChat(req, res) {
  const body = await readJson(req);
  const { messages, language = 'en' } = body || {};
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 30) {
    return sendJson(res, 400, { error: 'Send between 1 and 30 messages.' });
  }
  const safeMessages = messages.filter(message =>
    message && ['user', 'assistant'].includes(message.role) &&
    typeof message.content === 'string' && message.content.trim()
  ).map(message => ({ role: message.role, content: message.content.slice(0, 12000) }));
  if (!safeMessages.length) return sendJson(res, 400, { error: 'No valid messages found.' });
  if (!aiConfigured) {
    return sendJson(res, 503, {
      error: 'ARSEN AI provider is not configured.',
      setup: 'Create .env from .env.example and set AI_BASE_URL, AI_API_KEY and AI_MODEL. Keep the API key on the server.'
    });
  }

  try {
    const endpoint = new URL(AI_BASE_URL);
    if (!['https:', 'http:'].includes(endpoint.protocol)) throw new Error('Unsupported provider URL.');
    const response = await fetch(new URL('chat/completions', AI_BASE_URL.endsWith('/') ? AI_BASE_URL : AI_BASE_URL + '/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_API_KEY}` },
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: 0.7,
        messages: [
          { role: 'system', content: `${systemPrompt}\nSelected UI language: ${String(language).slice(0, 20)}.` },
          ...safeMessages
        ]
      }),
      signal: AbortSignal.timeout(60000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message;
      return sendJson(res, response.status >= 500 ? 502 : response.status, {
        error: typeof message === 'string' ? message.slice(0, 500) : 'The AI provider returned an error.'
      });
    }
    const answer = data?.choices?.[0]?.message?.content;
    if (typeof answer !== 'string' || !answer.trim()) {
      return sendJson(res, 502, { error: 'The AI provider returned an empty response.' });
    }
    return sendJson(res, 200, { answer: answer.trim(), model: AI_MODEL });
  } catch (error) {
    const timedOut = error.name === 'TimeoutError' || error.name === 'AbortError';
    return sendJson(res, 502, { error: timedOut ? 'AI request timed out.' : 'Could not reach the AI provider. Check the provider URL and server connection.' });
  }
}

const server = createServer(async (req, res) => {
  securityHeaders(req, res);
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
      return res.end();
    }
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return sendJson(res, 200, {
        ok: true, name: 'ARSEN', core: 'ARGON V1', aiConfigured,
        provider: aiConfigured ? 'configured' : 'not-configured',
        capabilities: ['chat', 'multilingual-ui', 'browser-voice', 'agent-workspace']
      });
    }
    if (req.method === 'POST' && url.pathname === '/api/chat') return await handleChat(req, res);
    if (req.method === 'GET') return await serveStatic(url.pathname, res);
    return sendJson(res, 405, { error: 'Method not allowed.' });
  } catch (error) {
    if (!res.headersSent) sendJson(res, error.status || 500, { error: error.status ? error.message : 'Internal server error.' });
    else res.destroy();
    if (!error.status) console.error('[ARSEN]', error);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[ARSEN / ARGON V1] http://localhost:${PORT}`);
  console.log(`[ARSEN] AI provider: ${aiConfigured ? 'configured' : 'not configured'}`);
});

process.on('SIGINT', () => server.close(() => process.exit(0)));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
