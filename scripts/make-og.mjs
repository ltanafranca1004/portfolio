// Makes public/og.jpg, the 1200 x 630 share image: the map's sky and orbit lines with the
// name and title from content.json. Run it again if either changes:
//   node scripts/make-og.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { playwright } from './browsers.mjs';

const root = process.cwd();
const file = (p) => pathToFileURL(path.join(root, p)).href;
const { person } = JSON.parse(readFileSync('redesign/content.json', 'utf8'));

const html = `<!doctype html>
<meta charset="utf-8">
<style>
  @font-face { font-family: Jost; font-weight: 100 900; src: url('${file('node_modules/@fontsource-variable/jost/files/jost-latin-wght-normal.woff2')}') format('woff2-variations'); }
  html, body { margin: 0; }
  body { position: relative; width: 1200px; height: 630px; overflow: hidden; background: #050815; font-family: Jost, sans-serif; color: #F3EEE2; }
  .sky, .orbits { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .orbits { opacity: 0.75; }
  .route { position: absolute; inset: 0; }
  .shade { position: absolute; inset: 0; background: radial-gradient(ellipse 560px 250px at 50% 52%, rgba(5,8,21,0.88), rgba(5,8,21,0.55) 60%, rgba(5,8,21,0) 100%); }
  .text { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; padding-top: 14px; }
  .pin { width: 44px; height: 56px; }
  h1 { margin: 0; font-size: 92px; font-weight: 500; letter-spacing: 0.03em; line-height: 1; }
  .rule { width: 520px; height: 1px; background: linear-gradient(90deg, rgba(232,194,122,0), rgba(232,194,122,0.8), rgba(232,194,122,0)); }
  p { margin: 0; font-size: 30px; letter-spacing: 0.34em; color: #E8C27A; text-transform: uppercase; padding-left: 0.34em; }
</style>
<img class="sky" src="${file('redesign/assets/sky-source-2880.jpg')}" alt="">
<img class="orbits" src="${file('redesign/assets/orbits2.svg')}" alt="">
<svg class="route" viewBox="0 0 1200 630" fill="none">
  <path d="M -20 250 C 120 200, 240 150, 360 150 S 520 470, 700 500 S 1000 220, 1220 120" stroke="#E8C27A" stroke-width="7" stroke-opacity="0.16" stroke-linecap="round"/>
  <path d="M -20 250 C 120 200, 240 150, 360 150 S 520 470, 700 500 S 1000 220, 1220 120" stroke="#F3D99A" stroke-width="1.8" stroke-linecap="round"/>
</svg>
<div class="shade"></div>
<div class="text">
  <svg class="pin" viewBox="0 0 30 38" fill="none" stroke="#E8C27A" stroke-width="1.6"><path d="M15 36c-6-9-12-15-12-22a12 12 0 0 1 24 0c0 7-6 13-12 22z"/><circle cx="15" cy="14" r="5"/></svg>
  <h1>${person.name}</h1>
  <div class="rule"></div>
  <p>${person.title}</p>
</div>`;

const tmp = path.join('node_modules', '.cache', 'og');
mkdirSync(tmp, { recursive: true });
writeFileSync(path.join(tmp, 'og.html'), html);

const browser = await playwright.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(file(path.join(tmp, 'og.html')));
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
await page.screenshot({ path: 'public/og.jpg', type: 'jpeg', quality: 88 });
await browser.close();
console.log('wrote public/og.jpg');
