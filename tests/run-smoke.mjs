// run-smoke.mjs — CI runner for the in-page smoke tests (smoketest.js).
//
// Serves the repo over HTTP (Node built-in — no external static server),
// launches headless Chromium via Playwright (software WebGL / SwiftShader),
// loads /?test=1 so the harness auto-runs, waits for window.__SMOKE_DONE, then
// reads window.__SMOKE_RESULT and exits non-zero if any combo/scenario failed.
//
// Usage: npm run smoke   (after: npm install && npx playwright install chromium)

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8123;
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon',
  '.stl': 'application/octet-stream', '.obj': 'text/plain', '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary',
};

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const file = path.join(root, p);
    if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end('404'); return; }
    const buf = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
await new Promise(r => server.listen(PORT, r));

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });

let result = null, fatal = null;
try {
  await page.goto(`http://localhost:${PORT}/?test=1`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction('window.__SMOKE_DONE === true', { timeout: 90000 });
  result = await page.evaluate('window.__SMOKE_RESULT');
} catch (e) {
  fatal = String(e);
}
await browser.close();
await new Promise(r => server.close(r));

if (errors.length) console.error('--- page/console errors ---\n' + errors.join('\n'));

if (fatal) { console.error('RUNNER ERROR (boot/harness never completed):', fatal); process.exit(1); }
if (!result) { console.error('No __SMOKE_RESULT published.'); process.exit(1); }

console.log(`SMOKE: ${result.passed}/${result.total} passed, ${result.failed} failed`);
result.results.filter(r => !r.ok).forEach(r => console.error(`  FAIL: ${r.tag} — ${r.detail}`));

if (result.total === 0 || result.failed > 0) { console.error('SMOKE TESTS FAILED'); process.exit(1); }
console.log('SMOKE TESTS PASSED');
process.exit(0);
