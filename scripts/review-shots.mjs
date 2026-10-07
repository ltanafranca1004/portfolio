// Review screenshots at 2x (a Retina screen), with motion settled so two runs can be compared.
//   node scripts/review-shots.mjs <label>     e.g. "before" or "after"
// Output: redesign/screenshots/<label>-map.png, -profile.png, -lens.png, -loupe.png
import path from 'node:path';
import { BASE, playwright, settle } from './browsers.mjs';

const label = process.argv[2] ?? 'after';
const out = (name) => path.join('redesign', 'screenshots', `${label}-${name}.png`);

const browser = await playwright.chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 790 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
const page = await context.newPage();

await page.goto(`${BASE}/`);
await settle(page, 1200);
await page.screenshot({ path: out('map') });

await page.goto(`${BASE}/profile/`);
await settle(page, 1200);
await page.screenshot({ path: out('profile'), fullPage: true });

await page.goto(`${BASE}/projects/lens/`);
await settle(page, 1200);
await page.screenshot({ path: out('lens') });
// the loupe and the card around it, close up
const box = await page.locator('.loupe').boundingBox();
if (box) await page.screenshot({ path: out('loupe'), clip: { x: box.x - 70, y: box.y - 40, width: box.width + 140, height: box.height + 80 } });

await browser.close();
console.log(`wrote ${label}-map, ${label}-profile, ${label}-lens, ${label}-loupe`);
