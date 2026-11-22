// Pure finance logic (no DOM). The bot never does math: this engine does.
(function (root) {
  const E = {};
  E.debtTotal = d => d.reduce((s, x) => s + (+x.balance || 0), 0);
  E.months = (cur, target, monthly) => cur >= target ? 0 : monthly <= 0 ? Infinity : Math.ceil((target - cur) / monthly);
  // mode: 'snowball' (smallest balance first) | 'avalanche' (highest rate first)
  E.payoff = (debts, extra, mode) => {
    let ds = debts.filter(d => +d.balance > 0).map(d => ({ balance: +d.balance, rate: +d.rate || 0, min: +d.min || 0 }));
    if (!ds.length) return { months: 0, interest: 0, ok: true, series: [0] };
    const budget = ds.reduce((s, d) => s + d.min, 0) + (+extra || 0);
    if (budget <= 0) return { months: Infinity, interest: Infinity, ok: false, series: [0] };
    let m = 0, interest = 0; const sum = () => ds.reduce((a, d) => a + d.balance, 0), series = [sum()];
    while (ds.length && m < 600) {
      m++;
      ds.sort(mode === 'avalanche' ? (a, b) => b.rate - a.rate : (a, b) => a.balance - b.balance);
      let pool = budget;
      for (const d of ds) { const i = d.balance * d.rate / 1200; d.balance += i; interest += i; }
      for (const d of ds) { const p = Math.min(d.min, d.balance, pool); d.balance -= p; pool -= p; }
      for (const d of ds) { if (pool <= 0) break; const p = Math.min(pool, d.balance); d.balance -= p; pool -= p; }
      ds = ds.filter(d => d.balance > 0.005); series.push(sum());
    }
    return { months: m, interest, ok: !ds.length, series };
  };
  E.compound = (start, monthly, ratePct, years) => {
    const r = ratePct / 1200, out = []; let v = start, c = start;
    for (let y = 0; y <= years; y++) { out.push({ y, v, c }); for (let k = 0; k < 12; k++) { v = v * (1 + r) + monthly; c += monthly; } }
    return out;
  };
  E.kpis = p => ({ surplus: p.income - p.expenses, rate: p.income ? (p.income - p.expenses) / p.income * 100 : 0, runway: p.expenses ? p.savings / p.expenses : 0, net: p.savings + p.invested - E.debtTotal(p.debts) });
  E.budget = (cats, income) => { const n = c => +c.amount || 0, total = cats.reduce((s, c) => s + n(c), 0), needs = cats.filter(c => c.type === 'need').reduce((s, c) => s + n(c), 0),
    catSave = cats.filter(c => c.type === 'save').reduce((s, c) => s + n(c), 0), wants = Math.max(0, total - needs - catSave),
    pc = v => income ? v / income * 100 : 0, save = Math.max(0, income - total) + catSave;
    return { total, needs, wants, save, pct: { needs: pc(needs), wants: pc(wants), save: pc(save) }, top: [...cats].sort((a, b) => n(b) - n(a))[0] }; };
  E.score = (p, b, quiz) => {
    const k = E.kpis(p), cl = v => Math.max(0, Math.min(100, v)), inc = p.income || 0;
    const numParts = { save: cl(b.pct.save / 20 * 100), run: cl(k.runway / 6 * 100), debt: inc ? cl(100 - E.debtTotal(p.debts) / (inc * 12) * 100) : 0,
      bal: inc ? cl(100 - Math.max(0, b.pct.needs - 50) * 2 - Math.max(0, b.pct.wants - 30) * 2) : 0, inv: inc ? cl(p.invested / (inc * 6) * 100) : 0 };
    const w = { save: .25, run: .25, debt: .2, bal: .15, inv: .15 }, keys = Object.keys(w);
    const answerValid = x => quiz && quiz[x] !== undefined && quiz[x] !== '' && quiz[x] !== null && Number.isFinite(+quiz[x]) && +quiz[x] >= 0 && +quiz[x] <= 100;
    const hasQuiz = keys.some(answerValid);
    const quizDone = keys.every(answerValid);
    const parts = {};
    for (const x of keys) {
      const hasQ = answerValid(x);
      parts[x] = hasQ ? (inc ? cl(numParts[x] * 0.6 + cl(+quiz[x] || 0) * 0.4) : cl(+quiz[x] || 0)) : numParts[x];
    }
    return { total: quizDone ? Math.round(keys.reduce((s, x) => s + parts[x] * w[x], 0)) : 0, parts, numParts, hasQuiz, quizDone, weights: w };
  };
  E.fv = (cur, m, n, rate) => { const r = rate / 1200; return r ? cur * Math.pow(1 + r, n) + m * (Math.pow(1 + r, n) - 1) / r : cur + m * n; };
  E.need = (target, cur, n, rate) => { if (n <= 0) return Math.max(0, target - cur); const r = rate / 1200, g = Math.pow(1 + r, n), left = target - cur * g; return left <= 0 ? 0 : r ? left * r / (g - 1) : left / n; };
  E.path = (cur, m, n, rate) => { const r = rate / 1200, out = [cur]; let v = cur; for (let i = 0; i < n; i++) { v = v * (1 + r) + m; out.push(v); } return out; };
  E.addMonths = (ym, n) => { const [y, m] = ym.split('-').map(Number), d = y * 12 + (m - 1) + n; return Math.floor(d / 12) + '-' + String(d % 12 + 1).padStart(2, '0'); };
  E.monthsBetween = (a, b) => { const [y1, m1] = a.split('-').map(Number), [y2, m2] = b.split('-').map(Number); return (y2 - y1) * 12 + (m2 - m1); };
  E.matchSpecial = (s, ym) => {
    if (!s || !s.ym || !ym) return false;
    const d = E.monthsBetween(s.ym, ym); if (d < 0) return false;
    const f = s.freq || 'once';
    return f === 'yearly' ? d % 12 === 0 : f === 'quarterly' ? d % 3 === 0 : f === 'monthly' ? true : d === 0;
  };
  E.forecast = (p, b, special, start, n = 12, opts = {}) => {
    let bal = p.savings;
    const ledger = opts.ledger || {}, incG = (+opts.incGrowth || 0) / 100, inf = (+opts.inflation || 0) / 100;
    return Array.from({ length: n }, (_, i) => {
      const ym = E.addMonths(start, i + 1), yrIdx = Math.floor(i / 12), sp = (special || []).filter(s => E.matchSpecial(s, ym));
      const add = k => sp.filter(s => (k === 'inc') === (s.kind === 'inc')).reduce((a, s) => a + (+s.amount || 0) * Math.pow(1 + (k === 'inc' ? incG : inf), yrIdx), 0);
      const lg = ledger[ym], hasInc = lg && lg.income !== '' && lg.income != null, hasExp = lg && lg.expenses !== '' && lg.expenses != null;
      const baseInc = hasInc ? (+lg.income || 0) : p.income * Math.pow(1 + incG, yrIdx);
      const baseExp = hasExp ? (+lg.expenses || 0) : b.total * Math.pow(1 + inf, yrIdx);
      const spInc = Math.round(add('inc')), spExp = Math.round(add('exp'));
      const income = Math.round(baseInc + spInc), expenses = Math.round(baseExp + spExp);
      bal += income - expenses;
      return { ym, income, expenses, spInc, spExp, net: income - expenses, balance: bal };
    });
  };
  E.sinkingFund = (special, start, n = 12) => {
    let cumExp = 0, peakMonthly = 0;
    for (let i = 1; i <= n; i++) {
      const ym = E.addMonths(start, i), sp = (special || []).filter(s => s.kind !== 'inc' && E.matchSpecial(s, ym));
      cumExp += sp.reduce((a, s) => a + (+s.amount || 0), 0);
      peakMonthly = Math.max(peakMonthly, cumExp / i);
    }
    return { totalExp: Math.round(cumExp), avgMonthly: Math.ceil(cumExp / Math.max(1, n)), peakMonthly: Math.ceil(peakMonthly) };
  };
  E.actionPlan = (p, goals = []) => {
    const plan = [], monthly = p.income - p.expenses, debt = E.debtTotal(p.debts), starter = Math.min(1000, p.expenses || 1000), reserve = p.expenses * 3;
    if (p.income <= 0 || p.expenses <= 0) plan.push({ id: 'numbers', amount: null });
    if (monthly < 0) plan.push({ id: 'deficit', amount: -monthly });
    if (p.savings < starter) plan.push({ id: 'starter', amount: Math.max(0, starter - p.savings) });
    const costly = p.debts.filter(d => +d.balance > 0).sort((a,b) => (+b.rate || 0) - (+a.rate || 0));
    if (costly.length) plan.push({ id: 'debt', amount: debt, rate: +costly[0].rate || 0 });
    if (p.savings < reserve) plan.push({ id: 'reserve', amount: Math.max(0, reserve - p.savings) });
    const behind = goals.filter(g => g.status !== 'on');
    if (behind.length) plan.push({ id: 'goals', amount: behind[0].need, name: behind[0].name });
    if (monthly > 0 && !costly.length && p.savings >= reserve && p.invested <= 0) plan.push({ id: 'invest', amount: monthly });
    if (!plan.length) plan.push({ id: 'maintain', amount: monthly });
    return plan.map((step, i) => ({ ...step, status: i === 0 ? 'now' : 'next' }));
  };
  E.yearlyRollup = rows => {
    const byYr = {};
    for (const r of rows) {
      const y = r.ym.slice(0, 4);
      if (!byYr[y]) byYr[y] = { year: y, months: 0, income: 0, expenses: 0, spExp: 0, net: 0, endBalance: r.balance, lowBalance: r.balance, deficits: 0 };
      const g = byYr[y]; g.months++; g.income += r.income; g.expenses += r.expenses; g.spExp += (r.spExp || 0); g.net += r.net;
      g.endBalance = r.balance; if (r.balance < g.lowBalance) g.lowBalance = r.balance; if (r.net < 0) g.deficits++;
    }
    return Object.values(byYr);
  };
  // 7 steps; each unlocks only when all previous ones are done.
  E.levels = p => {
    const starter = Math.min(1000, p.expenses || 1000), full = p.expenses * 3;
    const done = [p.income > 0 && p.expenses > 0, p.savings >= starter, E.debtTotal(p.debts) <= 0,
      p.savings >= full, !!p.goalsOk, p.invested > 0, false];
    let ok = true; return done.map(x => (ok = ok && x));
  };
  if (typeof module !== 'undefined') module.exports = E; else root.Engine = E;
})(this);
