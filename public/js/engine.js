// Pure finance logic (no DOM). The bot never does math: this engine does.
(function (root) {
  const E = {};
  E.debtTotal = d => d.reduce((s, x) => s + (+x.balance || 0), 0);
  E.months = (cur, target, monthly) => cur >= target ? 0 : monthly <= 0 ? Infinity : Math.ceil((target - cur) / monthly);
  // mode: 'snowball' (smallest balance first) | 'avalanche' (highest rate first)
  E.payoff = (debts, extra, mode) => {
    let ds = debts.filter(d => +d.balance > 0).map(d => ({ balance: +d.balance, rate: +d.rate || 0, min: +d.min || 0 }));
    if (!ds.length) return { months: 0, interest: 0, ok: true };
    const budget = ds.reduce((s, d) => s + d.min, 0) + (+extra || 0);
    if (budget <= 0) return { months: Infinity, interest: Infinity, ok: false };
    let m = 0, interest = 0;
    while (ds.length && m < 600) {
      m++;
      ds.sort(mode === 'avalanche' ? (a, b) => b.rate - a.rate : (a, b) => a.balance - b.balance);
      let pool = budget;
      for (const d of ds) { const i = d.balance * d.rate / 1200; d.balance += i; interest += i; }
      for (const d of ds) { const p = Math.min(d.min, d.balance, pool); d.balance -= p; pool -= p; }
      for (const d of ds) { if (pool <= 0) break; const p = Math.min(pool, d.balance); d.balance -= p; pool -= p; }
      ds = ds.filter(d => d.balance > 0.005);
    }
    return { months: m, interest, ok: !ds.length };
  };
  E.compound = (start, monthly, ratePct, years) => {
    const r = ratePct / 1200, out = []; let v = start, c = start;
    for (let y = 0; y <= years; y++) { out.push({ y, v, c }); for (let k = 0; k < 12; k++) { v = v * (1 + r) + monthly; c += monthly; } }
    return out;
  };
  // 7 levels; each unlocks only when all previous ones are done.
  E.levels = p => {
    const starter = Math.min(1000, p.expenses || 1000), full = p.expenses * 3;
    const done = [p.income > 0 && p.expenses > 0, p.savings >= starter, E.debtTotal(p.debts) <= 0,
      p.savings >= full, p.savings >= full + p.goal, p.invested > 0, false];
    let ok = true; return done.map(x => (ok = ok && x));
  };
  if (typeof module !== 'undefined') module.exports = E; else root.Engine = E;
})(this);
