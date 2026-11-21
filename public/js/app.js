const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
let T = {}, lang = (localStorage.getItem('lang') || (navigator.language || 'en').slice(0, 2)) === 'es' ? 'es' : 'en';
let sel = null, touring = false, extra = null;
const debts = [];
const canSpeak = 'speechSynthesis' in window;
const t = (k, v = {}) => (T[k] || k).replace(/\{(\w+)\}/g, (_, x) => v[x]);
const money = n => '$' + Math.round(n).toLocaleString(lang);
const num = id => Math.max(0, +$('#' + id).value || 0);

async function load() {
  T = await (await fetch('i18n/' + lang + '.json')).json();
  document.documentElement.lang = lang; $('#lang').value = lang;
  $$('[data-i18n]').forEach(e => e.textContent = t(e.dataset.i18n));
  if (!canSpeak) $('#tour').hidden = true;
  drawDebts(); render();
}
function drawDebts() {
  $('#debts').innerHTML = debts.map((d, i) => `<div class="row">${['name', 'balance', 'rate', 'min'].map(k =>
    `<input data-i="${i}" data-k="${k}" type="${k === 'name' ? 'text' : 'number'}" min="0" placeholder="${t('d_' + k)}" aria-label="${t('d_' + k)}" value="${d[k]}">`).join('')}<button data-del="${i}" aria-label="Delete">✕</button></div>`).join('');
}
const profile = () => ({ income: num('income'), expenses: num('expenses'), savings: num('savings'), invested: num('invested'), goal: num('goal'),
  debts: debts.map(d => ({ balance: +d.balance || 0, rate: +d.rate || 0, min: +d.min || 0 })) });

function render() {
  const p = profile(), L = Engine.levels(p), cur = L.indexOf(false);
  if (sel === null || sel > cur) sel = cur;
  const done = L.filter(Boolean).length;
  $('#xp').textContent = t('xp', { n: done * 100 }); $('#fill').style.width = done / 7 * 100 + '%';
  $('#levels').innerHTML = L.map((d, i) => `<li class="${d ? 'done' : i === cur ? 'cur' : 'lock'} ${i === sel ? 'sel' : ''}"><button data-l="${i}" ${i > cur ? 'disabled' : ''}>${d ? '✅' : i > cur ? '🔒' : '👉'} ${t('l' + (i + 1) + 't')}</button></li>`).join('');
  showLevel(sel, p);
}
const bar = (a, b) => `<div class="track"><div style="width:${Math.min(100, b ? a / b * 100 : 0)}%"></div></div><p>${money(a)} / ${money(b)}</p>`;
const sim = (p, x) => ['snowball', 'avalanche'].map(m => { const r = Engine.payoff(p.debts, x, m);
  return `<div><h4>${t(m)}</h4><p>${r.ok ? t('res', { m: r.months, i: money(r.interest) }) : t('never')}</p></div>`; }).join('');

function showLevel(i, p) {
  const sur = p.income - p.expenses, eta = (c, g) => { const m = Engine.months(c, g, sur); return m === 0 ? t('reached') : m === Infinity ? t('nosurplus') : t('monthsTo', { n: m }); };
  const starter = Math.min(1000, p.expenses || 1000), full = p.expenses * 3; let body = '';
  if (i === 0) body = `<table>${[['needs', .5], ['wants', .3], ['save', .2]].map(([k, f]) => `<tr><td>${t(k)}</td><td><b>${money(p.income * f)}</b></td></tr>`).join('')}</table><p>${t('surplus', { n: money(sur) })}</p>`;
  else if (i === 1) body = `<p>${t('target')}: ${money(starter)}</p>${bar(p.savings, starter)}<p>${eta(p.savings, starter)}</p>`;
  else if (i === 2) { if (extra === null) extra = Math.max(0, Math.round(sur));
    body = Engine.debtTotal(p.debts) <= 0 ? `<p>${t('nodebt')}</p>` : `<label><span>${t('extra')}</span><input id="extra" type="number" min="0" value="${extra}"></label><div class="two" id="sim">${sim(p, extra)}</div>`; }
  else if (i === 3) body = `<p>${t('target')}: ${money(full)}</p>${bar(p.savings, full)}<p>${eta(p.savings, full)}</p>`;
  else if (i === 4) body = `<p>${t('target')}: ${money(full + p.goal)}</p>${bar(p.savings, full + p.goal)}<p>${eta(p.savings, full + p.goal)}</p>`;
  else if (i === 5) body = `<p>${t('steps')}</p><p>${t('surplus', { n: money(sur) })}</p>`;
  else body = `<div class="grid">${[['y', 1, 40, 30], ['r', 1, 12, 7], ['m', 0, Math.max(500, Math.round(sur * 2)), Math.round(Math.max(0, sur) / 2 / 10) * 10]].map(([k, a, b, v]) =>
    `<label><span>${t(k)}: <b id="${k}v"></b></span><input id="${k}" type="range" min="${a}" max="${b}" step="${k === 'm' ? 10 : 1}" value="${v}"></label>`).join('')}</div><canvas id="cv" width="800" height="320"></canvas><p id="fin"></p>`;
  $('#level').innerHTML = `<h2>${t('l' + (i + 1) + 't')}</h2><p>${t('l' + (i + 1) + 'd')}</p>${canSpeak ? `<button id="listen">${t('listen')}</button>` : ''}${body}`;
  if (i === 6) drawRet(p);
}
function drawRet(p) {
  const y = +$('#y').value, r = +$('#r').value, m = +$('#m').value, s = Engine.compound(p.invested, m, r, y), e = s[s.length - 1];
  $('#yv').textContent = y; $('#rv').textContent = r; $('#mv').textContent = money(m);
  $('#fin').textContent = t('final', { y, v: money(e.v), c: money(e.c) });
  const cv = $('#cv'), c = cv.getContext('2d'), W = cv.width, H = cv.height, max = Math.max(e.v, 1);
  c.clearRect(0, 0, W, H);
  [['c', '#8aa39b'], ['v', '#0f7b5f']].forEach(([k, col]) => { c.beginPath();
    s.forEach((x, n) => { const X = 20 + n * (W - 40) / (s.length - 1), Y = H - 20 - x[k] / max * (H - 40); n ? c.lineTo(X, Y) : c.moveTo(X, Y); });
    c.strokeStyle = col; c.lineWidth = 4; c.stroke(); });
}
// Audio: browser built-in voices, no files or keys.
function say(text) {
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = lang === 'es' ? 'es-ES' : 'en-US';
  const v = speechSynthesis.getVoices().find(v => v.lang.startsWith(lang)); if (v) u.voice = v;
  return new Promise(r => { u.onend = u.onerror = r; speechSynthesis.speak(u); });
}
async function tour() {
  if (touring) { touring = false; speechSynthesis.cancel(); return; }
  touring = true; $('#tour').textContent = t('stop');
  for (const [s, k] of [['header', 't_welcome'], ['#profile', 't_profile'], ['#map', 't_map'], ['#level', 't_level']]) {
    if (!touring) break;
    const el = $(s); el.classList.add('spot'); el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await say(t(k)); el.classList.remove('spot');
  }
  touring = false; $('#tour').textContent = t('tour');
}
document.addEventListener('input', e => {
  const d = e.target.dataset;
  if (d.k) debts[d.i][d.k] = e.target.value;
  if (e.target.closest('#profile')) render();
  else if (e.target.id === 'extra') { extra = +e.target.value || 0; $('#sim').innerHTML = sim(profile(), extra); }
  else if (e.target.closest('#level') && e.target.type === 'range') drawRet(profile());
});
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.l) { sel = +b.dataset.l; render(); }
  else if (b.dataset.del) { debts.splice(+b.dataset.del, 1); drawDebts(); render(); }
  else if (b.id === 'addDebt') { debts.push({ name: '', balance: '', rate: '', min: '' }); drawDebts(); }
  else if (b.id === 'listen') say(t('l' + (sel + 1) + 'd'));
  else if (b.id === 'tour') tour();
});
$('#lang').addEventListener('change', e => { lang = e.target.value; localStorage.setItem('lang', lang); speechSynthesis && speechSynthesis.cancel(); load(); });
load();
