// Cross-browser screenshots (Chromium, WebKit, Firefox) at a desktop and a phone size,
// plus a few checks of the features that differ between engines.
//   node scripts/screenshots.mjs
// Output: redesign/screenshots/browsers/ (git-ignored), with one contact sheet per size.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { BASE, playwright, settle } from './browsers.mjs';

const OUT = path.join('redesign', 'screenshots', 'browsers');
mkdirSync(OUT, { recursive: true });

const BROWSERS = ['chromium', 'webkit', 'firefox'];
const SIZES = [
  { name: 'desktop', width: 1440, height: 790, scale: 1, cell: 480 },
  { name: 'phone', width: 390, height: 844, scale: 2, cell: 260 },
];
const PAGES = [
  ['map', '/'],
  ['unify', '/projects/unify/'],
  ['cubic', '/projects/cubic/'],
  ['profile', '/profile/'],
];

const checks = [];
for (const name of BROWSERS) {
  const browser = await playwright[name].launch();
  for (const size of SIZES) {
    const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: size.scale });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
    page.on('pageerror', (error) => errors.push(String(error)));
    for (const [label, url] of PAGES) {
      await page.goto(BASE + url);
      await settle(page, label === 'map' ? 2800 : 1200);
      await page.screenshot({ path: path.join(OUT, `${name}-${label}-${size.name}.png`) });
      checks.push({
        browser: name,
        size: size.name,
        page: label,
        ...(await page.evaluate(() => {
          const css = (sel, prop) => {
            const el = document.querySelector(sel);
            return el ? getComputedStyle(el).getPropertyValue(prop).trim().slice(0, 40) : '';
          };
          const stage = document.querySelector('.map .stage');
          const hero = document.querySelector('.hero-stage');
          return {
            'x overflow': document.documentElement.scrollWidth - innerWidth,
            'stage scale': stage ? new DOMMatrix(getComputedStyle(stage).transform).a.toFixed(3) : '',
            'hero scale': hero ? new DOMMatrix(getComputedStyle(hero).transform).a.toFixed(3) : '',
            'route mask': css('.routewrap', 'mask-image') || css('.routewrap', '-webkit-mask-image') ? 'yes' : document.querySelector('.routewrap') ? 'NO' : '',
            composite: css('.routewrap', 'mask-composite') || css('.routewrap', '-webkit-mask-composite'),
            'cube live': document.querySelector('.cube') ? String(document.querySelector('.cube').classList.contains('is-live')) : '',
            'offset-path': String(CSS.supports('offset-path', "path('M0 0 L1 1')")),
          };
        })),
        errors: errors.splice(0).join(' | ').slice(0, 120),
      });
    }
    await context.close();
  }
  await browser.close();
}
console.table(checks);

// one sheet per size: a row per page, a column per browser
for (const size of SIZES) {
  const cellH = Math.round((size.cell * size.height) / size.width);
  const gap = 8;
  const tiles = [];
  for (const [row, [label]] of PAGES.entries()) {
    for (const [col, name] of BROWSERS.entries()) {
      const input = await sharp(path.join(OUT, `${name}-${label}-${size.name}.png`)).resize(size.cell, cellH).toBuffer();
      tiles.push({ input, left: gap + col * (size.cell + gap), top: gap + row * (cellH + gap) });
    }
  }
  await sharp({ create: { width: gap + BROWSERS.length * (size.cell + gap), height: gap + PAGES.length * (cellH + gap), channels: 3, background: '#444' } })
    .composite(tiles)
    .png()
    .toFile(path.join(OUT, `sheet-${size.name}.png`));
}
console.log(`columns: ${BROWSERS.join(', ')}; rows: ${PAGES.map((p) => p[0]).join(', ')}`);
