// 极简静态文件服务器（0 依赖）：根目录 = 当前工作目录，监听 127.0.0.1:8765
// 用于 tasks/step4-browser-regression.mjs 的本地浏览器回归。
// 用法：node tasks/dev-server.mjs
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const PORT = 8765;
const HOST = '127.0.0.1';
const ROOT = process.cwd();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.txt':  'text/plain; charset=utf-8',
  '.md':   'text/markdown; charset=utf-8',
  '.map':  'application/json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
};

function safeJoin(root, urlPath) {
  // 去掉 query / hash
  const clean = urlPath.split('?')[0].split('#')[0];
  const decoded = decodeURIComponent(clean);
  const resolved = path.normalize(path.join(root, decoded));
  if (!resolved.startsWith(root)) return null; // 防穿越
  return resolved;
}

const server = http.createServer(async (req, res) => {
  try {
    let target = safeJoin(ROOT, req.url || '/');
    if (!target) { res.writeHead(403); return res.end('forbidden'); }

    let stat;
    try { stat = await fs.stat(target); } catch { res.writeHead(404); return res.end('not found: ' + req.url); }
    if (stat.isDirectory()) target = path.join(target, 'index.html');
    try { stat = await fs.stat(target); } catch { res.writeHead(404); return res.end('not found: ' + req.url); }

    const data = await fs.readFile(target);
    const ext = path.extname(target).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  } catch (e) {
    res.writeHead(500); res.end('error: ' + e.message);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`dev-server: http://${HOST}:${PORT}/  (root=${ROOT})`);
});
