const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
let T = {}, lang = ((localStorage.getItem('lang') || navigator.language || 'en').slice(0, 2)) === 'es' ? 'es' : 'en';
let tab = 'overview', gsel = 0, touring = false, nextText = '';
const canSpeak = 'speechSynthesis' in window, KEY = 'moneymente.v1', DEMO_BACKUP_KEY = 'moneymente.demoBackup.v1';
const THEME_KEY = 'moneymente.theme', themeMedia = window.matchMedia?.('(prefers-color-scheme: dark)');
function applyTheme(choice = 'system') {
  const selected = ['light', 'dark', 'system'].includes(choice) ? choice : 'system';
  document.documentElement.dataset.theme = selected === 'system' ? (themeMedia?.matches ? 'dark' : 'light') : selected;
  const picker = $('#theme'); if (picker) picker.value = selected;
  try { localStorage.setItem(THEME_KEY, selected); } catch {}
}
try { applyTheme(localStorage.getItem(THEME_KEY) || 'system'); } catch { applyTheme('system'); }
themeMedia?.addEventListener?.('change', () => { if ((localStorage.getItem(THEME_KEY) || 'system') === 'system') applyTheme('system'); });
const nowYM = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const num = x => Math.max(0, +x || 0);
const esc = s => String(s ?? '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const t = (k, v = {}) => String(T[k] ?? k).replace(/\{(\w+)\}/g, (_, x) => v[x]);
const planCopy = step => {
  const detail = step.id === 'deficit' ? { n: money(step.amount) } : step.id === 'debt' ? { n: money(step.amount), r: step.rate } : step.id === 'goals' ? { n: money(step.amount), g: step.name || t('g_unnamed') } : { n: money(step.amount) };
  return { title: t('plan_' + step.id), description: t('plan_' + step.id + '_d', detail) };
};
const legacyTaskKeys = {
  'Track all 12 months of income & expenses in the Year Ledger': 'task_ledger',
  'Automate monthly payday transfer to emergency savings': 'task_automate',
  'Schedule annual & future-year expenses (holidays, taxes, repairs)': 'task_annual',
  'Build $1,000 starter emergency fund': 'demo_starter',
  'Attack 28% credit card using Avalanche method': 'demo_debt',
  'Set aside monthly sinking fund for annual Holiday & Tuition expenses': 'demo_sinking'
};
const actionTitle = a => a.titleKey ? t(a.titleKey, { amount: money(a.amount) }) : legacyTaskKeys[a.title] ? t(legacyTaskKeys[a.title], { amount: money(a.amount) }) : a.title;
const currencyCode = () => ['USD','MXN','CAD','EUR','GBP'].includes(S?.currency) ? S.currency : 'USD';
const money = n => new Intl.NumberFormat(lang === 'es' ? 'es-MX' : 'en-US', { style: 'currency', currency: currencyCode(), maximumFractionDigits: 0 }).format(Math.round(n));
const short = n => new Intl.NumberFormat(lang === 'es' ? 'es-MX' : 'en-US', { style: 'currency', currency: currencyCode(), notation: 'compact', maximumFractionDigits: 1 }).format(Math.round(n));
const mlabel = (ym, long) => {
  const [y, m] = String(ym || '').split('-');
  if (!y || !m) return String(ym || '');
  if (!long) return `${String(+m).padStart(2, '0')}/${String(y).slice(-2)}`;
  const name = new Intl.DateTimeFormat(lang, { month: 'long' }).format(new Date(+y, +m - 1, 1));
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
};
const COL = ['#84cc16', '#06b6d4', '#22c55e', '#38bdf8', '#a3e635', '#14b8a6', '#facc15', '#fb7185', '#a855f7', '#60a5fa'];
const mk = a => a.map(([key, amount, type]) => ({ key, amount, type }));
const curYear = () => new Date().getFullYear();
const PF_SEL = {
  sex: ["Masculino", "Femenino"],
  area: ["rural", "urbano"],
  education_level: ["ninguno", "primaria", "secundaria", "bachillerato", "tecnico", "universitario", "posgrado"],
  household_type: ["unipersonal", "pareja", "nuclear", "extendido", "monoparental"],
  marital_status: ["soltero", "casado", "union_libre", "divorciado", "separado", "viudo"],
  languages_spoken: ["español", "español e inglés", "español y otro idioma"]
};
const PF_SLUG = { 'español': 'es', 'español e inglés': 'es_en', 'español y otro idioma': 'es_other' };
const PF_MUNI = {
  "Ahuachapán": ["Ahuachapán Centro", "Ahuachapán Norte", "Ahuachapán Sur"],
  "Cabañas": ["Cabañas Este", "Cabañas Oeste"],
  "Chalatenango": ["Chalatenango Centro", "Chalatenango Norte", "Chalatenango Sur"],
  "Cuscatlán": ["Cuscatlán Norte", "Cuscatlán Sur"],
  "La Libertad": ["La Libertad Centro", "La Libertad Costa", "La Libertad Este", "La Libertad Norte", "La Libertad Oeste", "La Libertad Sur"],
  "La Paz": ["La Paz Centro", "La Paz Este", "La Paz Oeste"],
  "La Unión": ["La Unión Norte", "La Unión Sur"],
  "Morazán": ["Morazán Norte", "Morazán Sur"],
  "San Miguel": ["San Miguel Centro", "San Miguel Norte", "San Miguel Oeste"],
  "San Salvador": ["San Salvador Centro", "San Salvador Este", "San Salvador Norte", "San Salvador Oeste", "San Salvador Sur"],
  "San Vicente": ["San Vicente Norte", "San Vicente Sur"],
  "Santa Ana": ["Santa Ana Centro", "Santa Ana Este", "Santa Ana Norte", "Santa Ana Oeste"],
  "Sonsonate": ["Sonsonate Centro", "Sonsonate Este", "Sonsonate Norte", "Sonsonate Oeste"],
  "Usulután": ["Usulután Este", "Usulután Norte", "Usulután Oeste"]
};
const PF_EMPTY = () => ({ sex: '', age: '', area: '', education_level: '', household_type: '', marital_status: '', languages_spoken: '', department: '', municipality: '', occupation: '', career_goals_and_ambitions: '' });
const fresh = () => ({ profile: PF_EMPTY(), income: 0, savings: 0, invested: 0, currency: 'USD', demoMode: false, extra: '', ret: { y: 30, r: 7, m: '' }, debts: [], goals: [], special: [], hist: {},
  quiz: { save: '', run: '', debt: '', bal: '', inv: '' }, quizOpen: true, ledgerYear: curYear(), horizon: 36, incGrowth: 3, inflation: 3,
  actions: [{ titleKey: 'task_ledger', title: '', ym: Engine.addMonths(nowYM(), 1), amount: 0, done: false },
    { titleKey: 'task_automate', title: '', ym: Engine.addMonths(nowYM(), 1), amount: 200, done: false },
    { titleKey: 'task_annual', title: '', ym: Engine.addMonths(nowYM(), 3), amount: 0, done: false }],
  cats: mk([['housing', 0, 'need'], ['food', 0, 'need'], ['transport', 0, 'need'], ['utilities', 0, 'need'], ['health', 0, 'need'], ['debts', 0, 'save'], ['savings', 0, 'save'], ['investments', 0, 'save'], ['unexpected', 0, 'need'], ['fun', 0, 'want'], ['shopping', 0, 'want'], ['other', 0, 'want']]) });
function normalizeState(raw) {
  const d = fresh(); if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return d;
  const finite = (v, fallback = 0) => Number.isFinite(+v) && +v >= 0 ? +v : fallback;
  const list = (v, fallback, map) => Array.isArray(v) ? v.filter(x => x && typeof x === 'object' && !Array.isArray(x)).map(map) : fallback;
  const pr = raw.profile && typeof raw.profile === 'object' && !Array.isArray(raw.profile) ? raw.profile : {}, profile = PF_EMPTY();
  for (const k of Object.keys(profile)) {
    const v = typeof pr[k] === 'string' || typeof pr[k] === 'number' ? String(pr[k]) : '';
    profile[k] = PF_SEL[k] ? (PF_SEL[k].includes(v) ? v : '') : k === 'age' ? (Number.isInteger(+v) && +v >= 0 && +v <= 120 && v !== '' ? v : '') : v.slice(0, 1000);
  }
  if (!(PF_MUNI[profile.department] || []).includes(profile.municipality)) profile.municipality = '';
  const s = { ...d, ...raw, profile, currency: ['USD','MXN','CAD','EUR','GBP'].includes(raw.currency) ? raw.currency : 'USD', demoMode: raw.demoMode === true, income: finite(raw.income), savings: finite(raw.savings), invested: finite(raw.invested),
    quiz: { ...d.quiz, ...(raw.quiz && typeof raw.quiz === 'object' ? raw.quiz : {}) }, actions: list(raw.actions, d.actions, x => ({ title: String(x.title || ''), titleKey: Object.values(legacyTaskKeys).includes(x.titleKey) ? x.titleKey : '', ym: /^\d{4}-\d{2}$/.test(x.ym) ? x.ym : '', amount: finite(x.amount), done: !!x.done })),
    debts: list(raw.debts, d.debts, x => ({ name: String(x.name || ''), balance: finite(x.balance), rate: finite(x.rate), min: finite(x.min) })),
    cats: list(raw.cats, d.cats, x => ({ key: String(x.key || ''), name: String(x.name || ''), amount: finite(x.amount), type: ['need', 'want', 'save'].includes(x.type) ? x.type : 'want' })),
    goals: list(raw.goals, d.goals, x => ({ ...x, name: String(x.name || ''), target: finite(x.target), current: finite(x.current), monthly: x.monthly === '' ? '' : finite(x.monthly) })),
    special: list(raw.special, d.special, x => ({ ...x, name: String(x.name || ''), amount: finite(x.amount), kind: x.kind === 'inc' ? 'inc' : 'exp', freq: ['once','yearly','quarterly','monthly'].includes(x.freq) ? x.freq : 'once' })),
    hist: raw.hist && typeof raw.hist === 'object' && !Array.isArray(raw.hist) ? Object.fromEntries(Object.entries(raw.hist).filter(([ym,v]) => /^\d{4}-\d{2}$/.test(ym) && v && typeof v === 'object').map(([ym,v]) => [ym,{ income: finite(v.income), expenses: finite(v.expenses) }])) : {} };
  if (!s.cats.length) s.cats = d.cats;
  else {
    for (const [k, amt, tp] of [['debts', 0, 'save'], ['savings', 0, 'save'], ['investments', 0, 'save'], ['unexpected', 0, 'need']]) {
      if (!s.cats.some(c => c.key === k)) s.cats.push({ key: k, name: '', amount: amt, type: tp });
    }
  }
  s.ledgerYear = Number.isInteger(+s.ledgerYear) ? +s.ledgerYear : curYear(); s.horizon = [12,24,36,60].includes(+s.horizon) ? +s.horizon : 36;
  s.quizOpen = raw.quizOpen !== false; return s;
}
let S; try { S = normalizeState(JSON.parse(localStorage.getItem(KEY))); } catch { S = fresh(); }
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };
const catName = c => c.name || t('cat_' + (c.key || 'other'));
const val = path => path.split('.').reduce((o, k) => o?.[k], S);
function setPath(path, v) { const k = path.split('.'), last = k.pop(); let o = S; for (const x of k) { if (o[x] === undefined) o[x] = {}; o = o[x]; } o[last] = v; }

// ---------- derived data ----------
const P = () => ({ income: num(S.income), savings: num(S.savings), invested: num(S.invested), expenses: S.cats.reduce((s, c) => s + num(c.amount), 0), goal: 0,
  debts: S.debts.map(d => ({ balance: num(d.balance), rate: num(d.rate), min: num(d.min) })) });
function goalsCalc(p = P()) {
  const sur = Math.max(0, p.income - p.expenses), now = nowYM(), n = S.goals.length || 1;
  return S.goals.map(g => { const months = Math.max(1, Engine.monthsBetween(now, g.date || Engine.addMonths(now, 24))), target = num(g.target), cur = num(g.current);
    const planned = g.monthly === '' || g.monthly == null ? sur / n : num(g.monthly), proj = { c: Engine.fv(cur, planned, months, 3), b: Engine.fv(cur, planned, months, 6), o: Engine.fv(cur, planned, months, 9) };
    const r = target ? proj.b / target : 0;
    return { name: g.name || t('g_unnamed'), target, current: cur, months, planned, need: Engine.need(target, cur, months, 6), proj, status: r >= 1 ? 'on' : r >= .8 ? 'close' : 'behind', pct: target ? Math.min(100, cur / target * 100) : 0 }; });
}
const LP = () => { const p = P(), g = goalsCalc(p); return { ...p, goalsOk: g.length > 0 && g.every(x => x.status === 'on') }; };
function fc(n = +S.horizon || 12) {
  const p = P(), b = Engine.budget(S.cats, p.income), sp = S.special.map(s => ({ ym: s.ym, kind: s.kind, amount: num(s.amount), freq: s.freq || 'once' }));
  const rows = Engine.forecast(p, b, sp, nowYM(), n, { ledger: S.hist, incGrowth: +S.incGrowth || 0, inflation: +S.inflation || 0 });
  const sink = Engine.sinkingFund(sp, nowYM(), n), rollup = Engine.yearlyRollup(rows);
  return { rows, sink, rollup, low: rows.reduce((a, r) => r.balance < a.balance ? r : a, rows[0]), deficits: rows.filter(r => r.net < 0).length, inc: rows.reduce((s, r) => s + r.income, 0), exp: rows.reduce((s, r) => s + r.expenses, 0) };
}
function advice(p, b) {
  const a = [], pc = n => n.toFixed(0);
  if (p.income > 0 && b.total > p.income) a.push(t('adv_deficit', { n: money(b.total - p.income) })); else if (p.income > 0 && b.pct.save < 10) a.push(t('adv_save', { n: pc(b.pct.save) }));
  if (b.pct.needs > 50) a.push(t('adv_needs', { n: pc(b.pct.needs) })); if (b.pct.wants > 30) a.push(t('adv_wants', { n: pc(b.pct.wants) }));
  if (b.top && b.total > 0 && num(b.top.amount) / b.total > .3) a.push(t('adv_top', { c: catName(b.top), n: pc(num(b.top.amount) / b.total * 100) }));
  const hi = p.debts.filter(d => d.balance > 0).sort((x, y) => y.rate - x.rate)[0]; if (hi && hi.rate >= 15) a.push(t('adv_debt', { r: hi.rate }));
  return a;
}
function insights(p, b, gs, f) {
  const a = advice(p, b), bad = gs.filter(x => x.status === 'behind')[0];
  if (bad) a.push(t('adv_goal', { g: bad.name, n: money(bad.need) })); if (f.low.balance < 0) a.push(t('adv_low', { m: mlabel(f.low.ym, 1) }));
  return a.length ? a.slice(0, 4) : [t('adv_good')];
}

// ---------- editable lists ----------
const inp = (path, type, ph, v = val(path)) => `<input data-b="${path}" type="${type}" ${type === 'number' ? 'min="0" inputmode="decimal"' : ''} placeholder="${esc(ph)}" aria-label="${esc(ph)}" value="${esc(v)}">`;
const sel = (path, opts, ph) => `<select data-b="${path}" aria-label="${esc(ph)}">${opts.map(([v, l]) => `<option value="${v}" ${String(val(path) ?? '') === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
const fld = (path, type, ph) => `<label class="f"><span>${esc(ph)}</span>${inp(path, type, ph)}</label>`, sfld = (path, opts, ph) => `<label class="f"><span>${esc(ph)}</span>${sel(path, opts, ph)}</label>`;
const dateOpts = () => [...Array(60).keys()].map(i => i + 1).concat(Array.from({ length: 25 }, (_, i) => (i + 6) * 12)).map(n => { const ym = Engine.addMonths(nowYM(), n); return [ym, mlabel(ym, 1)]; });
const monthOpts = () => Array.from({ length: 60 }, (_, i) => { const ym = Engine.addMonths(nowYM(), i + 1); return [ym, mlabel(ym, 1)]; });
const freqOpts = () => [['once', t('f_once')], ['yearly', t('f_yearly')], ['quarterly', t('f_quarterly')], ['monthly', t('f_monthly')]];
const yearMonths = (yr = +S.ledgerYear || curYear()) => Array.from({ length: 12 }, (_, i) => `${yr}-${String(i + 1).padStart(2, '0')}`);
const yearListOpts = () => Array.from({ length: 7 }, (_, i) => curYear() - 1 + i);
const ADD = { debts: () => ({ name: '', balance: '', rate: '', min: '' }), cats: () => ({ name: '', amount: '', type: 'want' }),
  goals: () => ({ name: '', target: '', current: '', date: Engine.addMonths(nowYM(), 24), monthly: '' }), special: () => ({ name: '', ym: Engine.addMonths(nowYM(), 1), amount: '', kind: 'exp', freq: 'once' }) };

function fillLedgerYear(yr = +S.ledgerYear || curYear()) {
  const p = P(), b = Engine.budget(S.cats, p.income), sp = S.special.map(s => ({ ym: s.ym, kind: s.kind, amount: num(s.amount), freq: s.freq || 'once' }));
  for (const ym of yearMonths(yr)) {
    const mSp = sp.filter(s => Engine.matchSpecial(s, ym));
    const spInc = mSp.filter(s => s.kind === 'inc').reduce((a, s) => a + s.amount, 0);
    const spExp = mSp.filter(s => s.kind !== 'inc').reduce((a, s) => a + s.amount, 0);
    S.hist[ym] = { income: Math.round(p.income + spInc), expenses: Math.round(b.total + spExp) };
  }
  drawLists(); renderAll();
}
function drawQuiz() {
  const qk = ['save', 'run', 'debt', 'bal', 'inv'];
  $('#quiz-box').hidden = !S.quizOpen;
  $('#quiz-box').innerHTML = qk.map(k => `<div class="q-item"><p>${esc(t('q_' + k + '_q'))}</p>${sel('quiz.' + k, [['', t('q_pick')], ['0', t('q_' + k + '_0')], ['50', t('q_' + k + '_50')], ['100', t('q_' + k + '_100')]], t('sc_' + k))}</div>`).join('') +
    `<div class="acts"><button class="btn" id="quiz-done">${esc(t('q_close'))}</button></div>`;
}
function drawProfile() {
  const box = $('#profile-box'); if (!box) return;
  const o = f => [['', t('pf_pick')], ...PF_SEL[f].map(v => [v, t(`pf_o_${f}_${PF_SLUG[v] || v}`)])];
  const dep = S.profile.department, munis = PF_MUNI[dep] || [];
  box.innerHTML = `<div class="grid3">${sfld('profile.sex', o('sex'), t('pf_sex'))}${fld('profile.age', 'number', t('pf_age'))}${sfld('profile.area', o('area'), t('pf_area'))}${sfld('profile.education_level', o('education_level'), t('pf_education_level'))}${sfld('profile.household_type', o('household_type'), t('pf_household_type'))}${sfld('profile.marital_status', o('marital_status'), t('pf_marital_status'))}${sfld('profile.languages_spoken', o('languages_spoken'), t('pf_languages_spoken'))}` +
    `${sfld('profile.department', [['', t('pf_pick')], ...Object.keys(PF_MUNI).map(d => [d, d])], t('pf_department'))}${sfld('profile.municipality', munis.length ? [['', t('pf_pick')], ...munis.map(m => [m, m])] : [['', t('pf_pick_muni')]], t('pf_municipality'))}</div>` +
    `<label class="f"><span>${esc(t('pf_occupation'))}</span>${inp('profile.occupation', 'text', t('pf_occupation_ph'))}</label>` +
    `<label class="f"><span>${esc(t('pf_career_goals_and_ambitions'))}</span><textarea data-b="profile.career_goals_and_ambitions" rows="3" maxlength="1000" placeholder="${esc(t('pf_goals_ph'))}" aria-label="${esc(t('pf_career_goals_and_ambitions'))}">${esc(S.profile.career_goals_and_ambitions)}</textarea></label>`;
}
// ---------- Special %: compare the survey profile with the Nemotron personas (server side) ----------
let spResult = null, spAi = null, spRun = 0, prevDoneCount = -1, activeStress = 's1';
function renderStressTest(p, b, f, k) {
  const box = $('#stress-box'); if (!box) return;
  const b0 = f.low.balance, stTxt = v => v >= 0 ? t('st_ok') : t('st_warn');
  let msg = '';
  if (activeStress === 's1') {
    const b1 = b0 - 500;
    msg = t('st_r1', { amt: money(500), b0: money(b0), b1: money(b1), status: stTxt(b1) });
  } else if (activeStress === 's2') {
    const b1 = b0 - p.income;
    msg = t('st_r2', { amt: money(p.income), b0: money(b0), b1: money(b1), status: stTxt(b1), run: k.runway.toFixed(1) });
  } else {
    const cut = Math.max(25, Math.round(b.wants * 0.2)), gain3y = Math.round(Engine.fv(0, cut, 36, 6));
    const curEx = S.extra === '' ? Math.round(Math.max(0, k.surplus)) : num(S.extra);
    const av0 = Engine.payoff(p.debts, curEx, 'avalanche'), av1 = Engine.payoff(p.debts, curEx + cut, 'avalanche');
    const savedM = (av0.ok && av1.ok && av0.months > av1.months) ? t('st_debt_faster', { m: av0.months - av1.months }) : '';
    msg = t('st_r3', { save: money(cut), gain3y: money(gain3y), debtMsg: savedM });
  }
  box.innerHTML = `<h3>${esc(t('st_title'))}</h3><small>${esc(t('st_desc'))}</small><div class="acts" style="margin:8px 0">${['s1', 's2', 's3'].map(id => `<button class="${activeStress === id ? 'btn' : 'ghost'}" data-stress="${id}">${esc(t('st_' + id))}</button>`).join('')}</div><p class="hl" style="margin:0">${esc(msg)}</p>`;
}
const pfVal = (f, v) => PF_SEL[f] ? t(`pf_o_${f}_${PF_SLUG[v] || v}`) : v;
const uniq = a => [...new Set(a)], joinList = a => a.join(', ');
const range = a => [Math.min(...a), Math.max(...a)];
function localSummaries(r) {
  const top = r.top, bot = r.bottom, [sa, sb] = range(top.map(x => x.score)), [ta, tb] = range(top.map(x => x.age)), [ba, bb] = range(bot.map(x => x.age));
  const shared = ['sex', 'area', 'education_level', 'household_type', 'marital_status', 'languages_spoken', 'department', 'municipality'].filter(k => r.profile[k] !== '' && top.every(x => x[k] === r.profile[k]));
  const goal = String(top[0].career_goals_and_ambitions || '').slice(0, 170).trim();
  return {
    similar: [shared.length ? t('sp_l_t1', { fields: joinList(shared.map(k => t('pf_' + k).toLowerCase())), a: sa, b: sb }) : t('sp_l_t1b', { a: sa, b: sb }), t('sp_l_t2', { a: ta, b: tb, occ: joinList(uniq(top.map(x => x.occupation)).slice(0, 3)) }), goal ? t('sp_l_t3', { goal: goal + (goal.length >= 170 ? '…' : '') }) : ''].filter(Boolean),
    different: [t('sp_l_b1', { sexes: joinList(uniq(bot.map(x => pfVal('sex', x.sex)))), a: ba, b: bb, areas: joinList(uniq(bot.map(x => pfVal('area', x.area)))) }), t('sp_l_b2', { depts: joinList(uniq(bot.map(x => x.department))), edus: joinList(uniq(bot.map(x => pfVal('education_level', x.education_level)))) }), t('sp_l_b3', { occ: joinList(uniq(bot.map(x => x.occupation)).slice(0, 3)) })]
  };
}
const personaCard = p => `<li class="pcard"><div class="pc-h"><b>${esc(t('sp_sim_pct', { p: p.score }))}</b><span>${esc(pfVal('sex', p.sex))}, ${esc(t('sp_years', { n: p.age }))} · ${esc(pfVal('area', p.area))} · ${esc(pfVal('education_level', p.education_level))}</span></div><div class="mu">${esc(pfVal('household_type', p.household_type))} · ${esc(pfVal('marital_status', p.marital_status))} · ${esc(p.municipality)}</div><div>${esc(p.occupation)}</div><small>${esc(String(p.career_goals_and_ambitions).slice(0, 240))}${p.career_goals_and_ambitions.length > 240 ? '…' : ''}</small></li>`;
function drawSpecial() {
  const box = $('#sp-result'); if (!box) return;
  if (!spResult) { box.innerHTML = ''; return; }
  const r = spResult, loc = localSummaries(r), ai = spAi && spAi.lang === lang ? spAi : null;
  const sSim = ai?.similar ? [ai.similar] : loc.similar, sDif = ai?.different?.length ? ai.different : loc.different, src = t(ai?.similar || ai?.different?.length ? 'sp_src_ai' : 'sp_src_local');
  box.innerHTML = `<article class="card glow sp-hero"><h2>${esc(t('sp_head'))}</h2><div class="sp-big"><b>${esc(r.similarPct)}%</b><span>${esc(t('sp_sim', { n: r.similarCount.toLocaleString(lang), total: r.total.toLocaleString(lang) }))}</span></div><p class="hl">${esc(t('sp_special', { pct: r.specialPct }))}</p><p>${esc(t('sp_exact', { n: r.exactCount.toLocaleString(lang), pct: r.exactPct }))}</p><small>${esc(t('sp_rule', { t: r.threshold }))}</small><div class="acts" style="margin-top:12px"><button class="btn" id="sp-add-goal">🎯 ${esc(t('sp_goal_btn'))}</button><button class="ghost" id="sp-ask-ai">💬 ${esc(t('sp_ask_btn'))}</button></div></article>` +
    `<div class="two"><article class="card"><h2>${esc(t('sp_top_t'))}</h2><ol class="plist">${r.top.map(personaCard).join('')}</ol><h3>${esc(t('sp_sum_top'))}</h3>${sSim.map(x => `<p>${esc(x)}</p>`).join('')}<small class="mu">${esc(src)}</small></article>` +
    `<article class="card"><h2>${esc(t('sp_bot_t'))}</h2><ol class="plist">${r.bottom.map(personaCard).join('')}</ol><h3>${esc(t('sp_sum_bot'))}</h3>${sDif.map(x => `<p class="sp-line">${esc(x)}</p>`).join('')}<small class="mu">${esc(src)}</small></article></div>`;
}
async function submitProfile() {
  const msg = $('#sp-msg'), btn = $('#pf-submit'), run = ++spRun, body = { profile: S.profile, lang };
  const answered = ['sex', 'area', 'education_level', 'household_type', 'marital_status', 'languages_spoken', 'department', 'municipality', 'age'].filter(k => S.profile[k] !== '').length;
  if (answered < 5) { msg.textContent = t('sp_need', { n: 5 }); return; }
  btn.disabled = true; msg.textContent = t('sp_calc'); spResult = null; spAi = null; drawSpecial();
  const post = async (url) => { const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => ({})) }; };
  try {
    const res = await post('/api/special');
    if (run !== spRun) return;
    if (res.status === 503) { msg.textContent = t('sp_err_ds'); return; }
    if (res.status === 400 && res.data.error === 'not_enough_answers') { msg.textContent = t('sp_need', { n: res.data.min }); return; }
    if (!res.data.ok) { msg.textContent = t('sp_err'); return; }
    spResult = res.data; msg.textContent = ''; drawSpecial();
    post('/api/special-summary').then(sm => { if (run === spRun && sm.data.ok && (sm.data.similar || sm.data.different)) { spAi = { lang: body.lang, similar: sm.data.similar, different: sm.data.different }; drawSpecial(); } }).catch(() => {});
  } catch { if (run === spRun) msg.textContent = t('sp_err'); }
  finally { btn.disabled = false; }
}
function drawLists() {
  $$('#income,#savings,#invested').forEach(e => e.value = S[e.id]);
  const p = P(), sur = Math.max(0, p.income - p.expenses); $('#extra').value = S.extra; $('#extra').placeholder = money(sur);
  drawQuiz(); drawProfile(); drawSpecial();
  $('#debts').innerHTML = S.debts.map((d, i) => `<div class="row4">${['name', 'balance', 'rate', 'min'].map(k => inp(`debts.${i}.${k}`, k === 'name' ? 'text' : 'number', t('d_' + k))).join('')}<button class="x" data-del="debts.${i}" aria-label="${esc(t('aria_delete'))}">✕</button></div>`).join('');
  $('#cats').innerHTML = S.cats.map((c, i) => `<div class="row3">${inp(`cats.${i}.name`, 'text', t('d_name'), catName(c))}${inp(`cats.${i}.amount`, 'number', t('cat_amt'))}${sel(`cats.${i}.type`, [['need', t('need')], ['want', t('want')], ['save', t('save')]], t('cat_type'))}<button class="x" data-del="cats.${i}" aria-label="${esc(t('aria_delete'))}">✕</button></div>`).join('');
  $('#goals').innerHTML = S.goals.length ? S.goals.map((g, i) => `<div class="goal"><div class="gin">${fld(`goals.${i}.name`, 'text', t('g_name'))}${fld(`goals.${i}.target`, 'number', t('g_target'))}${fld(`goals.${i}.current`, 'number', t('g_have'))}${sfld(`goals.${i}.date`, dateOpts(), t('g_date'))}${fld(`goals.${i}.monthly`, 'number', t('g_monthly'))}<button class="x" data-del="goals.${i}" aria-label="${esc(t('aria_delete'))}">✕</button></div><div class="gres" data-gi="${i}"></div></div>`).join('') : `<p class="mu">${t('g_none')}</p>`;
  gsel = Math.min(gsel, Math.max(0, S.goals.length - 1));
  $('#gsel').innerHTML = S.goals.map((g, i) => `<option value="${i}" ${i === gsel ? 'selected' : ''}>${esc(g.name || t('g_unnamed'))}</option>`).join('');
  $('#special').innerHTML = S.special.map((s, i) => `<div class="sp">${fld(`special.${i}.name`, 'text', t('y_name'))}${sfld(`special.${i}.ym`, monthOpts(), t('y_month'))}${fld(`special.${i}.amount`, 'number', t('y_amt'))}${sfld(`special.${i}.kind`, [['exp', t('y_exp')], ['inc', t('y_inc')]], '·')}${sfld(`special.${i}.freq`, freqOpts(), t('y_freq'))}<button class="x" data-del="special.${i}" aria-label="${esc(t('aria_delete'))}">✕</button></div>`).join('');
  if ($('#currency')) $('#currency').value = S.currency || 'USD';
  if ($('#lyr')) $('#lyr').innerHTML = yearListOpts().map(y => `<option value="${y}" ${+S.ledgerYear === y ? 'selected' : ''}>${y}</option>`).join('');
  if ($('#yhor')) { $('#yhor').innerHTML = [12, 24, 36, 60].map(n => { const years = n / 12; return `<option value="${n}">${years} ${t(years === 1 ? 'year_one' : 'year_many')}</option>`; }).join(''); $('#yhor').value = String(S.horizon || 36); }
  if ($('#yincg')) $('#yincg').value = S.incGrowth ?? 3;
  if ($('#yinf')) $('#yinf').value = S.inflation ?? 3;
  $('#hist').innerHTML = yearMonths().map(ym => `<div class="hh"><b>${mlabel(ym, 1)}</b>${inp(`hist.${ym}.income`, 'number', t('income'))}${inp(`hist.${ym}.expenses`, 'number', t('y_exp'))}<i data-hnet="${ym}"></i></div>`).join('');
  const rm = S.ret.m === '' ? Math.round(sur / 2 / 10) * 10 : S.ret.m;
  $('#retctl').innerHTML = `<div class="grid3">${[['y', 1, 40, 1, S.ret.y], ['r', 1, 12, 1, S.ret.r], ['m', 0, Math.max(500, Math.round(sur * 2)), 10, rm]].map(([k, a, b, st, v]) => `<label class="f"><span>${t(k)}: <b id="${k}v"></b></span><input data-b="ret.${k}" type="range" min="${a}" max="${b}" step="${st}" value="${v}"></label>`).join('')}</div>`;
}

// ---------- chart & table helpers ----------
const catParts = () => S.cats.map((c, i) => ({ name: catName(c), v: num(c.amount), color: COL[i % COL.length] })).filter(x => x.v > 0);
function drawBars3(cv, b) { Charts.bars(cv, [['needs', b.pct.needs, 50, '#4aa3ff'], ['wants', b.pct.wants, 30, '#ffffff'], ['save', b.pct.save, 20, '#da291c']].map(([k, v, g, c]) => ({ name: t('bar_' + k), v, target: g, color: c }))); }
function drawGoalBars(cv, gs) {
  cv.height = Math.max(120, gs.length * 58 + 24); if (!gs.length) return;
  Charts.bars(cv, gs.map(g => ({ name: g.name.slice(0, 14), v: g.target ? g.proj.b / g.target * 100 : 0, target: 100, color: g.status === 'on' ? '#4aa3ff' : g.status === 'close' ? '#ffffff' : '#da291c' })));
}
const yearNames = () => [t('y_inc'), t('y_exp'), t('y_bal')];
const yrows = f => f.rows.map(r => ({ label: mlabel(r.ym), income: r.income, expenses: r.expenses, balance: r.balance }));
const hrows = (yr = +S.ledgerYear || curYear()) => yearMonths(yr).map(ym => { const h = S.hist[ym]; return { ym, label: mlabel(ym), income: num(h?.income), expenses: num(h?.expenses), has: !!(h && (h.income !== '' && h.income != null || h.expenses !== '' && h.expenses != null)) }; });
function multiYearTable(rollup) {
  if (!rollup || !rollup.length) return '';
  return `<h3>${esc(t('y_multi_t'))}</h3><table class="ytbl"><thead><tr><th>${esc(t('y_col_yr'))}</th><th>${esc(t('y_col_inc'))}</th><th>${esc(t('y_col_exp'))}</th><th>${esc(t('y_col_sp'))}</th><th>${esc(t('y_col_net'))}</th><th>${esc(t('y_col_end'))}</th></tr></thead><tbody>` +
    rollup.map(r => `<tr><td>${esc(r.year)} (${r.months}m)</td><td>${money(r.income)}</td><td>${money(r.expenses)}</td><td>${money(r.spExp)}</td><td style="color:${r.net < 0 ? '#ff7a6e' : '#9fd0ff'}">${money(r.net)}</td><td><b>${money(r.endBalance)}</b></td></tr>`).join('') + `</tbody></table>`;
}
function renderPlanHub(f, hr, lsumHtml) {
  const el = $('#plan-hub'); if (!el) return;
  const sk = f.sink, hMonths = +S.horizon || 36;
  const sinkMsg = sk.totalExp > 0 ? t('p_sink_d', { tot: money(sk.totalExp), m: hMonths, avg: money(sk.avgMonthly), pk: money(sk.peakMonthly) }) : t('p_sink_none');
  const actsHtml = (S.actions || []).map((a, i) => `<li class="act-item ${a.done ? 'done' : ''}"><input type="checkbox" data-act-chk="${i}" ${a.done ? 'checked' : ''}><span>${esc(actionTitle(a))}</span><small>${a.ym ? mlabel(a.ym, 1) : ''}${num(a.amount) ? ' · ' + money(a.amount) : ''}</small><button class="x" data-del="actions.${i}" aria-label="${esc(t('aria_delete'))}">✕</button></li>`).join('');
  el.innerHTML = `<div class="subcard"><h3>🎯 ${esc(t('p_sink_t'))}</h3><p class="hl">${esc(sinkMsg)}</p>
<h3>✅ ${esc(t('p_tasks_t'))}</h3><small>${esc(t('p_tasks_d'))}</small><ul class="act-list">${actsHtml}</ul>
<div class="act-add"><input id="nt-title" type="text" placeholder="${esc(t('p_task_ph', { amount: money(100) }))}"><select id="nt-ym">${monthOpts().map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select><input id="nt-amt" type="number" min="0" placeholder="${esc(t('y_amt'))}"><button class="btn" id="add-task">${esc(t('p_add_task'))}</button></div></div>
<div class="subcard"><div class="hd"><h3>📅 ${esc(t('p_yr_t'))}</h3><div class="acts"><button class="ghost" id="p-fill">${esc(t('y_fill'))}</button><button class="ghost" data-tab="year">${esc(t('p_open_yr'))}</button></div></div><small>${esc(t('p_yr_d'))}</small><p class="hl">${lsumHtml}</p>${multiYearTable(f.rollup)}</div>`;
}

// ---------- render ----------
function renderAll() {
  const p = P(), b = Engine.budget(S.cats, p.income), L = Engine.levels(LP()), cur = L.indexOf(false), k = Engine.kpis(p), sc = Engine.score(p, b, S.quiz), gs = goalsCalc(p), f = fc(), sur = k.surplus;
  $('#etot').textContent = money(p.expenses);
  $('#restore-demo').hidden = !S.demoMode; $('#demo-notice').hidden = !S.demoMode;
  if ($('#quiz-banner')) {
    $('#quiz-banner').className = 'q-banner' + (sc.quizDone ? ' ok' : '');
    $('#quiz-banner').innerHTML = `<span>${esc(sc.quizDone ? t('q_done_msg') : t('q_cta'))}</span>`;
  }
  $('#scoreSource').textContent = t('score_source');
  $('#scoreMath').textContent = t('score_weights', { save: 25, run: 25, debt: 20, bal: 15, inv: 15 });
  $('#kpis').innerHTML = [['kpi_net', money(k.net)], ['kpi_sur', money(sur)], ['kpi_rate', k.rate.toFixed(0) + '%'], ['kpi_run', k.runway.toFixed(1) + ' ' + t('mo')], ['kpi_debt', money(Engine.debtTotal(p.debts))]].map(([a, v]) => `<div class="kpi"><span>${t(a)}</span><b>${v}</b></div>`).join('');
  const grd = sc.total >= 80 ? 'a' : sc.total >= 60 ? 'b' : sc.total >= 40 ? 'c' : 'd', arc = 'M24 96 A66 66 0 0 1 156 96', len = Math.PI * 66;
  const gTicks = Array.from({ length: 19 }, (_, i) => {
    const a = Math.PI + (i / 18) * Math.PI, x1 = (90 + Math.cos(a) * 78).toFixed(1), y1 = (96 + Math.sin(a) * 78).toFixed(1), x2 = (90 + Math.cos(a) * 83).toFixed(1), y2 = (96 + Math.sin(a) * 83).toFixed(1);
    const lit = (i / 18) <= (sc.total / 100);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${lit ? 'var(--accent-gold)' : 'var(--border-color)'}" stroke-width="${i % 3 === 0 ? 2.2 : 1.2}" opacity="${lit ? 1 : .45}"/>`;
  }).join('');
  $('#gauge').innerHTML = sc.quizDone ? `<svg viewBox="0 0 180 116" class="gauge" role="img" aria-label="${sc.total}/100"><defs><linearGradient id="gg" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="var(--cyber-cyan)"/><stop offset="55%" stop-color="var(--accent-gold)"/><stop offset="100%" stop-color="var(--success)"/></linearGradient><filter id="glw"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>${gTicks}<path d="${arc}" fill="none" stroke="color-mix(in srgb,var(--text-secondary) 18%,var(--bg-secondary))" stroke-width="11" stroke-linecap="round"/><path d="M34 96 A56 56 0 0 1 146 96" fill="none" stroke="var(--border-color)" stroke-width="1.5" stroke-dasharray="3 3" opacity=".6"/><path d="${arc}" fill="none" stroke="url(#gg)" filter="url(#glw)" stroke-width="11" stroke-linecap="round" stroke-dasharray="${len}" stroke-dashoffset="${len * (1 - sc.total / 100)}"/><text x="90" y="79" text-anchor="middle" class="gv">${sc.total}</text><text x="90" y="100" text-anchor="middle" class="gl">${t('gr_' + grd)} · AI</text></svg>` : `<p class="score-pending">${esc(t('score_pending'))}</p>`;
  $('#parts').innerHTML = sc.quizDone ? Object.entries(sc.parts).map(([x, v]) => `<li><span>${t('sc_' + x)}</span><div class="m"><i style="width:${v}%"></i></div><b>${Math.round(v)}</b></li>`).join('') : '';
  const starter = Math.min(1000, p.expenses || 1000), full = p.expenses * 3, eta = (c, g) => { const m = Engine.months(c, g, sur); return m === 0 ? t('reached') : m === Infinity ? t('nosurplus') : t('monthsTo', { n: m }); };
  const dr = Engine.payoff(p.debts, Math.max(0, sur), 'avalanche'), fin = Engine.compound(p.invested, Math.max(0, sur / 2), 7, 30).pop();
  const stepDetails = [t('surplus', { n: money(sur) }), `${t('target')}: ${money(starter)} · ${eta(p.savings, starter)}`, Engine.debtTotal(p.debts) > 0 ? (dr.ok ? t('res', { m: dr.months, i: money(dr.interest) }) : t('never')) : t('nodebt'),
    `${t('target')}: ${money(full)} · ${eta(p.savings, full)}`, gs.length ? t('nb4', { n: gs.filter(x => x.status !== 'on').length }) : t('nb4none'), t('steps'), t('final', { y: 30, v: money(fin.v), c: money(fin.c) })];
  const detail = [t('nb0'), stepDetails[1], stepDetails[2], stepDetails[3], stepDetails[4], stepDetails[5], stepDetails[6]][cur];
  const plan = Engine.actionPlan(p, gs), active = plan[0], activeCopy = planCopy(active);
  nextText = `${activeCopy.title}. ${activeCopy.description}`;
  $('#next').innerHTML = `<small class="eyebrow">${t('next_t')}</small><h2>${esc(activeCopy.title)}</h2><p>${esc(activeCopy.description)}</p><p class="tip">💡 ${t('tip' + (cur + 1))}</p><div class="acts">${canSpeak ? `<button class="btn" id="listen">🔊 ${t('listen')}</button>` : ''}<button class="ghost" data-go="numbers">${t('go_t')}</button><button class="ghost" id="askplan">${t('ask_buck')}</button></div>`;
  $('#ins').innerHTML = `<h2>${t('ins_t')}</h2>${insights(p, b, gs, f).map(x => `<p class="tip">${x}</p>`).join('')}`;
  $('#steps').innerHTML = plan.map((step, i) => { const c = i === 0 ? 'now' : 'next', copy = planCopy(step); return `<li class="${c}"><span class="dot">${i + 1}</span><div><b>${esc(copy.title)}</b> <small>${t('st_' + c)}</small><small>${esc(copy.description)}</small></div></li>`; }).join('');
  // numbers
  $('#bchart').innerHTML = `<h2>${t('b_h')}</h2><canvas id="bc1" width="800" height="${Math.max(300, catParts().length * 26 + 70)}"></canvas><canvas id="bc2" width="800" height="190"></canvas><small>${t('bar_note')}</small>`;
  if (catParts().length) Charts.donut($('#bc1'), catParts(), money); drawBars3($('#bc2'), b);
  const labelChart = (id, label) => { const cv = $('#' + id); if (cv) { cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', label); } };
  labelChart('bc1', t('chart_budget', { items: catParts().map(x => `${x.name}: ${money(x.v)}`).join(', ') || t('chart_empty') }));
  labelChart('bc2', t('chart_allocation', { needs: b.pct.needs.toFixed(0), wants: b.pct.wants.toFixed(0), save: b.pct.save.toFixed(0) }));
  const dt = Engine.debtTotal(p.debts); $('#debtsim').hidden = dt <= 0;
  if (dt > 0) { const ex = S.extra === '' ? Math.round(Math.max(0, sur)) : num(S.extra), rs = ['snowball', 'avalanche'].map(m => [m, Engine.payoff(p.debts, ex, m)]);
    $('#dres').innerHTML = rs.map(([m, r]) => `<div><h3>${t(m)}</h3><p>${r.ok ? t('res', { m: r.months, i: money(r.interest) }) : t('never')}</p></div>`).join('');
    Charts.line($('#dc'), [{ name: t('snowball'), color: '#4aa3ff', d: rs[0][1].series }, { name: t('avalanche'), color: '#ffffff', d: rs[1][1].series }], short); labelChart('dc', t('chart_debt', { snowball: rs[0][1].ok ? rs[0][1].months : t('never'), avalanche: rs[1][1].ok ? rs[1][1].months : t('never') })); }
  // goals
  $$('.gres').forEach(el => { const g = gs[+el.dataset.gi]; if (!g) return;
    el.innerHTML = `<div class="meter"><i style="width:${g.pct}%"></i></div><p><span class="pill ${g.status}">${t('g_' + g.status)}</span> ${money(g.current)} / ${money(g.target)} · ${g.months} ${t('mo')}</p><p>${t('g_need')}: <b>${money(g.need)}</b> · ${t('g_plan')}: <b>${money(g.planned)}</b></p><p class="mu">${t('g_proj')}: ${t('scen_c')} ${money(g.proj.c)} · ${t('scen_b')} ${money(g.proj.b)} · ${t('scen_o')} ${money(g.proj.o)}</p>`; });
  drawGoalBars($('#gb'), gs);
  labelChart('gb', t('chart_goal_gap', { items: gs.map(x => `${x.name}: ${money(x.current)} / ${money(x.target)}`).join(', ') || t('chart_empty') }));
  const g = gs[gsel]; if (g) { const m = Math.min(g.months, 360); Charts.line($('#gc'), [{ name: t('scen_c'), color: '#9db0d3', d: Engine.path(g.current, g.planned, m, 3) }, { name: t('scen_b'), color: '#4aa3ff', d: Engine.path(g.current, g.planned, m, 6) }, { name: t('scen_o'), color: '#ffffff', d: Engine.path(g.current, g.planned, m, 9) }, { name: t('g_target'), color: '#da291c', dash: [8, 6], d: Array(m + 1).fill(g.target) }], short); }
  else $('#gc').getContext('2d').clearRect(0, 0, 800, 320);
  labelChart('gc', g ? t('chart_goal_scenario', { name: g.name, target: money(g.target), current: money(g.current), planned: money(g.planned) }) : t('chart_empty'));
  const rm = S.ret.m === '' ? Math.round(Math.max(0, sur) / 2 / 10) * 10 : +S.ret.m, ry = +S.ret.y, rr = +S.ret.r, rs2 = Engine.compound(p.invested, rm, rr, ry), re = rs2[rs2.length - 1];
  $('#yv').textContent = ry; $('#rv').textContent = rr; $('#mv').textContent = money(rm); $('#retfin').textContent = t('final', { y: ry, v: money(re.v), c: money(re.c) });
  Charts.line($('#rc'), [{ name: t('ch_val'), color: '#4aa3ff', d: rs2.map(x => x.v) }, { name: t('ch_con'), color: '#9db0d3', d: rs2.map(x => x.c) }], short);
  labelChart('rc', t('chart_retirement', { years: ry, value: money(re.v), contributed: money(re.c) }));
  // year & action plan hub
  Charts.year($('#yc'), yrows(f), short, yearNames());
  labelChart('yc', t('chart_forecast', { months: S.horizon, income: money(f.inc), expenses: money(f.exp), low: money(f.low.balance), month: mlabel(f.low.ym, 1) }));
  const hr = hrows(), hh = hr.filter(r => r.has), avg = (a, key) => a.length ? a.reduce((s, r) => s + r[key], 0) / a.length : 0;
  const hInc = hr.reduce((s, r) => s + r.income, 0), hExp = hr.reduce((s, r) => s + r.expenses, 0);
  $$('[data-hnet]').forEach(el => { const h = S.hist[el.dataset.hnet]; const has = h && (h.income !== '' && h.income != null || h.expenses !== '' && h.expenses != null); const net = num(h?.income) - num(h?.expenses); el.textContent = has ? money(net) : '—'; el.style.color = !has ? 'var(--mu)' : net < 0 ? '#ff7a6e' : '#9fd0ff'; });
  const lsumHtml = esc(t('y_lsum', { y: S.ledgerYear || curYear(), i: money(hInc), e: money(hExp), n: money(hInc - hExp), c: hh.length }));
  if ($('#lsum')) $('#lsum').textContent = t('y_lsum', { y: S.ledgerYear || curYear(), i: money(hInc), e: money(hExp), n: money(hInc - hExp), c: hh.length });
  const sk = f.sink;
  $('#ysum').innerHTML = `<p class="hl">${t('y_sum', { i: money(f.inc), e: money(f.exp), n: money(f.inc - f.exp) })} ${t('y_low', { v: money(f.low.balance), m: mlabel(f.low.ym, 1) })}${f.deficits ? ' ' + t('y_def', { n: f.deficits }) : ''}${sk.totalExp > 0 ? '<br>' + esc(t('p_sink_d', { tot: money(sk.totalExp), m: +S.horizon || 36, avg: money(sk.avgMonthly), pk: money(sk.peakMonthly) })) : ''}${hh.length ? '<br>' + t('y_cmp', { h: money(avg(hh, 'expenses')), f: money(f.exp / (+S.horizon || 12)) }) : ''}</p>`;
  if ($('#ymulti')) $('#ymulti').innerHTML = multiYearTable(f.rollup);
  renderStressTest(p, b, f, k);
  $('#hc').hidden = !hh.length; if (hh.length) Charts.year($('#hc'), hr, short, yearNames());
  labelChart('hc', t('chart_ledger', { year: S.ledgerYear, months: hh.length, income: money(hInc), expenses: money(hExp) }));
  renderPlanHub(f, hr, lsumHtml);
  const doneCount = L.filter(Boolean).length;
  if (prevDoneCount >= 0 && doneCount > prevDoneCount && window.petSay) petSay(t('pet_up'));
  prevDoneCount = doneCount;
  if (tab === 'report') buildReport();
  persist();
}
function buildReport() {
  const p = P(), b = Engine.budget(S.cats, p.income), sc = Engine.score(p, b, S.quiz), gs = goalsCalc(p), f = fc(), L = Engine.levels(LP()), cur = L.indexOf(false), k = Engine.kpis(p);
  const shot = (fn, w, h) => { try { const c = document.createElement('canvas'); c.width = w; c.height = h; Charts.light = true; fn(c); Charts.light = false; return `<img alt="" src="${c.toDataURL()}">`; } catch { Charts.light = false; return ''; } };
  const grd = sc.total >= 80 ? 'a' : sc.total >= 60 ? 'b' : sc.total >= 40 ? 'c' : 'd', parts = catParts(), reportPlan = Engine.actionPlan(p, gs);
  const spReportHtml = spResult ? `<h2>${esc(t('r_special'))}</h2><p><b>${esc(spResult.similarPct)}%</b> ${esc(t('sp_sim', { n: spResult.similarCount.toLocaleString(lang), total: spResult.total.toLocaleString(lang) }))} · ${esc(t('sp_special', { pct: spResult.specialPct }))}</p>${(spAi?.similar ? [spAi.similar] : localSummaries(spResult).similar).map(x => `<p>${esc(x)}</p>`).join('')}` : '';
  $('#report').innerHTML = `<div class="rh"><svg class="report-logo" viewBox="0 0 40 40" role="img" aria-label="MoneyMente"><polygon points="20,2 36,11 36,29 20,38 4,29 4,11" fill="none" stroke="#4d7c0f" stroke-width="2.6"/><circle cx="20" cy="20" r="11" fill="none" stroke="#0284c7" stroke-width="1.3" stroke-dasharray="4 2"/><path d="M12 25l5-6 4 3 7-9" fill="none" stroke="#4d7c0f" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="28" cy="13" r="2.4" fill="#0284c7"/></svg><div><h1>${t('title')} · ${t('r_doc')}</h1><small>${t('r_date', { d: new Date().toLocaleDateString(lang, { year: 'numeric', month: '2-digit', day: '2-digit' }) })}</small></div></div>
<div id="ai-sum-box" class="ai-sum" ${S.aiSummary ? '' : 'hidden'}><b>✨ ${t('r_ai_h')}:</b> <span id="ai-sum-txt">${esc(S.aiSummary || '')}</span></div>
<h2>${t('r_score')}: ${sc.quizDone ? `${sc.total}/100 (${t('gr_' + grd)})` : esc(t('score_pending'))}</h2>${sc.quizDone ? `<table>${Object.entries(sc.parts).map(([x, v]) => `<tr><td>${t('sc_' + x)}</td><td>${Math.round(v)}/100</td></tr>`).join('')}</table>` : ''}
<table><tr><td>${t('kpi_net')}</td><td>${money(k.net)}</td><td>${t('kpi_sur')}</td><td>${money(k.surplus)}</td></tr><tr><td>${t('kpi_rate')}</td><td>${k.rate.toFixed(0)}%</td><td>${t('kpi_run')}</td><td>${k.runway.toFixed(1)} ${t('mo')}</td></tr></table>
<h2>${t('r_budget')}</h2><table><tr><th>${t('cat_col')}</th><th>${t('amt_col')}</th><th>${t('pct_col')}</th></tr>${S.cats.map(c => `<tr><td>${esc(catName(c))}</td><td>${money(num(c.amount))}</td><td>${p.income ? Math.round(num(c.amount) / p.income * 100) : 0}%</td></tr>`).join('')}</table>${parts.length ? shot(c => Charts.donut(c, parts, money), 800, Math.max(300, parts.length * 26 + 70)) : ''}${shot(c => drawBars3(c, b), 800, 190)}
${p.debts.some(d => d.balance > 0) ? `<h2>${t('r_debts')}</h2><table><tr><th>${t('d_name')}</th><th>${t('d_balance')}</th><th>${t('d_rate')}</th><th>${t('d_min')}</th></tr>${S.debts.map(d => `<tr><td>${esc(d.name)}</td><td>${money(num(d.balance))}</td><td>${num(d.rate)}%</td><td>${money(num(d.min))}</td></tr>`).join('')}</table>` : ''}
${gs.length ? `<h2>${t('r_goals')}</h2><table><tr><th>${t('g_name')}</th><th>${t('g_target')}</th><th>${t('g_have')}</th><th>${t('g_need')}</th><th>${t('g_plan')}</th><th></th></tr>${gs.map(g => `<tr><td>${esc(g.name)}</td><td>${money(g.target)}</td><td>${money(g.current)}</td><td>${money(g.need)}</td><td>${money(g.planned)}</td><td>${t('g_' + g.status)}</td></tr>`).join('')}</table>${shot(c => drawGoalBars(c, gs), 800, Math.max(120, gs.length * 58 + 24))}` : ''}
<h2>${t('r_year')}</h2><p>${t('y_sum', { i: money(f.inc), e: money(f.exp), n: money(f.inc - f.exp) })} ${t('y_low', { v: money(f.low.balance), m: mlabel(f.low.ym, 1) })}</p>${multiYearTable(f.rollup)}${shot(c => Charts.year(c, yrows(f), short, yearNames()), 800, 340)}
${spReportHtml}
<h2>${t('r_plan')}</h2><ol>${reportPlan.map(step => { const copy = planCopy(step); return `<li><b>${esc(copy.title)}:</b> ${esc(copy.description)}</li>`; }).join('')}</ol>
${(S.actions && S.actions.length) ? `<ul>${S.actions.map(a => `<li>${a.done ? '✓' : '☐'} ${esc(actionTitle(a))} (${a.ym ? mlabel(a.ym, 1) : ''}${num(a.amount) ? ' · ' + money(a.amount) : ''})</li>`).join('')}</ul>` : ''}<p><small>${t('disc')}</small></p>`;
}
// ---------- navigation, audio, events ----------
function go(name) { tab = name; $$('[data-view]').forEach(s => s.classList.toggle('on', s.dataset.view === name)); $$('#tabs button').forEach(b => b.setAttribute('aria-current', b.dataset.tab === name ? 'page' : 'false')); if (name === 'report') buildReport(); if (window.updateChatChips) window.updateChatChips(name); window.scrollTo(0, 0); }
function demoProfile() {
  return { sex: 'Femenino', age: '28', area: 'urbano', education_level: 'universitario', household_type: 'nuclear', marital_status: 'soltero', languages_spoken: 'español e inglés', department: 'San Salvador', municipality: 'San Salvador Centro', occupation: t('pf_demo_occ'), career_goals_and_ambitions: t('pf_demo_goal') };
}
function dlFile(name, mime, text) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function exportLedgerCsv() {
  const yr = +S.ledgerYear || curYear(), rows = [['Month', 'Income', 'Expenses', 'Net']];
  for (const r of hrows(yr)) rows.push([r.ym, r.income, r.expenses, r.income - r.expenses]);
  dlFile(`moneymente-ledger-${yr}.csv`, 'text/csv;charset=utf-8', rows.map(r => r.join(',')).join('\n'));
}
function say(text) {
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text), vs = speechSynthesis.getVoices(), n = localStorage.getItem('voice_' + lang);
  u.lang = lang === 'es' ? 'es-ES' : 'en-US'; u.voice = vs.find(v => v.name === n) || vs.find(v => v.lang.startsWith(lang)) || null; u.rate = +$('#rate').value || 1;
  document.body.dataset.talk = 1;
  return new Promise(r => { u.onend = u.onerror = () => { delete document.body.dataset.talk; r(); }; speechSynthesis.speak(u); });
}
async function tour() {
  if (touring) { touring = false; speechSynthesis.cancel(); return; }
  touring = true; $('#tour').textContent = t('stop'); go('overview'); $('.vmenu').open = false;
  for (const [s, k] of [['.nav', 't_welcome'], ['#score', 't_score'], ['#next', 't_next'], ['#plan', 't_plan'], ['#pet', 't_chat']]) {
    if (!touring) break; const el = $(s); el.classList.add('spot'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); await say(t(k)); el.classList.remove('spot');
  }
  touring = false; $('#tour').textContent = t('tour');
}
function demo() {
  if (!S.demoMode) { try { localStorage.setItem(DEMO_BACKUP_KEY, JSON.stringify(S)); } catch {} }
  const n = nowYM(), a = k => Engine.addMonths(n, k), yr = curYear();
  S = { ...fresh(), profile: demoProfile(), currency: S.currency || 'USD', demoMode: true, income: 2200, savings: 900, invested: 300, quiz: { save: '50', run: '50', debt: '50', bal: '100', inv: '50' }, quizOpen: false, ledgerYear: yr, horizon: 36, incGrowth: 3, inflation: 3,
    debts: [{ name: t('dd1'), balance: 1800, rate: 28, min: 60 }, { name: t('dd2'), balance: 600, rate: 12, min: 35 }],
    cats: mk([['housing', 520, 'need'], ['food', 360, 'need'], ['transport', 140, 'need'], ['utilities', 120, 'need'], ['health', 60, 'need'], ['debts', 95, 'save'], ['savings', 120, 'save'], ['investments', 80, 'save'], ['unexpected', 55, 'need'], ['fun', 130, 'want'], ['shopping', 80, 'want'], ['other', 40, 'want']]),
    goals: [{ name: t('dg1'), target: 7000, current: 900, date: a(18), monthly: '' }, { name: t('dg2'), target: 1200, current: 200, date: a(8), monthly: '' }, { name: t('dg3'), target: 15000, current: 0, date: a(60), monthly: 200 }],
    special: [{ name: t('ds1'), ym: a(1), amount: 250, kind: 'exp', freq: 'yearly' }, { name: t('ds2'), ym: a(2), amount: 400, kind: 'inc', freq: 'yearly' }, { name: t('ds3'), ym: a(6), amount: 600, kind: 'exp', freq: 'yearly' }],
    actions: [{ titleKey: 'demo_starter', title: '', ym: a(1), amount: 100, done: false },
      { titleKey: 'demo_debt', title: '', ym: a(4), amount: 500, done: false },
      { titleKey: 'demo_sinking', title: '', ym: a(6), amount: 71, done: false }],
    hist: Object.fromEntries(yearMonths(yr).map((ym, i) => [ym, { income: 2150 + (i * 37) % 120 + (i === 11 ? 400 : 0), expenses: 1600 + (i * 53) % 240 + (i === 11 ? 250 : 0) }])) };
  drawLists(); renderAll();
}
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.b) { setPath(el.dataset.b, el.value); renderAll(); }
  else if (el.id === 'gsel') { gsel = +el.value; renderAll(); }
  else if (el.id === 'lyr') { S.ledgerYear = +el.value; drawLists(); renderAll(); }
  else if (el.id === 'yhor') { S.horizon = +el.value; renderAll(); }
  else if (el.id === 'yincg') { S.incGrowth = +el.value || 0; renderAll(); }
  else if (el.id === 'yinf') { S.inflation = +el.value || 0; renderAll(); }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.b === 'profile.department') { S.profile.municipality = ''; drawProfile(); persist(); return; }
  if (el.id === 'theme') { applyTheme(el.value); renderAll(); return; }
  if (el.id === 'currency') { S.currency = el.value; renderAll(); return; }
  if (el.id === 'imp-file' && el.files?.[0]) {
    el.files[0].text().then(txt => { try { S = normalizeState(JSON.parse(txt)); drawLists(); renderAll(); if (window.petSay) petSay(t('imp_ok')); } catch {} el.value = ''; });
    return;
  }
  if (el.dataset.actChk !== undefined) { const idx = +el.dataset.actChk; if (S.actions[idx]) { S.actions[idx].done = el.checked; renderAll(); if (el.checked && window.petSay) petSay(t('pet_task_ok')); } }
});
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
  if (d.tab) go(d.tab); else if (d.go) go(d.go);
  else if (d.stress) { activeStress = d.stress; renderAll(); }
  else if (d.del) { const [k, i] = d.del.split('.'); S[k].splice(+i, 1); drawLists(); renderAll(); }
  else if (d.add) { S[d.add].push(ADD[d.add]()); drawLists(); renderAll(); }
  else if (b.id === 'pf-submit') submitProfile();
  else if (b.id === 'pf-demo') { S.profile = demoProfile(); drawProfile(); persist(); submitProfile(); }
  else if (b.id === 'sp-add-goal') {
    const occ = (S.profile?.occupation || '').trim();
    const gName = occ ? `${t('sp_goal_prefix')}: ${occ.slice(0, 32)}` : t('sp_goal_default');
    const targ = Math.max(1500, Math.round((P().income || 1200) * 3));
    S.goals.push({ name: gName, target: targ, current: 0, date: Engine.addMonths(nowYM(), 18), monthly: '' });
    gsel = S.goals.length - 1; drawLists(); renderAll(); go('goals'); if (window.petSay) petSay(t('sp_goal_added'));
  }
  else if (b.id === 'sp-ask-ai') { $('#chat').hidden = false; ask(t('c_sp2')); }
  else if (b.id === 'lexp') exportLedgerCsv();
  else if (b.id === 'exp-json') dlFile('moneymente-plan.json', 'application/json;charset=utf-8', JSON.stringify(S, null, 2));
  else if (b.id === 'imp-json') $('#imp-file')?.click();
  else if (b.id === 'quiz-btn') { S.quizOpen = !S.quizOpen; drawQuiz(); persist(); }
  else if (b.id === 'quiz-done') {
    const score = Engine.score(P(), Engine.budget(S.cats, P().income), S.quiz);
    if (!score.quizDone) { S.quizOpen = true; $('#quiz-banner').innerHTML = `<span>${esc(t('score_pending'))}</span>`; drawQuiz(); return; }
    S.quizOpen = false; drawQuiz(); renderAll(); if (window.petSay) petSay(t('pet_quiz_ok'));
  }
  else if (b.id === 'lfill' || b.id === 'p-fill') fillLedgerYear(+S.ledgerYear || curYear());
  else if (b.id === 'add-task') {
    const title = $('#nt-title')?.value?.trim(); if (!title) return;
    S.actions.push({ title, ym: $('#nt-ym')?.value || Engine.addMonths(nowYM(), 1), amount: num($('#nt-amt')?.value), done: false });
    renderAll();
  }
  else if (b.id === 'listen') say(nextText); else if (b.id === 'tour') tour(); else if (b.id === 'print') { buildReport(); window.print(); }
  else if (b.id === 'aisum' && window.genReportSummary) window.genReportSummary();
  else if (b.id === 'demo') demo(); else if (b.id === 'restore-demo') { try { const backup = localStorage.getItem(DEMO_BACKUP_KEY); S = backup ? normalizeState(JSON.parse(backup)) : fresh(); } catch { S = fresh(); } localStorage.removeItem(DEMO_BACKUP_KEY); drawLists(); renderAll(); } else if (b.id === 'reset') { if (confirm(t('reset_q'))) { localStorage.removeItem(DEMO_BACKUP_KEY); S = fresh(); drawLists(); renderAll(); } }
  else if (b.id === 'askplan') { $('#chat').hidden = false; ask(t('c1')); }
});
$('#lang').addEventListener('change', e => { lang = e.target.value; localStorage.setItem('lang', lang); if (canSpeak) speechSynthesis.cancel(); load(); });
async function load() {
  T = await (await fetch('i18n/' + lang + '.json')).json();
  document.documentElement.lang = lang; $('#lang').value = lang;
  $$('[data-i18n]').forEach(e => e.textContent = t(e.dataset.i18n));
  $$('[data-i18n-aria]').forEach(e => e.setAttribute('aria-label', t(e.dataset.i18nAria)));
  $$('[data-i18n-alt]').forEach(e => e.setAttribute('alt', t(e.dataset.i18nAlt)));
  $('.vmenu').hidden = !canSpeak; drawLists(); renderAll(); go(tab); if (window.onLoaded) onLoaded();
}
load();
