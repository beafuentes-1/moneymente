// Buck the $ assistant + chat + voice picker + streaming SSE + Deep Think + structured plan actions.
let hist = [], busy = false;
function petSay(msg, ms = 6000) { const b = $('#bubble'); b.textContent = msg; b.hidden = false; clearTimeout(petSay.h); petSay.h = setTimeout(() => b.hidden = true, ms); }
const mood = m => document.body.dataset.mood = m || '';
function addMsg(role, text) { const d = document.createElement('div'); d.className = 'm1 ' + role; d.textContent = text; $('#msgs').append(d); $('#msgs').scrollTop = 1e9; return d; }
function facts() {
  const p = P(), b = Engine.budget(S.cats, p.income), cur = Engine.levels(LP()).indexOf(false), sc = Engine.score(p, b, S.quiz), k = Engine.kpis(p), f = fc();
  const extra = S.extra === '' ? Math.round(Math.max(0, k.surplus)) : num(S.extra);
  const sn = Engine.payoff(p.debts, extra, 'snowball'), av = Engine.payoff(p.debts, extra, 'avalanche');
  const hr = hrows(), hh = hr.filter(r => r.has), plan = Engine.actionPlan(p, goalsCalc(p)).map(step => ({ ...step, ...planCopy(step) }));
  return { levelIndex: cur, nextStep: plan[0] ? `${plan[0].title}: ${plan[0].description}` : t('l' + (cur + 1) + 't'), actionPlan: plan, healthScore: sc.quizDone ? sc.total : null, quizCompleted: sc.quizDone, quizAnswers: S.quiz,
    scoreParts: Object.fromEntries(Object.entries(sc.parts).map(([a, v]) => [a, Math.round(v)])),
    income: p.income, expenses: p.expenses, monthlySurplus: k.surplus, savings: p.savings, invested: p.invested, debtTotal: Engine.debtTotal(p.debts), runwayMonths: +k.runway.toFixed(1),
    debts: S.debts.map(d => ({ name: d.name || t('debts'), balance: num(d.balance), rate: num(d.rate), min: num(d.min) })),
    debtPayoff: { extraMonthly: extra, snowball: { months: sn.months, interest: Math.round(sn.interest), ok: sn.ok }, avalanche: { months: av.months, interest: Math.round(av.interest), ok: av.ok },
      avalancheSavesInterest: (sn.ok && av.ok) ? Math.max(0, Math.round(sn.interest - av.interest)) : 0, avalancheSavesMonths: (sn.ok && av.ok) ? Math.max(0, sn.months - av.months) : 0 },
    budget: { needsPct: Math.round(b.pct.needs), wantsPct: Math.round(b.pct.wants), savePct: Math.round(b.pct.save), categories: S.cats.map(c => ({ name: catName(c), amount: num(c.amount), type: c.type })) },
    goals: goalsCalc(p).map(g => ({ name: g.name, target: g.target, saved: g.current, months: g.months, neededPerMonth: Math.round(g.need), plannedPerMonth: Math.round(g.planned), status: g.status })),
    specialItems: S.special.map(s => ({ name: s.name, ym: s.ym, kind: s.kind, amount: num(s.amount), freq: s.freq || 'once' })),
    sinkingFund: f.sink,
    storedYearLedger: { year: S.ledgerYear, monthsLogged: hh.length, totalIncome: hr.reduce((s, r) => s + r.income, 0), totalExpenses: hr.reduce((s, r) => s + r.expenses, 0) },
    multiYearOutlook: f.rollup,
    actionTasks: (S.actions || []).map(a => ({ title: a.title, ym: a.ym, amount: num(a.amount), done: !!a.done })),
    userPersona: S.profile && Object.values(S.profile).some(Boolean) ? { ...S.profile, similarityPct: typeof spResult === 'object' && spResult ? spResult.similarPct : null, specialPct: typeof spResult === 'object' && spResult ? spResult.specialPct : null } : null,
    forecast: { horizonMonths: +S.horizon || 36, lowestBalance: Math.round(f.low.balance), lowestMonth: f.low.ym, deficitMonths: f.deficits } };
}
function applyPlanAction(act) {
  if (!act || !act.type) return false;
  if (act.type === 'set_field' && ['income', 'savings', 'invested', 'extra'].includes(act.field)) {
    S[act.field] = num(act.amount);
  } else if (act.type === 'set_category' && act.name) {
    const q = String(act.name).toLowerCase();
    const c = S.cats.find(x => catName(x).toLowerCase() === q || (x.key && x.key.toLowerCase() === q) || catName(x).toLowerCase().includes(q));
    if (c) c.amount = num(act.amount); else S.cats.push({ name: act.name, amount: num(act.amount), type: act.kind === 'need' ? 'need' : 'want' });
  } else if (act.type === 'add_goal' && act.name) {
    S.goals.push({ name: act.name, target: num(act.target), current: num(act.current), date: Engine.addMonths(nowYM(), Math.max(1, num(act.months) || 12)), monthly: act.monthly ? num(act.monthly) : '' });
  } else if (act.type === 'add_special' && act.name) {
    S.special.push({ name: act.name, ym: /^\d{4}-\d{2}$/.test(act.ym) ? act.ym : Engine.addMonths(nowYM(), 1), amount: num(act.amount), kind: act.kind === 'inc' ? 'inc' : 'exp', freq: ['once', 'yearly', 'quarterly', 'monthly'].includes(act.freq) ? act.freq : 'once' });
  } else if (act.type === 'add_debt' && act.name) {
    S.debts.push({ name: act.name, balance: num(act.balance), rate: num(act.rate), min: num(act.min) });
  } else if (act.type === 'add_action' && act.title) {
    S.actions.push({ title: act.title, ym: /^\d{4}-\d{2}$/.test(act.ym) ? act.ym : Engine.addMonths(nowYM(), 1), amount: num(act.amount), done: false });
  } else return false;
  drawLists(); renderAll(); return true;
}
function renderBotMsg(el, reply, thinking, action, fallback) {
  el.innerHTML = '';
  if (thinking) {
    const dt = document.createElement('details'); dt.className = 'thk';
    const sm = document.createElement('summary'); sm.textContent = '🧠 ' + t('thk_sum');
    const body = document.createElement('div'); body.textContent = thinking;
    dt.append(sm, body); el.append(dt);
  }
  const txt = document.createElement('div');
  txt.textContent = (reply || '…') + (fallback ? '\n(' + t('offline') + ')' : '');
  el.append(txt);
  if (action && action.type) {
    const btn = document.createElement('button'); btn.className = 'act-btn'; btn.textContent = t('act_apply');
    btn.onclick = () => { if (applyPlanAction(action)) { btn.textContent = t('act_done'); btn.disabled = true; } };
    el.append(btn);
  }
  $('#msgs').scrollTop = 1e9;
}
async function checkAiStatus() {
  const badge = $('#ai-st'); if (!badge) return;
  try {
    const j = await (await fetch('/api/status')).json();
    badge.textContent = j.online ? t('ai_on') : t('ai_off');
    badge.classList.toggle('on', !!j.online);
  } catch { badge.textContent = t('ai_off'); badge.classList.remove('on'); }
}
async function ask(q) {
  q = q.trim(); if (!q || busy) return; busy = true; $('#q').value = ''; addMsg('me', q); const w = addMsg('bot', '…'); mood('think');
  const think = !!$('#think')?.checked;
  let finalReply = '', finalThinking = '', finalAction = null, isFallback = false;
  try {
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: q, lang, facts: facts(), history: hist.slice(-4), think, stream: true }) });
    if (r.headers.get('content-type')?.includes('text/event-stream') && r.body) {
      let buf = ''; const dec = new TextDecoder();
      for await (const chunk of r.body) {
        buf += dec.decode(chunk, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop();
        for (const ln of lines) {
          if (!ln.startsWith('data:')) continue;
          try {
            const ev = JSON.parse(ln.slice(5).trim());
            if (ev.type === 'delta') {
              finalReply = ev.reply || finalReply; finalThinking = ev.thinking || finalThinking;
              renderBotMsg(w, finalReply, finalThinking, null, false);
            } else if (ev.type === 'done') {
              finalReply = ev.reply || finalReply; finalThinking = ev.thinking || finalThinking;
              finalAction = ev.action || null; isFallback = !!ev.fallback;
              renderBotMsg(w, finalReply, finalThinking, finalAction, isFallback);
            }
          } catch {}
        }
      }
    } else {
      const j = await r.json();
      finalReply = j.reply; finalThinking = j.thinking; finalAction = j.action; isFallback = !!j.fallback;
      renderBotMsg(w, finalReply, finalThinking, finalAction, isFallback);
    }
    if (finalReply) {
      hist.push({ role: 'user', content: q }, { role: 'assistant', content: finalReply });
      if ($('#auto').checked && canSpeak) say(finalReply);
    }
    checkAiStatus();
  } catch { w.textContent = t('offline'); checkAiStatus(); }
  mood(''); busy = false; $('#msgs').scrollTop = 1e9;
}
window.genReportSummary = async function () {
  const btn = $('#aisum'), box = $('#ai-sum-box'), txt = $('#ai-sum-txt');
  if (!box || !txt) return;
  box.hidden = false; txt.textContent = t('r_ai_wait'); if (btn) btn.disabled = true;
  try {
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Generate my executive financial report summary.', lang, facts: facts(), mode: 'report', think: false }) });
    const j = await r.json();
    S.aiSummary = j.reply; txt.textContent = j.reply; persist();
  } catch { txt.textContent = t('offline'); }
  if (btn) btn.disabled = false;
};
function buildVoices() {
  if (!canSpeak) return;
  const vs = speechSynthesis.getVoices().filter(v => v.lang.startsWith(lang)), cur = localStorage.getItem('voice_' + lang), s = $('#voice');
  s.replaceChildren(...vs.map(v => { const o = document.createElement('option'); o.textContent = v.name; o.selected = v.name === cur; return o; }));
  $$('.vc').forEach(e => e.hidden = !vs.length);
}
function onLoaded() {
  $('#q').placeholder = t('chat_ph'); $('#q').setAttribute('aria-label', t('chat_t'));
  $('#thk-lbl')?.setAttribute('title', t('thk_tip'));
  $('#chips').innerHTML = ['c1', 'c5', 'c4', 'c2'].map(k => `<button class="chip" data-q="${k}">${t(k)}</button>`).join('');
  $('#auto').closest('label').hidden = !canSpeak; buildVoices(); checkAiStatus();
  if (!$('#msgs').children.length) { addMsg('bot', t('hello')); petSay(t('pet_hi')); }
}
if (canSpeak) speechSynthesis.onvoiceschanged = buildVoices;
$('#pet').onclick = () => { const c = $('#chat'); c.hidden = !c.hidden; $('#bubble').hidden = true; if (!c.hidden) { $('#q').focus(); checkAiStatus(); } };
$('#close').onclick = () => $('#chat').hidden = true;
$('#send').onclick = () => ask($('#q').value);
$('#q').onkeydown = e => { if (e.key === 'Enter') ask($('#q').value); };
$('#chips').onclick = e => { const b = e.target.closest('[data-q]'); if (b) ask(t(b.dataset.q)); };
$('#voice').onchange = e => { localStorage.setItem('voice_' + lang, e.target.value); say(t('voice_test')); };
$('#rate').onchange = () => say(t('voice_test'));
