const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

const port = 41231;
const llamaPort = 41232;
const llama = http.createServer((req, res) => {
  req.resume();
  req.on('end', () => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ choices: [{ message: { content: 'Stub answer' } }] })); });
});
const app = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: String(port), LLAMA_URL: `http://127.0.0.1:${llamaPort}/chat` }, stdio: 'ignore' });
const listenLlama = () => new Promise(resolve => llama.listen(llamaPort, '127.0.0.1', resolve));
const request = (method, path, body) => new Promise((resolve, reject) => {
  const req = http.request({ hostname: '127.0.0.1', port, method, path, headers: body === undefined ? {} : { 'Content-Type': 'application/json' } }, res => {
    let data = ''; res.setEncoding('utf8'); res.on('data', c => data += c); res.on('end', () => resolve({ status: res.statusCode, data }));
  });
  req.on('error', reject); if (body !== undefined) req.end(body); else req.end();
});
const waitReady = async () => {
  for (let i = 0; i < 50; i++) { try { await request('GET', '/'); return; } catch { await new Promise(r => setTimeout(r, 50)); } }
  throw new Error('app server did not start');
};

(async () => {
  try {
    await listenLlama(); await waitReady();
    assert.equal((await request('POST', '/api/chat', '{')).status, 400);
    assert.equal((await request('POST', '/api/chat', JSON.stringify({ message: '  ' }))).status, 400);
    assert.equal((await request('POST', '/api/chat', JSON.stringify({ message: 'hello', history: [{ role: 'system', content: 'bad' }] }))).status, 200);
    const answer = await request('POST', '/api/chat', JSON.stringify({ message: 'hello', history: [{ role: 'system', content: 'bad' }] }));
    assert.equal(JSON.parse(answer.data).reply, 'Stub answer');
    assert.equal((await request('GET', '/')).status, 200);
    assert.equal((await request('GET', '/..moneymente-secret')).status, 404);
    let tooLarge;
    try { tooLarge = await request('POST', '/api/chat', JSON.stringify({ message: 'x'.repeat(21000) })); } catch { tooLarge = { status: 413 }; }
    assert.equal(tooLarge.status, 413);
    console.log('server tests passed');
  } finally { app.kill(); llama.close(); }
})().catch(e => { console.error(e); app.kill(); llama.close(); process.exitCode = 1; });
