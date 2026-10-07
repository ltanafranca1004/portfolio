// Keyboard, reading-order, alt-text, reduced-motion and contrast checks.
//   node scripts/check-a11y.mjs
import sharp from 'sharp';
import { BASE, playwright, settle } from './browsers.mjs';

const GOLD = 'rgb(232, 194, 122)';
const name = (el) => (el.getAttribute('aria-label') || el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40);
let failed = false;
const report = (ok, text) => {
  if (!ok) failed = true;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${text}`);
};

/** Tab through the page, recording each stop and whether a gold focus ring is drawn. */
let TAB = 'Tab';
async function tabStops(page, count) {
  const stops = [];
  for (let i = 0; i < count; i++) {
    await page.keyboard.press(TAB);
    stops.push(
      await page.evaluate(
        ({ fn, gold }) => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          const label = new Function(`return (${fn})`)()(el);
          // the ring is on the element, or on the world or list item around a stretched link
          const ring = [el, el.closest('.world'), el.closest('.mini')].filter(Boolean).some((n) => {
            const s = getComputedStyle(n);
            return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2;
          });
          const colour = [el, el.closest('.world'), el.closest('.mini')].filter(Boolean).map((n) => getComputedStyle(n)).find((s) => s.outlineStyle !== 'none')?.outlineColor;
          return { label, ring, gold: colour === gold, colour };
        },
        { fn: name.toString(), gold: GOLD },
      ),
    );
  }
  return stops.filter(Boolean);
}

for (const engine of ['chromium', 'webkit', 'firefox']) {
  console.log(`\n== ${engine}: keyboard ==`);
  // Safari leaves links out of the Tab order unless Option is held (a macOS default)
  TAB = engine === 'webkit' ? 'Alt+Tab' : 'Tab';
  const browser = await playwright[engine].launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 790 } });

  await page.goto(`${BASE}/`);
  await settle(page, 2200);
  const map = await tabStops(page, 12);
  const want = ['GitHub (opens in new tab)', 'LinkedIn (opens in new tab)', 'Resume (opens in new tab)', 'Contact', 'About me', 'Unify Social', 'Cubic', 'Lens', 'Turtle Trips AI', 'Amenity Recommender', 'Pipeline Simulator', 'NutriFit'];
  report(JSON.stringify(map.map((s) => s.label)) === JSON.stringify(want), `map tab order: ${map.map((s) => s.label).join(' > ')}`);
  report(map.every((s) => s.ring), `map: every stop draws a focus ring${map.every((s) => s.ring) ? '' : ` (missing: ${map.filter((s) => !s.ring).map((s) => s.label)})`}`);
  report(map.every((s) => s.gold), `map: every ring is gold${map.every((s) => s.gold) ? '' : ` (${[...new Set(map.filter((s) => !s.gold).map((s) => `${s.label}: ${s.colour}`))]})`}`);

  // contact panel: open from the keyboard, stay inside, Esc closes, focus returns
  await page.goto(`${BASE}/`);
  await settle(page, 1200);
  for (let i = 0; i < 4; i++) await page.keyboard.press(TAB);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const open = await page.evaluate(() => document.querySelector('#contact-panel').open);
  const inside = [];
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press(TAB);
    inside.push(await page.evaluate(() => (document.querySelector('#contact-panel').contains(document.activeElement) ? document.activeElement.textContent.trim().replace(/\s+/g, ' ').slice(0, 24) || document.activeElement.getAttribute('aria-label') : 'OUTSIDE')));
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => ({ open: document.querySelector('#contact-panel').open, focus: document.activeElement?.textContent?.trim() }));
  report(open, 'contact panel opens with Enter on the Contact button');
  report(!inside.includes('OUTSIDE'), `focus stays in the panel: ${[...new Set(inside)].join(' > ')}`);
  report(!after.open && after.focus === 'Contact', `Esc closes it and focus returns to "${after.focus}"`);

  // project page and profile: everything reachable, rings drawn
  await page.goto(`${BASE}/projects/unify/`);
  await settle(page, 600);
  const project = await tabStops(page, 11);
  report(project.every((s) => s.ring && s.gold), `project page: ${project.map((s) => s.label).join(' > ')}`);
  await page.goto(`${BASE}/profile/`);
  await settle(page, 600);
  const profile = await tabStops(page, 18);
  report(profile.every((s) => s.ring && s.gold), `profile: ${profile.map((s) => s.label).join(' > ')}`);
  await browser.close();
}

// ---- reading order, alt text, reduced motion (Chromium) ----
const browser = await playwright.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 790 } });
await page.goto(`${BASE}/`);
await settle(page, 2200);
console.log('\n== map, as a screen reader gets it ==');
console.log(await page.locator('main').ariaSnapshot());

console.log('\n== images ==');
for (const url of ['/', '/projects/unify/', '/projects/cubic/', '/projects/lens/', '/projects/turtle-trips/', '/projects/pipeline-simulator/', '/profile/']) {
  await page.goto(BASE + url);
  await settle(page, 300);
  const imgs = await page.evaluate(() => [...document.querySelectorAll('img')].map((i) => ({ alt: i.getAttribute('alt'), hidden: !!i.closest('[aria-hidden=true]') })));
  const missing = imgs.filter((i) => i.alt === null).length;
  const described = [...new Set(imgs.filter((i) => i.alt && !i.hidden).map((i) => i.alt))];
  const labelled = await page.evaluate(() => [...document.querySelectorAll('[role=img][aria-label], svg[role=img]')].map((e) => e.getAttribute('aria-label')?.slice(0, 60)));
  report(missing === 0, `${url}: ${imgs.length} images, ${missing} without an alt attribute, ${imgs.filter((i) => i.alt === '' || i.hidden).length} decorative`);
  for (const alt of [...described, ...labelled]) console.log(`       "${alt}"`);
}
await browser.close();

console.log('\n== reduced motion ==');
for (const engine of ['chromium', 'webkit', 'firefox']) {
  const b = await playwright[engine].launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 790 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  for (const url of ['/', '/projects/cubic/', '/projects/lens/', '/projects/pipeline-simulator/', '/profile/']) {
    await p.goto(BASE + url);
    await settle(p, 1500);
    const r = await p.evaluate(async () => {
      const running = document.getAnimations().filter((a) => a.playState === 'running').map((a) => a.animationName || a.transitionProperty || 'animation');
      const canvas = document.querySelector('canvas[data-cube]');
      let cubeMoved = false;
      if (canvas) {
        const before = canvas.toDataURL();
        await new Promise((done) => setTimeout(done, 1200));
        cubeMoved = before !== canvas.toDataURL();
      }
      const hidden = [...document.querySelectorAll('.world, .others, .route-draw')].filter((el) => getComputedStyle(el).opacity === '0' || getComputedStyle(el).strokeDashoffset === '1900px').length;
      return { running, cubeMoved, hidden };
    });
    report(r.running.length === 0 && !r.cubeMoved && r.hidden === 0, `${engine} ${url}: ${r.running.length} running animations${r.running.length ? ` (${[...new Set(r.running)]})` : ''}, cube ${r.cubeMoved ? 'MOVING' : 'still'}, ${r.hidden} hidden elements`);
  }
  await b.close();
}

// ---- links that leave the site, and Copy email (Chromium) ----
console.log('\n== new-tab links and Copy email ==');
{
  const b = await playwright.chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 790 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage();
  for (const url of ['/', '/profile/', '/projects/unify/', '/projects/cubic/', '/projects/nutrifit/']) {
    await p.goto(BASE + url);
    await settle(p, 300);
    const links = await p.evaluate(() =>
      [...document.querySelectorAll('a[href]')].map((a) => ({
        text: a.innerText.replace(/\s+/g, ' ').trim().slice(0, 30) || a.getAttribute('href'),
        leaves: a.origin !== location.origin || a.pathname.endsWith('.pdf'),
        mail: a.protocol === 'mailto:',
        blank: a.target === '_blank',
        rel: a.rel,
        said: a.textContent.includes('(opens in new tab)'),
      })),
    );
    const outside = links.filter((l) => l.leaves && !l.mail);
    const wrong = outside.filter((l) => !l.blank || !l.rel.includes('noopener') || !l.rel.includes('noreferrer') || !l.said);
    const mailBlank = links.filter((l) => l.mail && l.blank);
    const insideBlank = links.filter((l) => !l.leaves && !l.mail && l.blank);
    report(wrong.length === 0 && mailBlank.length === 0 && insideBlank.length === 0, `${url}: ${outside.length} links leave the site, all open in a new tab with rel and a spoken note; ${links.filter((l) => l.mail).length} email links stay in this tab${wrong.length ? ` (wrong: ${wrong.map((l) => l.text)})` : ''}`);
  }
  await p.goto(`${BASE}/`);
  await settle(p, 800);
  await p.click('[data-contact-open]');
  await p.click('.copy-email');
  await p.waitForTimeout(150);
  const copied = await p.evaluate(async () => ({ button: document.querySelector('.copy-email').textContent, said: document.querySelector('[data-copy-status]').textContent, live: document.querySelector('[data-copy-status]').getAttribute('aria-live'), clipboard: await navigator.clipboard.readText() }));
  await p.waitForTimeout(2100);
  const after = await p.evaluate(() => document.querySelector('.copy-email').textContent);
  report(copied.button === 'Copied' && copied.clipboard === 'lat13@sfu.ca' && copied.live === 'polite' && copied.said.includes('lat13@sfu.ca'), `Copy email: button says "${copied.button}", clipboard has "${copied.clipboard}", announced "${copied.said}"`);
  report(after === 'Copy email', `after 2 seconds the button says "${after}" again`);
  await b.close();
}

// ---- contrast against the brightest patch of sky ----
console.log('\n== contrast ==');
const lum = ([r, g, b]) => {
  const f = (v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
// blur away the stars (text never sits on one), then take the brightest area of nebula
const { data, info } = await sharp('redesign/assets/sky-source-2880.jpg').resize(360).blur(6).raw().toBuffer({ resolveWithObject: true });
let sky = [0, 0, 0];
for (let i = 0; i < data.length; i += info.channels) if (lum([data[i], data[i + 1], data[i + 2]]) > lum(sky)) sky = [data[i], data[i + 1], data[i + 2]];
const mix = (fg, bg, a) => fg.map((v, i) => Math.round(v * a + bg[i] * (1 - a)));
console.log(`brightest sky area: rgb(${sky.join(', ')})`);
for (const [what, colour, size] of [
  ['muted text #AEB2C8 (tags 12px, captions 12px, stack 13px)', [174, 178, 200], 12],
  ['gold labels #E8C27A (chips 11px, kickers 12px)', [232, 194, 122], 11],
  ['body text #D9DCEB (15px)', [217, 220, 235], 15],
  ['ID line, 70% of #D9DCEB (12px)', mix([217, 220, 235], sky, 0.7), 12],
  ['inactive tab #AEB2C8 on the tab bar (17px)', [174, 178, 200], 17],
]) {
  const r = ratio(colour, sky);
  report(r >= 4.5, `${what}: ${r.toFixed(2)}:1 on the brightest sky (needs 4.5:1 at ${size}px)`);
}
for (const [what, fg, bg] of [
  ['panel labels #5d6072 on cream #e9e4d8', [93, 96, 114], [233, 228, 216]],
  ['panel status #9fd3a8 on navy #1b2140', [159, 211, 168], [27, 33, 64]],
  ['panel bubble text #1c2033 on white', [28, 32, 51], [255, 255, 255]],
  ['button text #10131F on cream #F3EEE2', [16, 19, 31], [243, 238, 226]],
  ['focus ring gold on sky (needs 3:1)', [232, 194, 122], sky],
]) report(ratio(fg, bg) >= 4.5, `${what}: ${ratio(fg, bg).toFixed(2)}:1`);

if (failed) process.exitCode = 1;
