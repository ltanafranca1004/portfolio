// A static server for measuring builds, started in-process by the measurement scripts.
// It behaves like the Cloudflare Pages preview where it matters for loading:
//   - /_astro/* is cached for a year, HTML is revalidated on every visit (ETag, 304);
//   - text is sent compressed, as the real host does;
//   - every response waits `latency` ms and is sent at `kbps` (0 = no limit), so a local build
//     loads at the pace of a real connection in every browser, including ones that cannot
//     throttle themselves (Safari).
// With `probe`, scripts/measure/probe.js is inlined at the top of every page's <head>.
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json',
};
const PROBE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'probe.js');
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/**
 * @param {{ root: string, port: number, latency?: number, kbps?: number, probe?: false | 'full' | 'light' }} options
 * @returns {Promise<{ url: string, requests: { path: string, at: number, purpose: string }[], close: () => Promise<void> }>}
 */
export async function serve({ root, port, latency = 0, kbps = 0, probe = false }) {
  const requests = [];
  const inject = probe ? `<script>window.__probeMode=${JSON.stringify(probe)};${readFileSync(PROBE, 'utf8')}</script>` : '';
  const server = http.createServer(async (req, res) => {
    let pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = path.join(root, pathname);
    requests.push({ path: pathname, at: Date.now(), purpose: String(req.headers['sec-purpose'] ?? req.headers.purpose ?? '') });
    let body;
    try {
      if (!file.startsWith(root) || !statSync(file).isFile()) throw new Error('not a file');
      body = readFileSync(file);
    } catch {
      await sleep(latency);
      res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
      return;
    }
    const ext = path.extname(file);
    if (ext === '.html' && inject) body = Buffer.from(body.toString('utf8').replace('<head>', `<head>${inject}`));
    const etag = `"${createHash('sha1').update(body).digest('hex').slice(0, 16)}"`;
    const headers = {
      'content-type': TYPES[ext] ?? 'application/octet-stream',
      'cache-control': pathname.startsWith('/_astro/') ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate',
      etag,
    };
    await sleep(latency);
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers).end();
      return;
    }
    if (/^(text|application\/(json|xml))|svg/.test(headers['content-type']) && String(req.headers['accept-encoding']).includes('gzip')) {
      body = gzipSync(body);
      headers['content-encoding'] = 'gzip';
    }
    res.writeHead(200, { ...headers, 'content-length': body.length });
    if (!kbps) {
      res.end(body);
      return;
    }
    // send in slices, 20 a second, at the asked rate
    const slice = Math.max(256, Math.round((kbps * 1000) / 8 / 20));
    for (let at = 0; at < body.length && !res.destroyed; at += slice) {
      res.write(body.subarray(at, at + slice));
      if (at + slice < body.length) await sleep(50);
    }
    res.end();
  });
  await new Promise((done) => server.listen(port, '127.0.0.1', done));
  return {
    url: `http://localhost:${port}`,
    requests,
    close: () =>
      new Promise((done) => {
        server.closeAllConnections?.();
        server.close(() => done());
      }),
  };
}
