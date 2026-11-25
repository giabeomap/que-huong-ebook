/**
 * Self-contained E-book static server with HTTP Range (206 Partial Content) support
 * and attachment headers for downloading the source archive.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8123;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.zip': 'application/zip',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

function serveFile(req, res, filePath, asAttachmentName) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const total = stat.size;
    const range = req.headers.range;

    const extraHeaders = {};
    if (asAttachmentName) {
      extraHeaders['Content-Disposition'] =
        `attachment; filename="file nguon.zip"; filename*=UTF-8''${encodeURIComponent(asAttachmentName)}`;
    }

    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      if (!match) {
        res.writeHead(416, { 'Content-Range': `bytes */${total}` });
        res.end();
        return;
      }
      const start = match[1] ? parseInt(match[1], 10) : 0;
      const end = match[2] ? Math.min(parseInt(match[2], 10), total - 1) : total - 1;

      if (start > end || start >= total) {
        res.writeHead(416, { 'Content-Range': `bytes */${total}` });
        res.end();
        return;
      }

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
        ...extraHeaders,
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, {
      'Content-Length': total,
      'Accept-Ranges': 'bytes',
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      ...extraHeaders,
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);

  if (urlPath === '/download/file-nguon.zip' || urlPath === '/downloads/file-nguon.zip') {
    serveFile(
      req,
      res,
      path.join(ROOT, 'downloads', 'file-nguon.zip'),
      'file nguồn.zip'
    );
    return;
  }

  const relPath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const resolved = path.resolve(ROOT, relPath);

  if (!resolved.startsWith(path.resolve(ROOT))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  serveFile(req, res, resolved, null);
});

server.listen(PORT, () => {
  console.log(`E-book server running at http://localhost:${PORT}/ (root: ${ROOT})`);
});
