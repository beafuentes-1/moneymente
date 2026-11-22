// Tiny canvas charts (no libraries). Charts.light = true draws on white paper for the printable report.
const Charts = {
  light: false,
  k() { if (this.light) return { grid: '#e5e7eb', mu: '#424b57', trk: '#e5e7eb', w: '#101c2c', gold: '#8a672b', success: '#24734d', text: '#101c2c' };
    const css = getComputedStyle(document.documentElement); return { grid: css.getPropertyValue('--border-color').trim(), mu: css.getPropertyValue('--text-secondary').trim(), trk: css.getPropertyValue('--border-color').trim(), w: css.getPropertyValue('--text-primary').trim(), gold: css.getPropertyValue('--accent-gold').trim(), success: css.getPropertyValue('--success').trim(), text: css.getPropertyValue('--text-primary').trim() }; },
  col(c) { if (c.startsWith('var(')) return getComputedStyle(document.documentElement).getPropertyValue(c.slice(4, -1)).trim(); return c === '#ffffff' ? this.k().w : c === '#da291c' ? this.k().gold : c === '#4aa3ff' ? this.k().success : c; },
  line(cv, series, fmt) {
    const k = this.k(), c = cv.getContext('2d'), W = cv.width, H = cv.height, P = 62, n = Math.max(...series.map(s => s.d.length)), max = Math.max(...series.flatMap(s => s.d), 1);
    c.clearRect(0, 0, W, H); c.font = '14px ui-monospace,monospace'; c.lineWidth = 1;
    for (let i = 0; i <= 4; i++) { const y = 12 + (H - 44) * i / 4; c.strokeStyle = k.grid; c.beginPath(); c.moveTo(P, y); c.lineTo(W - 8, y); c.stroke(); c.fillStyle = k.mu; c.fillText(fmt(max * (1 - i / 4)), 2, y + 4); }
    series.forEach((s, j) => {
      c.beginPath(); s.d.forEach((v, i) => { const x = P + i * (W - P - 8) / Math.max(n - 1, 1), y = 12 + (H - 44) * (1 - v / max); i ? c.lineTo(x, y) : c.moveTo(x, y); });
      c.strokeStyle = this.col(s.color); c.lineWidth = 3; c.setLineDash(s.dash || []); c.stroke(); c.setLineDash([]);
      c.fillStyle = this.col(s.color); c.fillText('■ ' + s.name, P + j * 190, H - 6);
    });
  },
  donut(cv, parts, fmt) {
    const k = this.k(), c = cv.getContext('2d'), W = cv.width, H = cv.height, tot = parts.reduce((a, p) => a + p.v, 0) || 1, y0 = H / 2 - parts.length * 13 + 5; let a0 = -Math.PI / 2;
    c.clearRect(0, 0, W, H); c.lineWidth = 38;
    parts.forEach((p, i) => { const a1 = a0 + p.v / tot * Math.PI * 2; c.beginPath(); c.arc(W / 2 - 150, H / 2, 90, a0, a1); c.strokeStyle = this.col(p.color); c.stroke(); a0 = a1;
      c.font = '16px ui-monospace,monospace'; c.fillStyle = this.col(p.color); c.fillText('■ ' + p.name + ': ' + fmt(p.v) + ' (' + Math.round(p.v / tot * 100) + '%)', W / 2 - 10, y0 + i * 26); });
  },
  bars(cv, rows) {
    const k = this.k(), c = cv.getContext('2d'), W = cv.width, L = 150, w = W - L - 20; c.clearRect(0, 0, W, cv.height); c.font = '15px ui-monospace,monospace';
    rows.forEach((r, i) => { const y = 22 + i * 58; c.fillStyle = k.trk; c.fillRect(L, y, w, 22); c.fillStyle = this.col(r.color); c.fillRect(L, y, Math.min(100, r.v) / 100 * w, 22);
      c.fillStyle = k.w; c.fillRect(L + Math.min(100, r.target) / 100 * w - 2, y - 6, 4, 34); c.fillStyle = k.mu; c.fillText(r.name, 0, y + 16); c.fillText(Math.round(r.v) + '%  /  ' + r.target + '%', L, y + 46); });
  },
  year(cv, rows, fmt, names) {
    const k = this.k(), c = cv.getContext('2d'), W = cv.width, H = cv.height, P = 62, n = rows.length, hasB = rows.some(r => r.balance != null);
    const vals = rows.flatMap(r => [r.income, r.expenses, ...(hasB ? [r.balance] : [])]), max = Math.max(...vals, 1), min = Math.min(0, ...vals), span = max - min, Y = v => 12 + (H - 56) * (1 - (v - min) / span), bw = (W - P - 6) / n;
    c.clearRect(0, 0, W, H); c.font = '13px ui-monospace,monospace'; c.lineWidth = 1;
    for (let i = 0; i <= 4; i++) { const v = max - span * i / 4, y = Y(v); c.strokeStyle = k.grid; c.beginPath(); c.moveTo(P, y); c.lineTo(W - 6, y); c.stroke(); c.fillStyle = k.mu; c.fillText(fmt(v), 2, y + 4); }
    rows.forEach((r, i) => { const x = P + i * bw; [[r.income, k.success], [r.expenses, k.gold]].forEach(([v, col], j) => { c.fillStyle = col; const y = Y(Math.max(v, 0)); c.fillRect(x + bw * .12 + j * bw * .38, y, bw * .34, Y(0) - y); }); c.fillStyle = k.mu; c.fillText(r.label, x + 2, H - 24); });
    if (hasB) { c.beginPath(); rows.forEach((r, i) => { const x = P + i * bw + bw / 2, y = Y(r.balance); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.strokeStyle = k.gold; c.lineWidth = 3; c.stroke(); }
    [[names[0], k.success], [names[1], k.gold], ...(hasB ? [[names[2], k.gold]] : [])].forEach(([nm, col], i) => { c.fillStyle = col; c.fillText('■ ' + nm, P + i * 150, H - 6); });
  }
};
