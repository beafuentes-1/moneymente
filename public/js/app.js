const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
let T = {}, lang = ((localStorage.getItem('lang') || navigator.language || 'en').slice(0, 2)) === 'es' ? 'es' : 'en';
let tab = 'overview', gsel = 0, touring = false, nextText = '';
const canSpeak = 'speechSynthesis' in window, KEY = 'moneymente.v1';
const nowYM = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const num = x => Math.max(0, +x || 0);
const esc = s => String(s ?? '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const t = (k, v = {}) => String(T[k] ?? k).replace(/\{(\w+)\}/g, (_, x) => v[x]);
const money = n => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString(lang);
const short = n => { const a = Math.abs(n), s = n < 0 ? '-' : ''; return a >= 1e6 ? s + '$' + (a / 1e6).toFixed(1) + 'M' : a >= 1e3 ? s + '$' + Math.round(a / 1e3) + 'k' : s + '$' + Math.round(a); };
const mlabel = (ym, long) => { const [y, m] = ym.split('-'); return new Intl.DateTimeFormat(lang, { month: 'short', year: long ? 'numeric' : '2-digit' }).format(new Date(+y, +m - 1, 1)); };
const COL = ['#da291c', '#4aa3ff', '#ffffff', '#9db0d3', '#ff7a6e', '#2f6fd6', '#d9e2f5', '#8a1a12', '#7ec0ff', '#ffb3ab'];
const mk = a => a.map(([key, amount, type]) => ({ key, amount, type }));
const fresh = () => ({ income: 1000, savings: 0, invested: 0, extra: '', ret: { y: 30, r: 7, m: '' }, debts: [], goals: [], special: [], hist: {},
  cats: mk([['housing', 300, 'need'], ['food', 200, 'need'], ['transport', 80, 'need'], ['utilities', 70, 'need'], ['health', 30, 'need'], ['fun', 60, 'want'], ['shopping', 40, 'want'], ['other', 20, 'want']]) });
let S; try { S = { ...fresh(), ...JSON.parse(localStorage.getItem(KEY)) }; } catch { S = fresh(); }
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
function fc() {
  const p = P(), b = Engine.budget(S.cats, p.income), rows = Engine.forecast(p, b, S.special.map(s => ({ ym: s.ym, kind: s.kind, amount: num(s.amount) })), nowYM());
  return { rows, low: rows.reduce((a, r) => r.balance < a.balance ? r : a, rows[0]), deficits: rows.filter(r => r.net < 0).length, inc: rows.reduce((s, r) => s + r.income, 0), exp: rows.reduce((s, r) => s + r.expenses, 0) };
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
const sel = (path, opts, ph) => `<select data-b="${path}" aria-label="${esc(ph)}">${opts.map(([v, l]) => `<option value="${v}" ${String(val(path)) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
const fld = (path, type, ph) => `<label class="f"><span>${esc(ph)}</span>${inp(path, type, ph)}</label>`, sfld = (path, opts, ph) => `<label class="f"><span>${esc(ph)}</span>${sel(path, opts, ph)}</label>`;
const dateOpts = () => [...Array(60).keys()].map(i => i + 1).concat(Array.from({ length: 25 }, (_, i) => (i + 6) * 12)).map(n => { const ym = Engine.addMonths(nowYM(), n); return [ym, mlabel(ym, 1)]; });
const monthOpts = () => Array.from({ length: 12 }, (_, i) => { const ym = Engine.addMonths(nowYM(), i + 1); return [ym, mlabel(ym, 1)]; });
const ADD = { debts: () => ({ name: '', balance: '', rate: '', min: '' }), cats: () => ({ name: '', amount: '', type: 'want' }),
  goals: () => ({ name: '', target: '', current: '', date: Engine.addMonths(nowYM(), 24), monthly: '' }), special: () => ({ name: '', ym: Engine.addMonths(nowYM(), 1), amount: '', kind: 'exp' }) };
function drawLists() {
  $$('#income,#savings,#invested').forEach(e => e.value = S[e.id]);
  const p = P(), sur = Math.max(0, p.income - p.expenses); $('#extra').value = S.extra; $('#extra').placeholder = money(sur);
  $('#debts').innerHTML = S.debts.map((d, i) => `<div class="row4">${['name', 'balance', 'rate', 'min'].map(k => inp(`debts.${i}.${k}`, k === 'name' ? 'text' : 'number', t('d_' + k))).join('')}<button class="x" data-del="debts.${i}" aria-label="Delete">✕</button></div>`).join('');
  $('#cats').innerHTML = S.cats.map((c, i) => `<div class="row3">${inp(`cats.${i}.name`, 'text', t('d_name'), catName(c))}${inp(`cats.${i}.amount`, 'number', t('cat_amt'))}${sel(`cats.${i}.type`, [['need', t('need')], ['want', t('want')]], t('cat_type'))}<button class="x" data-del="cats.${i}" aria-label="Delete">✕</button></div>`).join('');
  $('#goals').innerHTML = S.goals.length ? S.goals.map((g, i) => `<div class="goal"><div class="gin">${fld(`goals.${i}.name`, 'text', t('g_name'))}${fld(`goals.${i}.target`, 'number', t('g_target'))}${fld(`goals.${i}.current`, 'number', t('g_have'))}${sfld(`goals.${i}.date`, dateOpts(), t('g_date'))}${fld(`goals.${i}.monthly`, 'number', t('g_monthly'))}<button class="x" data-del="goals.${i}" aria-label="Delete">✕</button></div><div class="gres" data-gi="${i}"></div></div>`).join('') : `<p class="mu">${t('g_none')}</p>`;
  gsel = Math.min(gsel, Math.max(0, S.goals.length - 1));
  $('#gsel').innerHTML = S.goals.map((g, i) => `<option value="${i}" ${i === gsel ? 'selected' : ''}>${esc(g.name || t('g_unnamed'))}</option>`).join('');
  $('#special').innerHTML = S.special.map((s, i) => `<div class="sp">${fld(`special.${i}.name`, 'text', t('y_name'))}${sfld(`special.${i}.ym`, monthOpts(), t('y_month'))}${fld(`special.${i}.amount`, 'number', t('y_amt'))}${sfld(`special.${i}.kind`, [['exp', t('y_exp')], ['inc', t('y_inc')]], '·')}<button class="x" data-del="special.${i}" aria-label="Delete">✕</button></div>`).join('');
  $('#hist').innerHTML = Array.from({ length: 12 }, (_, i) => Engine.addMonths(nowYM(), i - 12)).map(ym => `<div class="hh"><b>${mlabel(ym, 1)}</b>${inp(`hist.${ym}.income`, 'number', t('income'))}${inp(`hist.${ym}.expenses`, 'number', t('y_exp'))}</div>`).join('');
  const rm = S.ret.m === '' ? Math.round(sur / 2 / 10) * 10 : S.ret.m;
  $('#retctl').innerHTML = `<div class="grid3">${[['y', 1, 40, 1, S.ret.y], ['r', 1, 12, 1, S.ret.r], ['m', 0, Math.max(500, Math.round(sur * 2)), 10, rm]].map(([k, a, b, st, v]) => `<label class="f"><span>${t(k)}: <b id="${k}v"></b></span><input data-b="ret.${k}" type="range" min="${a}" max="${b}" step="${st}" value="${v}"></label>`).join('')}</div>`;
}

// ---------- chart helpers ----------
const catParts = () => S.cats.map((c, i) => ({ name: catName(c), v: num(c.amount), color: COL[i % COL.length] })).filter(x => x.v > 0);
function drawBars3(cv, b) { Charts.bars(cv, [['needs', b.pct.needs, 50, '#4aa3ff'], ['wants', b.pct.wants, 30, '#ffffff'], ['save', b.pct.save, 20, '#da291c']].map(([k, v, g, c]) => ({ name: t('bar_' + k), v, target: g, color: c }))); }
function drawGoalBars(cv, gs) {
  cv.height = Math.max(120, gs.length * 58 + 24); if (!gs.length) return;
  Charts.bars(cv, gs.map(g => ({ name: g.name.slice(0, 14), v: g.target ? g.proj.b / g.target * 100 : 0, target: 100, color: g.status === 'on' ? '#4aa3ff' : g.status === 'close' ? '#ffffff' : '#da291c' })));
}
const yearNames = () => [t('y_inc'), t('y_exp'), t('y_bal')];
const yrows = f => f.rows.map(r => ({ label: mlabel(r.ym), income: r.income, expenses: r.expenses, balance: r.balance }));
const hrows = () => Array.from({ length: 12 }, (_, i) => { const ym = Engine.addMonths(nowYM(), i - 12), h = S.hist[ym]; return { label: mlabel(ym), income: num(h?.income), expenses: num(h?.expenses), has: !!(h && (h.income || h.expenses)) }; });

// ---------- render ----------
function renderAll() {
  const p = P(), b = Engine.budget(S.cats, p.income), L = Engine.levels(LP()), cur = L.indexOf(false), k = Engine.kpis(p), sc = Engine.score(p, b), gs = goalsCalc(p), f = fc(), sur = k.surplus;
  $('#etot').textContent = money(p.expenses);
  $('#kpis').innerHTML = [['kpi_net', money(k.net)], ['kpi_sur', money(sur)], ['kpi_rate', k.rate.toFixed(0) + '%'], ['kpi_run', k.runway.toFixed(1) + ' ' + t('mo')], ['kpi_debt', money(Engine.debtTotal(p.debts))]].map(([a, v]) => `<div class="kpi"><span>${t(a)}</span><b>${v}</b></div>`).join('');
  const grd = sc.total >= 80 ? 'a' : sc.total >= 60 ? 'b' : sc.total >= 40 ? 'c' : 'd', arc = 'M20 95 A70 70 0 0 1 160 95', len = Math.PI * 70;
  $('#gauge').innerHTML = `<svg viewBox="0 0 180 112" class="gauge" role="img" aria-label="${sc.total}/100"><defs><linearGradient id="gg" x1="0" x2="1"><stop offset="0" stop-color="#da291c"/><stop offset="1" stop-color="#4aa3ff"/></linearGradient></defs><path d="${arc}" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="12" stroke-linecap="round"/><path d="${arc}" fill="none" stroke="url(#gg)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${len}" stroke-dashoffset="${len * (1 - sc.total / 100)}"/><text x="90" y="84" text-anchor="middle" class="gv">${sc.total}</text><text x="90" y="104" text-anchor="middle" class="gl">${t('gr_' + grd)}</text></svg>`;
  $('#parts').innerHTML = Object.entries(sc.parts).map(([x, v]) => `<li><span>${t('sc_' + x)}</span><div class="m"><i style="width:${v}%"></i></div><b>${Math.round(v)}</b></li>`).join('');
  const starter = Math.min(1000, p.expenses || 1000), full = p.expenses * 3, eta = (c, g) => { const m = Engine.months(c, g, sur); return m === 0 ? t('reached') : m === Infinity ? t('nosurplus') : t('monthsTo', { n: m }); };
  const dr = Engine.payoff(p.debts, Math.max(0, sur), 'avalanche'), fin = Engine.compound(p.invested, Math.max(0, sur / 2), 7, 30).pop();
  const detail = [t('nb0'), `${t('target')}: ${money(starter)}. ${eta(p.savings, starter)}`, dr.ok ? t('res', { m: dr.months, i: money(dr.interest) }) : t('never'), `${t('target')}: ${money(full)}. ${eta(p.savings, full)}`,
    gs.length ? t('nb4', { n: gs.filter(x => x.status !== 'on').length }) : t('nb4none'), t('steps'), t('final', { y: 30, v: money(fin.v), c: money(fin.c) })][cur];
  nextText = `${t('l' + (cur + 1) + 't')}. ${t('l' + (cur + 1) + 'd')} ${detail}`;
  $('#next').innerHTML = `<small class="eyebrow">${t('next_t')}</small><h2>${t('l' + (cur + 1) + 't')}</h2><p>${t('l' + (cur + 1) + 'd')}</p><p class="hl">${detail}</p><p class="tip">💡 ${t('tip' + (cur + 1))}</p><div class="acts">${canSpeak ? `<button class="btn" id="listen">🔊 ${t('listen')}</button>` : ''}<button class="ghost" data-go="${['numbers', 'numbers', 'numbers', 'numbers', 'goals', 'goals', 'goals'][cur]}">${t('go_t')}</button><button class="ghost" id="askplan">${t('ask_buck')}</button></div>`;
  $('#ins').innerHTML = `<h2>${t('ins_t')}</h2>${insights(p, b, gs, f).map(x => `<p class="tip">${x}</p>`).join('')}`;
  $('#steps').innerHTML = L.map((d, i) => { const c = d ? 'done' : i === cur ? 'now' : 'next'; return `<li class="${c}"><span class="dot">${d ? '✓' : ''}</span><div><b>${t('l' + (i + 1) + 't')}</b> <small>${t('st_' + c)}</small>${c === 'now' ? `<small>${t('l' + (i + 1) + 'd')}</small>` : ''}</div></li>`; }).join('');
  // numbers
  $('#bchart').innerHTML = `<h2>${t('b_h')}</h2><canvas id="bc1" width="800" height="${Math.max(300, catParts().length * 26 + 70)}"></canvas><canvas id="bc2" width="800" height="190"></canvas><small>${t('bar_note')}</small>`;
  if (catParts().length) Charts.donut($('#bc1'), catParts(), money); drawBars3($('#bc2'), b);
  const dt = Engine.debtTotal(p.debts); $('#debtsim').hidden = dt <= 0;
  if (dt > 0) { const ex = S.extra === '' ? Math.round(Math.max(0, sur)) : num(S.extra), rs = ['snowball', 'avalanche'].map(m => [m, Engine.payoff(p.debts, ex, m)]);
    $('#dres').innerHTML = rs.map(([m, r]) => `<div><h3>${t(m)}</h3><p>${r.ok ? t('res', { m: r.months, i: money(r.interest) }) : t('never')}</p></div>`).join('');
    Charts.line($('#dc'), [{ name: t('snowball'), color: '#4aa3ff', d: rs[0][1].series }, { name: t('avalanche'), color: '#ffffff', d: rs[1][1].series }], short); }
  // goals
  $$('.gres').forEach(el => { const g = gs[+el.dataset.gi]; if (!g) return;
    el.innerHTML = `<div class="meter"><i style="width:${g.pct}%"></i></div><p><span class="pill ${g.status}">${t('g_' + g.status)}</span> ${money(g.current)} / ${money(g.target)} · ${g.months} ${t('mo')}</p><p>${t('g_need')}: <b>${money(g.need)}</b> · ${t('g_plan')}: <b>${money(g.planned)}</b></p><p class="mu">${t('g_proj')}: ${t('scen_c')} ${money(g.proj.c)} · ${t('scen_b')} ${money(g.proj.b)} · ${t('scen_o')} ${money(g.proj.o)}</p>`; });
  drawGoalBars($('#gb'), gs);
  const g = gs[gsel]; if (g) { const m = Math.min(g.months, 360); Charts.line($('#gc'), [{ name: t('scen_c'), color: '#9db0d3', d: Engine.path(g.current, g.planned, m, 3) }, { name: t('scen_b'), color: '#4aa3ff', d: Engine.path(g.current, g.planned, m, 6) }, { name: t('scen_o'), color: '#ffffff', d: Engine.path(g.current, g.planned, m, 9) }, { name: t('g_target'), color: '#da291c', dash: [8, 6], d: Array(m + 1).fill(g.target) }], short); }
  else $('#gc').getContext('2d').clearRect(0, 0, 800, 320);
  const rm = S.ret.m === '' ? Math.round(Math.max(0, sur) / 2 / 10) * 10 : +S.ret.m, ry = +S.ret.y, rr = +S.ret.r, rs2 = Engine.compound(p.invested, rm, rr, ry), re = rs2[rs2.length - 1];
  $('#yv').textContent = ry; $('#rv').textContent = rr; $('#mv').textContent = money(rm); $('#retfin').textContent = t('final', { y: ry, v: money(re.v), c: money(re.c) });
  Charts.line($('#rc'), [{ name: t('ch_val'), color: '#4aa3ff', d: rs2.map(x => x.v) }, { name: t('ch_con'), color: '#9db0d3', d: rs2.map(x => x.c) }], short);
  // year
  Charts.year($('#yc'), yrows(f), short, yearNames());
  const hr = hrows(), hh = hr.filter(r => r.has), avg = (a, key) => a.length ? a.reduce((s, r) => s + r[key], 0) / a.length : 0;
  $('#ysum').innerHTML = `<p class="hl">${t('y_sum', { i: money(f.inc), e: money(f.exp), n: money(f.inc - f.exp) })} ${t('y_low', { v: money(f.low.balance), m: mlabel(f.low.ym, 1) })}${f.deficits ? ' ' + t('y_def', { n: f.deficits }) : ''}${hh.length ? '<br>' + t('y_cmp', { h: money(avg(hh, 'expenses')), f: money(f.exp / 12) }) : ''}</p>`;
  $('#hc').hidden = !hh.length; if (hh.length) Charts.year($('#hc'), hr, short, yearNames());
  if (tab === 'report') buildReport();
  persist();
}
function buildReport() {
  const p = P(), b = Engine.budget(S.cats, p.income), sc = Engine.score(p, b), gs = goalsCalc(p), f = fc(), L = Engine.levels(LP()), cur = L.indexOf(false), k = Engine.kpis(p);
  const shot = (fn, w, h) => { try { const c = document.createElement('canvas'); c.width = w; c.height = h; Charts.light = true; fn(c); Charts.light = false; return `<img alt="" src="${c.toDataURL()}">`; } catch { Charts.light = false; return ''; } };
  const grd = sc.total >= 80 ? 'a' : sc.total >= 60 ? 'b' : sc.total >= 40 ? 'c' : 'd', parts = catParts();
  $('#report').innerHTML = `<div class="rh"><span class="mark dark"><i></i><i></i><i></i></span><div><h1>${t('title')} · ${t('r_doc')}</h1><small>${t('r_date', { d: new Date().toLocaleDateString(lang) })}</small></div></div>
<h2>${t('r_score')}: ${sc.total}/100 (${t('gr_' + grd)})</h2><table>${Object.entries(sc.parts).map(([x, v]) => `<tr><td>${t('sc_' + x)}</td><td>${Math.round(v)}/100</td></tr>`).join('')}</table>
<table><tr><td>${t('kpi_net')}</td><td>${money(k.net)}</td><td>${t('kpi_sur')}</td><td>${money(k.surplus)}</td></tr><tr><td>${t('kpi_rate')}</td><td>${k.rate.toFixed(0)}%</td><td>${t('kpi_run')}</td><td>${k.runway.toFixed(1)} ${t('mo')}</td></tr></table>
<h2>${t('r_budget')}</h2><table><tr><th>${t('cat_col')}</th><th>${t('amt_col')}</th><th>${t('pct_col')}</th></tr>${S.cats.map(c => `<tr><td>${esc(catName(c))}</td><td>${money(num(c.amount))}</td><td>${p.income ? Math.round(num(c.amount) / p.income * 100) : 0}%</td></tr>`).join('')}</table>${parts.length ? shot(c => Charts.donut(c, parts, money), 800, Math.max(300, parts.length * 26 + 70)) : ''}${shot(c => drawBars3(c, b), 800, 190)}
${p.debts.some(d => d.balance > 0) ? `<h2>${t('r_debts')}</h2><table><tr><th>${t('d_name')}</th><th>${t('d_balance')}</th><th>${t('d_rate')}</th><th>${t('d_min')}</th></tr>${S.debts.map(d => `<tr><td>${esc(d.name)}</td><td>${money(num(d.balance))}</td><td>${num(d.rate)}%</td><td>${money(num(d.min))}</td></tr>`).join('')}</table>` : ''}
${gs.length ? `<h2>${t('r_goals')}</h2><table><tr><th>${t('g_name')}</th><th>${t('g_target')}</th><th>${t('g_have')}</th><th>${t('g_need')}</th><th>${t('g_plan')}</th><th></th></tr>${gs.map(g => `<tr><td>${esc(g.name)}</td><td>${money(g.target)}</td><td>${money(g.current)}</td><td>${money(g.need)}</td><td>${money(g.planned)}</td><td>${t('g_' + g.status)}</td></tr>`).join('')}</table>${shot(c => drawGoalBars(c, gs), 800, Math.max(120, gs.length * 58 + 24))}` : ''}
<h2>${t('r_year')}</h2><p>${t('y_sum', { i: money(f.inc), e: money(f.exp), n: money(f.inc - f.exp) })} ${t('y_low', { v: money(f.low.balance), m: mlabel(f.low.ym, 1) })}</p>${shot(c => Charts.year(c, yrows(f), short, yearNames()), 800, 340)}
<h2>${t('r_plan')}</h2><ol>${L.map((d, i) => `<li>${d ? '✓ ' : i === cur ? '→ ' : ''}${t('l' + (i + 1) + 't')}</li>`).join('')}</ol><p><small>${t('disc')}</small></p>`;
}
// ---------- navigation, audio, events ----------
function go(name) { tab = name; $$('[data-view]').forEach(s => s.classList.toggle('on', s.dataset.view === name)); $$('#tabs button').forEach(b => b.setAttribute('aria-current', b.dataset.tab === name ? 'page' : 'false')); if (name === 'report') buildReport(); window.scrollTo(0, 0); }
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
  const n = nowYM(), a = k => Engine.addMonths(n, k);
  S = { ...fresh(), income: 2200, savings: 900, invested: 300, debts: [{ name: t('dd1'), balance: 1800, rate: 28, min: 60 }, { name: t('dd2'), balance: 600, rate: 12, min: 35 }],
    cats: mk([['housing', 520, 'need'], ['food', 380, 'need'], ['transport', 160, 'need'], ['utilities', 130, 'need'], ['health', 60, 'need'], ['fun', 150, 'want'], ['shopping', 110, 'want'], ['other', 90, 'want']]),
    goals: [{ name: t('dg1'), target: 7000, current: 900, date: a(18), monthly: '' }, { name: t('dg2'), target: 1200, current: 200, date: a(8), monthly: '' }, { name: t('dg3'), target: 15000, current: 0, date: a(60), monthly: 200 }],
    special: [{ name: t('ds1'), ym: a(1), amount: 250, kind: 'exp' }, { name: t('ds2'), ym: a(2), amount: 400, kind: 'inc' }, { name: t('ds3'), ym: a(6), amount: 600, kind: 'exp' }],
    hist: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [a(i - 12), { income: 2100 + (i * 37) % 100, expenses: 1650 + (i * 53) % 260 + (i === 11 ? 300 : 0) }])) };
  drawLists(); renderAll();
}
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.b) { setPath(el.dataset.b, el.value); renderAll(); } else if (el.id === 'gsel') { gsel = +el.value; renderAll(); }
});
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
  if (d.tab) go(d.tab); else if (d.go) go(d.go);
  else if (d.del) { const [k, i] = d.del.split('.'); S[k].splice(+i, 1); drawLists(); renderAll(); }
  else if (d.add) { S[d.add].push(ADD[d.add]()); drawLists(); renderAll(); }
  else if (b.id === 'listen') say(nextText); else if (b.id === 'tour') tour(); else if (b.id === 'print') { buildReport(); window.print(); }
  else if (b.id === 'demo') demo(); else if (b.id === 'reset') { if (confirm(t('reset_q'))) { S = fresh(); drawLists(); renderAll(); } }
  else if (b.id === 'askplan') { $('#chat').hidden = false; ask(t('c1')); }
});
$('#lang').addEventListener('change', e => { lang = e.target.value; localStorage.setItem('lang', lang); if (canSpeak) speechSynthesis.cancel(); load(); });
async function load() {
  T = await (await fetch('i18n/' + lang + '.json')).json();
  document.documentElement.lang = lang; $('#lang').value = lang;
  $$('[data-i18n]').forEach(e => e.textContent = t(e.dataset.i18n));
  $('.vmenu').hidden = !canSpeak; drawLists(); renderAll(); go(tab); if (window.onLoaded) onLoaded();
}
load();
