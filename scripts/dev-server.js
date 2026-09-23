// Tiny static file server for the frontend/ folder (no dependencies).
// Usage: node scripts/dev-server.js [port]
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'frontend');
const port = process.argv[2] ? parseInt(process.argv[2], 10) : 5500;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

// Old / short URLs -> current location of the customer kiosk.
const REDIRECTS = {
  '/': '/kiosk/',
  '/kiosk': '/kiosk/',
  '/index.html': '/kiosk/',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);

  if (REDIRECTS[urlPath]) {
    res.writeHead(302, { Location: REDIRECTS[urlPath] });
    res.end();
    return;
  }
  if (urlPath.endsWith('/')) urlPath += 'index.html';

  const filePath = path.join(root, urlPath);
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found: ' + urlPath);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(port, () => console.log(`Frontend dev server on http://localhost:${port}`));
