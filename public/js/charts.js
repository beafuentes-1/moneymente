// Futuristic AI Telemetry Canvas Charts (no libraries). Adapts to Dark Mode, Light Mode, and Printable Report (Charts.light = true).
const Charts = {
  light: false,
  k() {
    const isDark = !this.light && document.documentElement.dataset.theme === 'dark';
    if (isDark) {
      return { isDark: true, bg: '#101920', grid: 'rgba(132,204,22,0.16)', mu: '#94ab9a', trk: 'rgba(255,255,255,0.08)', w: '#f1f8ed', c1: '#84cc16', c2: '#06b6d4', c3: '#22c55e', c4: '#ff5555' };
    }
    return { isDark: false, bg: '#ffffff', grid: 'rgba(77,124,15,0.16)', mu: '#3f5243', trk: 'rgba(17,28,21,0.08)', w: '#0f1a12', c1: '#4d7c0f', c2: '#0284c7', c3: '#15803d', c4: '#dc2626' };
  },
  col(c) {
    const k = this.k();
    if (c === '#ffffff') return k.c1;
    if (c === '#4aa3ff') return k.c2;
    if (c === '#da291c') return k.c4;
    if (c === '#9db0d3') return k.mu;
    return c;
  },
  rrect(c, x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, Math.max(0, w), Math.max(0, h), rad);
    else c.rect(x, y, Math.max(0, w), Math.max(0, h));
  },
  line(cv, series, fmt) {
    const k = this.k(), c = cv.getContext('2d'), W = cv.width, H = cv.height, P = 66;
    const n = Math.max(...series.map(s => s.d.length), 1), max = Math.max(...series.flatMap(s => s.d), 1);
    c.clearRect(0, 0, W, H); c.font = '13px ui-monospace,monospace'; c.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = 14 + (H - 48) * i / 4;
      c.strokeStyle = k.grid; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(P, y); c.lineTo(W - 10, y); c.stroke(); c.setLineDash([]);
      c.fillStyle = k.mu; c.fillText(fmt(max * (1 - i / 4)), 4, y + 4);
    }
    const stepNode = Math.max(1, Math.floor(n / 10));
    series.forEach((s, j) => {
      const col = this.col(s.color);
      const pts = s.d.map((v, i) => [P + i * (W - P - 12) / Math.max(n - 1, 1), 14 + (H - 48) * (1 - v / max)]);
      if (!s.dash && pts.length > 1) {
        const g = c.createLinearGradient(0, 14, 0, H - 34);
        g.addColorStop(0, col + (k.isDark ? '44' : '26'));
        g.addColorStop(1, col + '00');
        c.beginPath(); c.moveTo(pts[0][0], H - 34);
        pts.forEach(([x, y]) => c.lineTo(x, y));
        c.lineTo(pts[pts.length - 1][0], H - 34); c.closePath();
        c.fillStyle = g; c.fill();
      }
      c.save();
      if (k.isDark && !s.dash) { c.shadowColor = col; c.shadowBlur = 10; }
      c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
      c.strokeStyle = col; c.lineWidth = s.dash ? 2.2 : 3.2; c.setLineDash(s.dash || []); c.stroke(); c.setLineDash([]);
      if (!s.dash) {
        pts.forEach(([x, y], i) => {
          if (i === 0 || i === pts.length - 1 || i % stepNode === 0) {
            c.fillStyle = k.bg; c.beginPath(); c.arc(x, y, 3.8, 0, Math.PI * 2); c.fill();
            c.strokeStyle = col; c.lineWidth = 2.2; c.stroke();
          }
        });
      }
      c.restore();
      c.fillStyle = col; c.fillText('◆ ' + s.name, P + j * 195, H - 8);
    });
  },
  donut(cv, parts, fmt) {
    const k = this.k(), c = cv.getContext('2d'), W = cv.width, H = cv.height, tot = parts.reduce((a, p) => a + p.v, 0) || 1;
    const cx = W / 2 - 155, cy = H / 2, R = 92, y0 = H / 2 - parts.length * 13 + 5;
    let a0 = -Math.PI / 2;
    c.clearRect(0, 0, W, H);
    // Outer & inner HUD radar rings
    c.strokeStyle = k.grid; c.lineWidth = 1.5; c.setLineDash([4, 4]);
    c.beginPath(); c.arc(cx, cy, R + 24, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(cx, cy, R - 26, 0, Math.PI * 2); c.stroke();
    c.setLineDash([]);
    const gap = parts.length > 1 ? 0.035 : 0;
    parts.forEach((p, i) => {
      const span = (p.v / tot) * Math.PI * 2, a1 = a0 + span, col = this.col(p.color);
      c.save();
      if (k.isDark) { c.shadowColor = col; c.shadowBlur = 12; }
      c.beginPath(); c.arc(cx, cy, R, a0 + gap / 2, Math.max(a0 + gap / 2 + 0.01, a1 - gap / 2));
      c.strokeStyle = col; c.lineWidth = 28; c.lineCap = 'round'; c.stroke();
      c.restore();
      a0 = a1;
      const ly = y0 + i * 26;
      this.rrect(c, W / 2 - 12, ly - 12, 12, 12, 3); c.fillStyle = col; c.fill();
      c.font = '15px ui-monospace,monospace'; c.fillStyle = k.w;
      c.fillText(p.name + ': ' + fmt(p.v) + ' (' + Math.round(p.v / tot * 100) + '%)', W / 2 + 8, ly - 1);
    });
    c.save();
    c.textAlign = 'center'; c.fillStyle = k.w; c.font = 'bold 22px ui-monospace,monospace';
    c.fillText(fmt(tot), cx, cy + 4);
    c.fillStyle = k.c1; c.font = 'bold 10px ui-monospace,monospace';
    c.fillText('AI BUDGET CORE', cx, cy + 22);
    c.restore();
  },
  bars(cv, rows) {
    const k = this.k(), c = cv.getContext('2d'), W = cv.width, L = 155, w = W - L - 24;
    c.clearRect(0, 0, W, cv.height); c.font = '14px ui-monospace,monospace';
    rows.forEach((r, i) => {
      const y = 20 + i * 58, col = this.col(r.color), fillW = Math.min(100, Math.max(0, r.v)) / 100 * w;
      this.rrect(c, L, y, w, 20, 10); c.fillStyle = k.trk; c.fill();
      if (fillW > 0) {
        const g = c.createLinearGradient(L, 0, L + fillW, 0);
        g.addColorStop(0, col); g.addColorStop(1, k.c1);
        c.save();
        if (k.isDark) { c.shadowColor = col; c.shadowBlur = 10; }
        this.rrect(c, L, y, Math.max(10, fillW), 20, 10); c.fillStyle = g; c.fill();
        c.restore();
      }
      const tx = L + Math.min(100, r.target) / 100 * w;
      c.fillStyle = k.w; c.fillRect(tx - 1.5, y - 5, 3, 30);
      c.fillStyle = k.w; c.fillText(r.name, 4, y + 15);
      c.fillStyle = k.mu; c.fillText(Math.round(r.v) + '%  /  target ' + r.target + '%', L, y + 42);
    });
  },
  year(cv, rows, fmt, names) {
    const k = this.k(), c = cv.getContext('2d'), W = cv.width, H = cv.height, P = 66, n = rows.length || 1, hasB = rows.some(r => r.balance != null);
    const vals = rows.flatMap(r => [r.income, r.expenses, ...(hasB ? [r.balance] : [])]), max = Math.max(...vals, 1), min = Math.min(0, ...vals), span = (max - min) || 1;
    const Y = v => 14 + (H - 58) * (1 - (v - min) / span), bw = (W - P - 10) / n, step = Math.max(1, Math.ceil(n / 12));
    c.clearRect(0, 0, W, H); c.font = '12px ui-monospace,monospace'; c.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const v = max - span * i / 4, y = Y(v);
      c.strokeStyle = k.grid; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(P, y); c.lineTo(W - 8, y); c.stroke(); c.setLineDash([]);
      c.fillStyle = k.mu; c.fillText(fmt(v), 4, y + 4);
    }
    const y0 = Y(0);
    rows.forEach((r, i) => {
      const x = P + i * bw;
      [[r.income, k.c1], [r.expenses, k.c4]].forEach(([v, col], j) => {
        const top = Y(Math.max(v, 0)), bh = Math.max(2, y0 - top), bx = x + bw * .12 + j * bw * .38, barW = Math.max(3, bw * .34);
        const g = c.createLinearGradient(0, top, 0, y0);
        g.addColorStop(0, col); g.addColorStop(1, col + (k.isDark ? '44' : '88'));
        this.rrect(c, bx, top, barW, bh, 4); c.fillStyle = g; c.fill();
      });
      if (i % step === 0) { c.fillStyle = k.mu; c.fillText(r.label, x + 2, H - 24); }
    });
    if (hasB) {
      const pts = rows.map((r, i) => [P + i * bw + bw / 2, Y(r.balance)]);
      c.save();
      if (k.isDark) { c.shadowColor = k.c2; c.shadowBlur = 10; }
      c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
      c.strokeStyle = k.c2; c.lineWidth = 3.2; c.stroke();
      pts.forEach(([x, y], i) => {
        if (i === 0 || i === pts.length - 1 || i % step === 0) {
          c.fillStyle = k.bg; c.beginPath(); c.arc(x, y, 3.6, 0, Math.PI * 2); c.fill();
          c.strokeStyle = k.c2; c.lineWidth = 2; c.stroke();
        }
      });
      c.restore();
    }
    [[names[0], k.c1], [names[1], k.c4], ...(hasB ? [[names[2], k.c2]] : [])].forEach(([nm, col], i) => {
      c.fillStyle = col; c.fillText('◆ ' + nm, P + i * 165, H - 7);
    });
  }
};
