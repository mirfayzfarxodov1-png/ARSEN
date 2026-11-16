import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);
const AI_BASE_URL = (process.env.AI_BASE_URL || '').replace(/\/$/, '');
const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_MODEL = process.env.AI_MODEL || '';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean);

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('tiny'));
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

const systemPrompt = `You are ARGON V1, the reasoning and orchestration core of ARSEN, a multilingual public AI assistant. Respond in the user's selected language. Be honest about capabilities: never claim to have controlled a device, played a game, posted content, called someone, or completed an external action unless a connected tool actually confirms it. Explain when an integration is not connected. For any consequential external action, require explicit user confirmation. Be helpful, clear, and safe.`;

app.get('/api/health', (_req, res) => res.json({
  ok: true,
  name: 'ARSEN',
  core: 'ARGON V1',
  aiConfigured: Boolean(AI_BASE_URL && AI_API_KEY && AI_MODEL),
  capabilities: ['chat', 'multilingual-ui', 'browser-voice', 'agent-workspace']
}));

app.post('/api/chat', async (req, res) => {
  const { messages, language = 'en' } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 30) {
    return res.status(400).json({ error: 'Send between 1 and 30 messages.' });
  }
  const safeMessages = messages.filter(m =>
    m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string'
  ).map(m => ({ role: m.role, content: m.content.slice(0, 12000) }));
  if (!safeMessages.length) return res.status(400).json({ error: 'No valid messages found.' });

  if (!AI_BASE_URL || !AI_API_KEY || !AI_MODEL) {
    return res.status(503).json({
      error: 'ARGON AI provider is not configured yet.',
      setup: 'Add AI_BASE_URL, AI_API_KEY and AI_MODEL to your server .env file. Keep the API key on the server; never put it in browser code.'
    });
  }

  try {
    const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_API_KEY}` },
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: 0.7,
        messages: [{ role: 'system', content: `${systemPrompt}\nSelected UI language: ${String(language).slice(0, 20)}.` }, ...safeMessages]
      }),
      signal: AbortSignal.timeout(60000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status >= 500 ? 502 : response.status).json({
        error: data?.error?.message || 'The AI provider returned an error.'
      });
    }
    const answer = data?.choices?.[0]?.message?.content;
    if (typeof answer !== 'string' || !answer.trim()) return res.status(502).json({ error: 'The AI provider returned an empty response.' });
    res.json({ answer, model: AI_MODEL });
  } catch (error) {
    res.status(502).json({ error: error.name === 'TimeoutError' ? 'AI request timed out.' : 'Could not reach the AI provider.' });
  }
});

app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`[ARSEN / ARGON V1] http://localhost:${PORT}`));