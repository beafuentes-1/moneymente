// Static server + /api/chat + /api/status: keyword retrieval over knowledge/*.md, answered by Nemotron on a local llama-server (no API key).
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, 'public');
const PORT = Number.isInteger(+process.env.PORT) && +process.env.PORT > 0 ? +process.env.PORT : 3000;
const MAX_BODY = 20000;
const LLAMA_URLS = process.env.LLAMA_URL ? [process.env.LLAMA_URL] : ['http://127.0.0.1:8080/v1/chat/completions', 'http://127.0.0.1:9931/v1/chat/completions'];
let activeLlama = LLAMA_URLS[0];
async function resolveLlama() {
  for (const u of LLAMA_URLS) {
    try { const r = await fetch(u.replace(/\/v1\/chat\/completions$/, '/health'), { signal: AbortSignal.timeout(1200) }); if (r.ok) return (activeLlama = u); } catch {}
  }
  return null;
}
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
function prompt(lang, facts, ctx, mode) {
  const L = lang === 'es' ? 'Spanish' : 'English';
  if (mode === 'report') {
    return `You are Buck, the AI financial analyst of MoneyMente. Write an executive summary for the user's printable financial report in ${L} (4-5 concise sentences, no markdown tables). Highlight: (1) their financial health score and strongest area, (2) their debt payoff or savings runway status using exact numbers from USER STATE, (3) any 12-month forecast risks or goal gaps, and (4) their single highest-impact next move. Educational only, not financial advice.\n\nUSER STATE: ${JSON.stringify(facts)}`;
  }
  return `You are Buck, the friendly AI assistant of MoneyMente, a personal financial advisor app. You explain the user's plan, score, debts (including snowball vs avalanche payoff months and interest saved) and goals. Answer ONLY with the CONTEXT and USER STATE below. Reply in ${L}, in at most 4 short sentences, no tables. Never invent numbers: use the exact numbers in USER STATE. If the user asks to change, add, or simulate ("what if") a budget category, income, savings, invested amount, extra debt payment, goal, debt, or special item, answer their question AND append a final line starting with ACTION_JSON: followed by a valid JSON object matching one of: {"type":"set_category","name":"<category name>","amount":<number>} | {"type":"set_field","field":"income"|"savings"|"invested"|"extra","amount":<number>} | {"type":"add_goal","name":"<name>","target":<number>,"months":<number>} | {"type":"add_special","name":"<name>","ym":"YYYY-MM","amount":<number>,"kind":"exp"|"inc"} | {"type":"add_debt","name":"<name>","balance":<number>,"rate":<number>,"min":<number>}. Only include ACTION_JSON when the user asks to update or simulate a change. If the answer is not in the context or user state, say you do not cover that and suggest a related topic. Educational only, not financial advice; never recommend specific stocks or products.\n\nUSER STATE: ${JSON.stringify(facts)}\n\nCONTEXT:\n` + ctx.map(c => `[${c.id}] ${c.title}: ${c.text}`).join('\n');
}
function parseOutput(raw, reasoningField) {
  let thinking = (reasoningField || '').trim(), text = String(raw || '');
  const m = text.match(/<think>([\s\S]*?)<\/think>/i);
  if (m) thinking = (thinking ? thinking + '\n' : '') + m[1].trim();
  else {
    const u = text.match(/<think>([\s\S]*)$/i);
    if (u) thinking = (thinking ? thinking + '\n' : '') + u[1].trim();
  }
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^[\s\S]*?<\/think>/i, '').replace(/<think>[\s\S]*$/i, '').trim();
  let action = null;
  const am = text.match(/ACTION_JSON:\s*(\{[\s\S]*?\})\s*$/i);
  if (am) {
    try { action = JSON.parse(am[1]); text = text.slice(0, am.index).trim(); } catch {}
  }
  return { reply: text, thinking, action };
}
function buildPayload(b) {
  const lang = b.lang === 'es' ? 'es' : 'en', facts = b.facts || {}, think = !!b.think, mode = b.mode || 'chat';
  const { ctx, best } = retrieve(lang, String(b.message || ''), +facts.levelIndex || 0);
  const body = {
    messages: [{ role: 'system', content: prompt(lang, facts, ctx, mode) }, ...(b.history || []).slice(-4), { role: 'user', content: String(b.message || '') }],
    max_tokens: think ? 900 : 400,
    temperature: 0.3,
    cache_prompt: true,
    chat_template_kwargs: { enable_thinking: think }
  };
  return { body, ctx, best };
}
async function chat(b) {
  const { body, ctx, best } = buildPayload(b);
  try {
    const url = (await resolveLlama()) || activeLlama;
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(120000), body: JSON.stringify(body) });
    const j = await r.json(), msg = j.choices?.[0]?.message || {};
    const { reply, thinking, action } = parseOutput(msg.content, msg.reasoning_content);
    if (!reply) throw new Error('empty');
    return { reply, thinking, action, sources: ctx.map(c => c.id) };
  } catch (e) { return { reply: best.text, sources: ctx.map(c => c.id), fallback: true }; }
}
async function streamChat(b, res) {
  const { body, ctx, best } = buildPayload(b);
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const send = obj => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  try {
    const url = (await resolveLlama()) || activeLlama;
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(120000), body: JSON.stringify({ ...body, stream: true }) });
    if (!r.ok || !r.body) throw new Error('bad_upstream');
    let rawContent = '', rawReasoning = '', buf = '';
    const dec = new TextDecoder();
    for await (const chunk of r.body) {
      buf += dec.decode(chunk, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const ln of lines) {
        const s = ln.trim(); if (!s.startsWith('data:')) continue;
        const d = s.slice(5).trim(); if (d === '[DONE]') continue;
        try {
          const j = JSON.parse(d), delta = j.choices?.[0]?.delta || {};
          if (delta.reasoning_content) rawReasoning += delta.reasoning_content;
          if (delta.content) rawContent += delta.content;
          const cur = parseOutput(rawContent, rawReasoning);
          send({ type: 'delta', reply: cur.reply, thinking: cur.thinking });
        } catch {}
      }
    }
    const fin = parseOutput(rawContent, rawReasoning);
    if (!fin.reply) throw new Error('empty');
    send({ type: 'done', ...fin, sources: ctx.map(c => c.id) });
  } catch {
    send({ type: 'done', reply: best.text, sources: ctx.map(c => c.id), fallback: true });
  }
  res.end();
}
async function status() {
  const u = await resolveLlama();
  return { online: !!u, url: u, model: 'Nemotron 3 Nano 4B' };
}
http.createServer(async (q, r) => {
  const sendJson = (status, body) => { r.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); r.end(JSON.stringify(body)); };
  if (q.method === 'GET' && q.url === '/api/status') {
    return sendJson(200, await status());
  }
  if (q.method === 'POST' && q.url === '/api/chat') {
    let d = '', tooLarge = false;
    q.on('data', c => { d += c; if (Buffer.byteLength(d) > MAX_BODY) { tooLarge = true; sendJson(413, { error: 'request_too_large' }); q.destroy(); } });
    return q.on('end', async () => {
      if (tooLarge || r.writableEnded) return;
      let b; try { b = JSON.parse(d); } catch { return sendJson(400, { error: 'invalid_json' }); }
      if (!b || Array.isArray(b) || typeof b !== 'object' || typeof b.message !== 'string' || !b.message.trim()) return sendJson(400, { error: 'message_required' });
      b.message = b.message.trim().slice(0, 4000);
      b.history = Array.isArray(b.history) ? b.history.filter(x => x && ['user', 'assistant'].includes(x.role) && typeof x.content === 'string').slice(-4).map(x => ({ role: x.role, content: x.content.slice(0, 4000) })) : [];
      if (b.facts && typeof b.facts === 'object' && !Array.isArray(b.facts)) {
        b.facts = { ...b.facts };
        if (b.facts.quizCompleted !== true) { b.facts.healthScore = null; b.facts.scoreParts = null; }
      } else b.facts = {};
      if (b.stream) return streamChat(b, r);
      return sendJson(200, await chat(b));
    });
  }
  let decoded; try { decoded = decodeURIComponent((q.url || '/').split('?')[0]); } catch { r.writeHead(400); return r.end('Bad path'); }
  const p = decoded === '/' || decoded === '\\' ? 'index.html' : decoded.replace(/^[/\\]+/, '');
  const f = path.resolve(root, p); if (f !== root && !f.startsWith(root + path.sep)) { r.writeHead(403); return r.end(); }
  fs.readFile(f, (e, data) => { if (e) { r.writeHead(404); return r.end('Not found'); }
    r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(data); });
}).listen(PORT, () => console.log(`MoneyMente: http://localhost:${PORT}`));
