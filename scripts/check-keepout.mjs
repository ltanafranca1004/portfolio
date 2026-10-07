// Checks that no orbit line, node marker or route line comes within 14px of any text,
// on every page, at every tested size, at every scroll position.
//
// It works from pixels, not from the page's own geometry. Each screen is captured with
// everything hidden except the decorative layers, which leaves the lines and nodes alone on
// the plain page background. Inside every text box grown by 14px, every pixel must then be
// background. So it covers lines and nodes alike, whatever draws them. (Comparing a
// screenshot with and without the lines does not work: hiding a layer shifts the
// anti-aliasing of rounded corners nearby by a few levels.)
//   node scripts/check-keepout.mjs
import sharp from 'sharp';
import { BASE, playwright, settle } from './browsers.mjs';

const KEEP_OUT = 14;
const TOLERANCE = 10; // colour levels (of 255) a pixel may differ before it counts
const SIZES = [
  [1280, 720],
  [1366, 768],
  [1440, 790],
  [1920, 960],
  [768, 1024],
  [390, 844],
];
const PAGES = ['/', '/profile/', '/projects/unify/', '/projects/cubic/', '/projects/lens/', '/projects/turtle-trips/', '/projects/amenity-recommender/', '/projects/pipeline-simulator/', '/projects/nutrifit/'];
const ONLY_LINES = 'body, body * { visibility: hidden !important; } svg[data-keepout], svg[data-keepout] *, .routewrap, .routewrap * { visibility: visible !important; }';
const BACKGROUND = [5, 8, 21]; // --sky, the page background

// KEEPOUT_ONLY=1280x720:/projects/unify/ narrows a run to one size and page (either part may be left out)
if (process.env.KEEPOUT_ONLY) {
  const [size, url] = process.env.KEEPOUT_ONLY.split(':');
  if (size) SIZES.splice(0, SIZES.length, ...SIZES.filter(([w, h]) => `${w}x${h}` === size));
  if (url) PAGES.splice(0, PAGES.length, ...PAGES.filter((p) => p === url));
}

// --selftest: switch the keep-out mask off on the map and make sure the check then fails
const SELFTEST = process.argv.includes('--selftest');
if (SELFTEST) {
  SIZES.splice(1);
  PAGES.splice(1);
}

const raw = async (png) => sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });

const browser = await playwright.chromium.launch();
const rows = [];
const problems = [];
for (const [width, height] of SIZES) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  for (const url of PAGES) {
    await page.goto(BASE + url);
    await settle(page, 900);
    if (SELFTEST) await page.evaluate(() => document.querySelectorAll('.orbit-lines').forEach((g) => g.removeAttribute('mask')));
    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    let boxesChecked = 0;
    let bad = 0;
    for (let y = 0; y < pageHeight; y += height - 80) {
      await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
      await page.waitForTimeout(120);
      const boxes = await page.evaluate(() => {
        const out = [];
        const range = document.createRange();
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode;
          const el = node.parentElement;
          if (!el || !node.data.trim() || el.closest('svg[data-keepout], script, style, noscript, dialog, .sr-only')) continue;
          range.selectNodeContents(node);
          for (const r of range.getClientRects()) {
            if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
            out.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, text: node.data.trim().slice(0, 28) });
          }
        }
        return out;
      });
      const tag = await page.addStyleTag({ content: ONLY_LINES });
      const lines = await raw(await page.screenshot());
      await tag.evaluate((node) => node.remove());
      const { width: W, height: H, channels: C } = lines.info;
      for (const box of boxes) {
        boxesChecked++;
        const x0 = Math.max(0, Math.floor(box.left - KEEP_OUT));
        const x1 = Math.min(W - 1, Math.ceil(box.right + KEEP_OUT));
        const y0 = Math.max(0, Math.floor(box.top - KEEP_OUT));
        const y1 = Math.min(H - 1, Math.ceil(box.bottom + KEEP_OUT));
        let differing = 0;
        let first = '';
        for (let py = y0; py <= y1; py++) {
          for (let px = x0; px <= x1; px++) {
            const i = (py * W + px) * C;
            if (Math.abs(lines.data[i] - BACKGROUND[0]) > TOLERANCE || Math.abs(lines.data[i + 1] - BACKGROUND[1]) > TOLERANCE || Math.abs(lines.data[i + 2] - BACKGROUND[2]) > TOLERANCE) {
              differing++;
              first ||= `first at ${px},${py}, text box ${Math.round(box.left)},${Math.round(box.top)} to ${Math.round(box.right)},${Math.round(box.bottom)}`;
            }
          }
        }
        if (differing > 0) {
          bad++;
          if (problems.length < 40) problems.push(`${width}x${height} ${url} scroll ${y}: "${box.text}" has ${differing} px of line or node within ${KEEP_OUT}px (${first})`);
        }
      }
    }
    rows.push({ size: `${width}x${height}`, page: url, 'text lines checked': boxesChecked, 'too close': bad });
  }
  await context.close();
}
await browser.close();
console.table(rows);
for (const p of problems) console.log(`FAIL ${p}`);
const total = rows.reduce((n, r) => n + r['too close'], 0);
console.log(total === 0 ? `ok   every text line on ${rows.length} page/size combinations is clear of lines and nodes by ${KEEP_OUT}px` : `FAIL ${total} text lines have a line or node within ${KEEP_OUT}px`);
if (SELFTEST) {
  console.log(total > 0 ? 'ok   selftest: with the mask off, the check does catch lines over text' : 'FAIL selftest: the check missed lines over text');
  process.exitCode = total > 0 ? 0 : 1;
} else if (total) process.exitCode = 1;
