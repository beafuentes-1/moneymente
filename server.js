// Zero-dependency static server. The /api/chat route (Nemotron via llama.cpp) is added in the next step.
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, 'public');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json' };
http.createServer((q, r) => {
  let p = path.normalize(decodeURIComponent(q.url.split('?')[0]));
  if (p === '/' || p === '\\') p = '/index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root)) { r.writeHead(403); return r.end(); }
  fs.readFile(f, (e, d) => {
    if (e) { r.writeHead(404); return r.end('Not found'); }
    r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
    r.end(d);
  });
}).listen(3000, () => console.log('Money Roadmap: http://localhost:3000'));
