// Buck the $ assistant + chat + voice picker. The chat calls /api/chat (Nemotron on local llama-server, no API key).
let hist = [], busy = false;
function petSay(msg, ms = 6000) { const b = $('#bubble'); b.textContent = msg; b.hidden = false; clearTimeout(petSay.h); petSay.h = setTimeout(() => b.hidden = true, ms); }
const mood = m => document.body.dataset.mood = m || '';
function addMsg(role, text) { const d = document.createElement('div'); d.className = 'm1 ' + role; d.textContent = text; $('#msgs').append(d); $('#msgs').scrollTop = 1e9; return d; }
function facts() {
  if (!S.profileConfirmed) return { profileConfirmed: false, message: t('score_answer_first') };
  const p = P(), b = Engine.budget(S.cats, p.income), steps = Engine.actionPlan(p, b, goalsCalc(p)), sc = Engine.score(p, b), k = Engine.kpis(p), f = fc();
  return { nextStep: steps[0]?.id || 'maintain', healthScore: sc.total, scoreParts: Object.fromEntries(Object.entries(sc.parts).map(([a, v]) => [a, Math.round(v)])),
    income: p.income, expenses: p.expenses, monthlySurplus: k.surplus, savings: p.savings, invested: p.invested, debtTotal: Engine.debtTotal(p.debts), runwayMonths: +k.runway.toFixed(1),
    budget: { needsPct: Math.round(b.pct.needs), wantsPct: Math.round(b.pct.wants), savePct: Math.round(b.pct.save), categories: S.cats.map(c => ({ name: catName(c), amount: num(c.amount), type: c.type })) },
    goals: goalsCalc(p).map(g => ({ name: g.name, target: g.target, saved: g.current, months: g.months, neededPerMonth: Math.round(g.need), plannedPerMonth: Math.round(g.planned), status: g.status })),
    forecast: { lowestBalance: Math.round(f.low.balance), lowestMonth: f.low.ym, deficitMonths: f.deficits } };
}
async function ask(q) {
  q = q.trim(); if (!q || busy) return; busy = true; $('#q').value = ''; addMsg('me', q);
  if (!S.profileConfirmed) { addMsg('bot', t('score_answer_first')); busy = false; return; }
  const w = addMsg('bot', '…'); mood('think');
  try {
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: q, lang, facts: facts(), history: hist.slice(-4) }) });
    const j = await r.json(); w.textContent = j.reply + (j.fallback ? '\n(' + t('offline') + ')' : '');
    hist.push({ role: 'user', content: q }, { role: 'assistant', content: j.reply }); if ($('#auto').checked && canSpeak) say(j.reply);
  } catch { w.textContent = t('offline'); }
  mood(''); busy = false; $('#msgs').scrollTop = 1e9;
}
function buildVoices() {
  if (!canSpeak) return;
  const vs = speechSynthesis.getVoices().filter(v => v.lang.startsWith(lang)), cur = localStorage.getItem('voice_' + lang), s = $('#voice');
  s.replaceChildren(...vs.map(v => { const o = document.createElement('option'); o.textContent = v.name; o.selected = v.name === cur; return o; }));
  $$('.vc').forEach(e => e.hidden = !vs.length);
}
function onLoaded() {
  $('#q').placeholder = t('chat_ph'); $('#q').setAttribute('aria-label', t('chat_t'));
  $('#chips').innerHTML = ['c1', 'c5', 'c4', 'c2'].map(k => `<button class="chip" data-q="${k}">${t(k)}</button>`).join('');
  $('#auto').closest('label').hidden = !canSpeak; buildVoices();
  if (!$('#msgs').children.length) { addMsg('bot', t('hello')); petSay(t('pet_hi')); }
}
if (canSpeak) speechSynthesis.onvoiceschanged = buildVoices;
$('#pet').onclick = () => { const c = $('#chat'); c.hidden = !c.hidden; $('#bubble').hidden = true; if (!c.hidden) $('#q').focus(); };
$('#close').onclick = () => $('#chat').hidden = true;
$('#send').onclick = () => ask($('#q').value);
$('#q').onkeydown = e => { if (e.key === 'Enter') ask($('#q').value); };
$('#chips').onclick = e => { const b = e.target.closest('[data-q]'); if (b) ask(t(b.dataset.q)); };
$('#voice').onchange = e => { localStorage.setItem('voice_' + lang, e.target.value); say(t('voice_test')); };
$('#rate').onchange = () => say(t('voice_test'));
