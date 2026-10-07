// Side-by-side screenshots of the two ways of keeping orbit lines out of text:
//   A (live): a soft dark glow behind each text block
//   B (?lines=fade): no glow; the lines fade out where they pass behind text
//   node scripts/glow-compare.mjs
import path from 'node:path';
import sharp from 'sharp';
import { BASE, playwright, settle } from './browsers.mjs';

const OUT = path.join('redesign', 'screenshots');
const W = 1440;
const H = 790;
const browser = await playwright.chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });

const label = (text) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="44"><rect width="100%" height="100%" fill="#111"/><text x="20" y="29" font-family="Helvetica, Arial, sans-serif" font-size="20" fill="#fff">${text}</text></svg>`);

for (const [name, url, current] of [
  ['map', '/', 'A: dark glow behind text (live now)'],
  ['unify', '/projects/unify/', 'A: live now (this page has no glow; faint lines pass behind the text)'],
]) {
  const shots = [];
  for (const query of ['', '?lines=fade']) {
    await page.goto(BASE + url + query);
    await settle(page, 2800);
    shots.push(await page.screenshot());
  }
  await sharp({ create: { width: W * 2 + 12, height: H + 44, channels: 3, background: '#111' } })
    .composite([
      { input: label(current), left: 0, top: 0 },
      { input: label('B: no glow, orbit lines fade out behind text (?lines=fade)'), left: W + 12, top: 0 },
      { input: shots[0], left: 0, top: 44 },
      { input: shots[1], left: W + 12, top: 44 },
    ])
    .png()
    .toFile(path.join(OUT, `glow-compare-${name}.png`));
  console.log(`wrote glow-compare-${name}.png`);
}
await browser.close();
