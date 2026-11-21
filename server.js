// Static server + /api/chat: keyword retrieval over knowledge/*.md, answered by Nemotron on a local llama-server (no API key).
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, 'public'), LLAMA = process.env.LLAMA_URL || 'http://localhost:8080/v1/chat/completions';
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json' };
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
    const r = await fetch(LLAMA, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(120000),
      body: JSON.stringify({ messages: [{ role: 'system', content: prompt(lang, facts, ctx) }, ...(b.history || []).slice(-4), { role: 'user', content: String(b.message) }],
        max_tokens: 400, temperature: 0.3, chat_template_kwargs: { enable_thinking: false } }) });
    const j = await r.json(), reply = (j.choices[0].message.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^[\s\S]*<\/think>/, '').trim();
    if (!reply) throw new Error('empty');
    return { reply, sources: ctx.map(c => c.id) };
  } catch (e) { return { reply: best.text, sources: ctx.map(c => c.id), fallback: true }; }
}
http.createServer((q, r) => {
  if (q.method === 'POST' && q.url === '/api/chat') {
    let d = ''; q.on('data', c => { d += c; if (d.length > 20000) q.destroy(); });
    return q.on('end', async () => { let b = {}; try { b = JSON.parse(d); } catch {}
      r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify(await chat(b))); });
  }
  let p = path.normalize(decodeURIComponent(q.url.split('?')[0])); if (p === '/' || p === '\\') p = '/index.html';
  const f = path.join(root, p); if (!f.startsWith(root)) { r.writeHead(403); return r.end(); }
  fs.readFile(f, (e, data) => { if (e) { r.writeHead(404); return r.end('Not found'); }
    r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(data); });
}).listen(3000, () => console.log('MoneyMente: http://localhost:3000'));
