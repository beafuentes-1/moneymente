// Optional end-to-end UI regression using the system Chrome and Node's built-in CDP WebSocket.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const http = require('node:http');

const chrome = process.env.CHROME_BIN || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(fs.existsSync);
if (!chrome || typeof WebSocket === 'undefined') {
  console.log('browser tests skipped (Chrome or built-in WebSocket unavailable)');
  process.exit(0);
}
const root = path.join(__dirname, '..');
const port = 42000 + Math.floor(Math.random() * 10000);
const remotePort = Number(process.env.CHROME_REMOTE_DEBUGGING_PORT || 0);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'moneymente-e2e-'));
let app, browser;
const delay = ms => new Promise(r => setTimeout(r, ms));
const getJson = url => new Promise((resolve, reject) => http.get(url, r => { let s = ''; r.setEncoding('utf8'); r.on('data', c => s += c); r.on('end', () => { try { resolve(JSON.parse(s)); } catch (e) { reject(e); } }); }).on('error', reject));

(async () => {
  try {
    app = spawn(process.execPath, [path.join(root, 'server.js')], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
    for (let i = 0; i < 80; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/`)).ok) break; } catch {} await delay(50); }
    if (!remotePort) browser = spawn(chrome, ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--no-sandbox',`--user-data-dir=${profile}`,'--remote-debugging-port=0',`http://127.0.0.1:${port}`], { stdio: 'ignore' });
    let active = remotePort;
    for (let i = 0; i < 100 && !active; i++) { try { active = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').trim().split('\n')[0]; } catch {} if (browser?.exitCode !== null && browser?.exitCode !== undefined) break; await delay(50); }
    if (!active) { console.log('browser tests skipped (Chrome could not launch in this environment)'); return; }
    let target;
    for (let i = 0; i < 60 && !target; i++) { target = (await getJson(`http://127.0.0.1:${active}/json/list`)).find(x => x.type === 'page'); await delay(50); }
    assert.ok(target?.webSocketDebuggerUrl, 'Chrome page target should exist');
    const ws = new WebSocket(target.webSocketDebuggerUrl); await once(ws, 'open');
    let id = 0; const pending = new Map();
    ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
    const cdp = (method, params = {}) => new Promise(resolve => { const n = ++id; pending.set(n, resolve); ws.send(JSON.stringify({ id: n, method, params })); });
    const evaluate = async expression => { const out = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (out.result.exceptionDetails) throw new Error(out.result.exceptionDetails.text); return out.result.result.value; };
    await cdp('Page.enable'); await cdp('Page.navigate', { url: `http://127.0.0.1:${port}` });
    for (let i = 0; i < 80; i++) { try { if (await evaluate('!!(window.T && T.title)')) break; } catch {} await delay(50); }
    assert.match(await evaluate("document.querySelector('#score .score-pending')?.textContent.trim()"), /questions to calculate your score/i);
    const before = await evaluate("localStorage.getItem('moneymente.v1')");
    await evaluate("document.querySelector('#demo').click()"); await delay(120);
    assert.equal(await evaluate("JSON.parse(localStorage.getItem('moneymente.v1')).demoMode"), true);
    assert.equal(await evaluate("document.querySelectorAll('#debts .row4').length"), 2);
    assert.equal(await evaluate("document.querySelectorAll('#goals .goal').length"), 3);
    assert.equal(await evaluate("facts().actionPlan[0].description"), await evaluate("document.querySelector('#next p').textContent"), 'chat facts and dashboard next step should match');
    assert.equal(await evaluate("document.querySelector('#bc1').getAttribute('role')"), 'img');
    assert.match(await evaluate("document.querySelector('#bc1').getAttribute('aria-label')"), /budget|presupuesto/i);
    const income = await evaluate("JSON.parse(localStorage.getItem('moneymente.v1')).income");
    await evaluate("document.querySelector('#currency').value='EUR'; document.querySelector('#currency').dispatchEvent(new Event('change',{bubbles:true}))");
    assert.equal(await evaluate("JSON.parse(localStorage.getItem('moneymente.v1')).income"), income, 'currency display selection must not alter financial values');
    assert.match(await evaluate("document.querySelector('#etot').textContent"), /€/u, 'selected currency should affect formatted amounts');
    await evaluate("document.querySelector('#lang').value='es'; document.querySelector('#lang').dispatchEvent(new Event('change',{bubbles:true}))"); await delay(160);
    assert.equal(await evaluate("document.documentElement.lang"), 'es');
    assert.match(await evaluate("document.querySelector('#demo-notice').textContent"), /ejemplo/i);
    await evaluate("document.querySelector('[data-tab=report]').click()"); await delay(80);
    assert.ok(await evaluate("document.querySelector('#report').textContent.includes('Plan de acción')"));
    await evaluate("document.querySelector('#restore-demo').click()"); await delay(100);
    assert.equal(await evaluate("JSON.parse(localStorage.getItem('moneymente.v1')).demoMode"), false);
    assert.equal(await evaluate("JSON.parse(localStorage.getItem('moneymente.v1')).income"), JSON.parse(before).income);
    await cdp('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
    const overflow = await evaluate('document.documentElement.scrollWidth > document.documentElement.clientWidth');
    assert.equal(overflow, false, 'mobile layout should not overflow horizontally');
    await evaluate("document.querySelector('[data-view=overview]').classList.add('on'); const originalFetch=window.fetch; window.fetch=(...args)=>String(args[0]).includes('/api/chat')?Promise.reject(new Error('offline')):originalFetch(...args); document.querySelector('#chat').hidden=false; ask('hello')");
    let offline = false; for (let i = 0; i < 80; i++) { offline = await evaluate("[...document.querySelectorAll('.m1.bot')].some(x => x.textContent.includes(T.offline))"); if (offline) break; await delay(100); }
    assert.equal(offline, true, 'chat should render its offline fallback when no local model is available');
    ws.close();
    console.log('browser regression tests passed (score gate, demo restore, display currency, Spanish, chart labels, report, mobile layout, chat fallback)');
  } finally {
    browser?.kill(); app?.kill(); fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
