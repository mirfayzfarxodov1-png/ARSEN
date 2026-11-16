import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { answerFromKnowledge } from './src/knowledge.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const LOCAL_MODEL_URL = (process.env.LOCAL_MODEL_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const LOCAL_MODEL_NAME = process.env.LOCAL_MODEL_NAME || 'qwen2.5:0.5b';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean);

async function loadEnv() {
  try {
    const source = await readFile(path.join(ROOT, '.env'), 'utf8');
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match || Object.hasOwn(process.env, match[1])) continue;
      let value = match[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      else value = value.replace(/\s+#.*$/, '');
      process.env[match[1]] = value;
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
await loadEnv();

const PORT = Number(process.env.PORT || 3000);
const systemPrompt = 'You are ARSEN, a helpful local-first assistant. Answer in the user selected language. Be accurate, explain uncertainty, and never claim to perform an action unless a connected tool confirms it. Do not request passwords, API keys, or private credentials.';

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store' });
  res.end(body);
}
function securityHeaders(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
}
async function readJson(req, maxBytes = 1024 * 1024) {
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > maxBytes) throw Object.assign(new Error('Request body is too large.'), { status: 413 }); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 }); }
}
const mimeTypes = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8' };
async function serveStatic(urlPath, res) {
  let decoded; try { decoded = decodeURIComponent(urlPath); } catch { return sendJson(res,400,{error:'Invalid URL path.'}); }
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const filePath = path.resolve(PUBLIC, relative);
  if (filePath !== PUBLIC && !filePath.startsWith(PUBLIC + path.sep)) return sendJson(res,403,{error:'Forbidden.'});
  try {
    const info = await stat(filePath); if (!info.isFile()) throw Object.assign(new Error('Not found'),{code:'ENOENT'});
    const content = await readFile(filePath);
    res.writeHead(200,{'Content-Type':mimeTypes[path.extname(filePath).toLowerCase()]||'application/octet-stream','Content-Length':content.length,'Cache-Control':path.extname(filePath)==='.html'?'no-cache':'public, max-age=3600'});
    res.end(content);
  } catch(error) { if(error.code==='ENOENT')return sendJson(res,404,{error:'Not found.'}); throw error; }
}
async function detectLocalModel() {
  try {
    const response = await fetch(new URL('/api/tags', LOCAL_MODEL_URL), { signal: AbortSignal.timeout(1200) });
    if (!response.ok) return false;
    const data = await response.json();
    return Array.isArray(data.models) && data.models.some(model => model.name === LOCAL_MODEL_NAME || model.name?.startsWith(LOCAL_MODEL_NAME + ':'));
  } catch { return false; }
}
async function askLocalModel(messages, language) {
  const response = await fetch(new URL('/api/chat', LOCAL_MODEL_URL), {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ model:LOCAL_MODEL_NAME, stream:false, messages:[
      {role:'system',content:systemPrompt + '\nSelected language: ' + String(language).slice(0,20) + '. If you do not know, say so.'},
      ...messages
    ]}),
    signal:AbortSignal.timeout(120000)
  });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(data.error || 'Local model request failed.');
  const answer = data?.message?.content;
  if (typeof answer !== 'string' || !answer.trim()) throw new Error('Local model returned an empty answer.');
  return answer.trim();
}
async function handleChat(req,res) {
  const body = await readJson(req);
  const {messages,language='en'} = body || {};
  if(!Array.isArray(messages)||messages.length<1||messages.length>30)return sendJson(res,400,{error:'Send between 1 and 30 messages.'});
  const safeMessages=messages.filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string'&&m.content.trim()).map(m=>({role:m.role,content:m.content.slice(0,12000)}));
  if(!safeMessages.length)return sendJson(res,400,{error:'No valid messages found.'});
  const latest=safeMessages.filter(m=>m.role==='user').at(-1)?.content || '';
  try {
    if (await detectLocalModel()) {
      const answer=await askLocalModel(safeMessages.slice(-16),language);
      return sendJson(res,200,{answer,engine:'local-model',model:LOCAL_MODEL_NAME});
    }
  } catch(error) {
    console.warn('[ARSEN] Local model unavailable; using built-in knowledge:',error.message);
  }
  const answer=answerFromKnowledge(latest,language);
  return sendJson(res,200,{answer,engine:'built-in-knowledge',model:'ARGON Knowledge Core'});
}
const server=createServer(async(req,res)=>{
  securityHeaders(req,res);
  try{
    const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
    if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'});return res.end();}
    if(req.method==='GET'&&url.pathname==='/api/health'){
      const localModelAvailable=await detectLocalModel();
      return sendJson(res,200,{ok:true,name:'ARSEN',core:'ARGON V2 LOCAL',aiConfigured:false,localCoreReady:true,localModelAvailable,model:localModelAvailable?LOCAL_MODEL_NAME:null,provider:'local-only',capabilities:['built-in-knowledge','local-model-optional','multilingual-chat','browser-voice','knowledge-search']});
    }
    if(req.method==='POST'&&url.pathname==='/api/chat')return await handleChat(req,res);
    if(req.method==='GET')return await serveStatic(url.pathname,res);
    return sendJson(res,405,{error:'Method not allowed.'});
  }catch(error){if(!res.headersSent)sendJson(res,error.status||500,{error:error.status?error.message:'Internal server error.'});else res.destroy();if(!error.status)console.error('[ARSEN]',error);}
});
server.listen(PORT,'127.0.0.1',()=>{console.log(`[ARSEN / ARGON V2 LOCAL] http://localhost:${PORT}`);console.log('[ARSEN] External AI providers: disabled. Built-in knowledge: ready.');console.log(`[ARSEN] Optional local model: ${LOCAL_MODEL_NAME} via ${LOCAL_MODEL_URL}`);});
process.on('SIGINT',()=>server.close(()=>process.exit(0)));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
