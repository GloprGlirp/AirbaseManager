// Kleiner Static-Server ohne Abhängigkeiten, damit das Spiel auch als Render Web Service läuft.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8' };
const port = process.env.PORT || 3000;

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(root, rel));
  const parts = path.relative(root, file).split(path.sep);
  if (!file.startsWith(root + path.sep) || parts.some(p => p.startsWith('.') || p === 'node_modules')) {
    res.writeHead(403).end('Forbidden'); return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Nicht gefunden');
  }
}).listen(port, () => console.log(`Kestrel Field Ops läuft auf Port ${port}`));
