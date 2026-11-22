// Static server + /api/chat: keyword retrieval over knowledge/*.md, answered by Nemotron on a local llama-server (no API key).
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, 'public'), LLAMA = process.env.LLAMA_URL || 'http://localhost:8080/v1/chat/completions';
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json' };
const MAX_BODY = 20000, CHAT_TIMEOUT = 30000, PORT = Number(process.env.PORT) || 3000;
const send = (res, status, body) => { if (res.headersSent || res.destroyed) return; res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
const STOP = new Set('the and for you what how does can are with that this from have not que como para una los las del por con mas pero'.split(' '));
const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ');
const words = s => norm(s).split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)), stem = w => w.slice(0, 4);
const kb = {};
for (const l of ['en', 'es']) kb[l] = fs.readFileSync(path.join(__dirname, 'knowledge', l + '.md'), 'utf8').split(/^## /m).slice(1).map(c => {
  const [h, ...r] = c.split('\n'), [id, title] = h.split('|').map(x => x.trim()), text = r.join(' ').trim();
  return { id, title, text, st: new Set(words(title + ' ' + text).map(stem)), tt: new Set(words(title).map(stem)) };
});
function retrieve(lang, q, lvl) {
  const ch = kb[lang], qs = [...new Set(words(q).map(stem))];
  const idf = w => Math.log(1 + ch.length / (1 + ch.filter(x => x.st.has(w)).length));
  const score = c => qs.reduce((a, w) => a + (c.st.has(w) ? idf(w) : 0) + (c.tt.has(w) ? idf(w) : 0), 0) - c.title.length * 0.01;
  const cur = ch.find(c => c.id === 'L' + (lvl + 1));
  const all = ch.map(c => [score(c), c]).sort((a, b) => b[0] - a[0]), rest = all.filter(x => x[1] !== cur).slice(0, 2).map(x => x[1]);
  return { ctx: cur ? [cur, ...rest] : rest, best: all[0][0] > 0 ? all[0][1] : cur };
}
function prompt(lang, facts, ctx) {
  const L = lang === 'es' ? 'Spanish' : 'English';
  return `You are Buck, the friendly AI assistant of MoneyMente, a personal financial advisor app. You explain the user's plan, score and goals. Answer ONLY with the CONTEXT and USER STATE below. Reply in ${L}, in at most 4 short sentences, no tables. Never invent numbers: use the numbers in USER STATE. If the answer is not in the context, say you do not cover that and suggest a related topic. Educational only, not financial advice; never recommend specific stocks or products.\n\nUSER STATE: ${JSON.stringify(facts)}\n\nCONTEXT:\n` + ctx.map(c => `[${c.id}] ${c.title}: ${c.text}`).join('\n');
}
async function chat(b) {
  const lang = b.lang === 'es' ? 'es' : 'en', facts = b.facts || {}, { ctx, best } = retrieve(lang, String(b.message || ''), +facts.levelIndex || 0);
  try {
    const r = await fetch(LLAMA, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(CHAT_TIMEOUT),
      body: JSON.stringify({ messages: [{ role: 'system', content: prompt(lang, facts, ctx) }, ...(b.history || []).slice(-4), { role: 'user', content: String(b.message) }],
        max_tokens: 400, temperature: 0.3, chat_template_kwargs: { enable_thinking: false } }) });
    const j = await r.json(), reply = (j.choices[0].message.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^[\s\S]*<\/think>/, '').trim();
    if (!reply) throw new Error('empty');
    return { reply, sources: ctx.map(c => c.id) };
  } catch (e) { return { reply: best.text, sources: ctx.map(c => c.id), fallback: true }; }
}
const server = http.createServer((q, r) => {
  if (q.method === 'POST' && q.url === '/api/chat') {
    let d = '', tooLarge = false;
    q.on('data', c => { d += c; if (Buffer.byteLength(d) > MAX_BODY) { tooLarge = true; send(r, 413, { error: 'Request body too large' }); q.resume(); } });
    return q.on('end', async () => {
      if (tooLarge) return;
      let b; try { b = JSON.parse(d); } catch { return send(r, 400, { error: 'Invalid JSON' }); }
      if (!b || typeof b !== 'object' || Array.isArray(b) || typeof b.message !== 'string' || !b.message.trim()) return send(r, 400, { error: 'A non-empty message is required' });
      const history = Array.isArray(b.history) ? b.history.filter(m => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string').slice(-4) : [];
      const payload = { ...b, history };
      try { send(r, 200, await chat(payload)); } catch { send(r, 502, { error: 'Chat service unavailable' }); }
    });
  }
  let decoded; try { decoded = decodeURIComponent(new URL(q.url, 'http://localhost').pathname); } catch { r.writeHead(400); return r.end('Bad path'); }
  let p = path.normalize(decoded); if (p === '/' || p === '\\') p = '/index.html';
  const f = path.resolve(root, '.' + path.sep + p.replace(/^[/\\]+/, ''));
  if (f !== root && !f.startsWith(root + path.sep)) { r.writeHead(403); return r.end(); }
  fs.readFile(f, (e, data) => { if (e) { r.writeHead(404); return r.end('Not found'); }
    r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(data); });
});
server.requestTimeout = 35000;
server.listen(PORT, () => console.log(`MoneyMente: http://localhost:${PORT}`));
