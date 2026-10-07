// Checks the analytics rules without sending anything to PostHog: every request to the
// PostHog host is intercepted and answered locally, and its payload is read instead.
//   node scripts/check-analytics.mjs
import { gunzipSync } from 'node:zlib';
import { BASE, playwright } from './browsers.mjs';

const SITE = 'https://luistanafranca.pages.dev';
let failed = false;
const report = (ok, text) => {
  if (!ok) failed = true;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${text}`);
};

function decode(request) {
  const raw = request.postDataBuffer();
  if (!raw) return [];
  let text;
  try {
    text = gunzipSync(raw).toString('utf8');
  } catch {
    text = raw.toString('utf8');
  }
  if (text.startsWith('data=')) text = Buffer.from(decodeURIComponent(text.slice(5)), 'base64').toString('utf8');
  try {
    const json = JSON.parse(text);
    return Array.isArray(json) ? json : (json.batch ?? [json]);
  } catch {
    return [{ event: `(unreadable ${raw.length} bytes)` }];
  }
}

async function visit(browser, { url, dnt = false, onSite = false, act }) {
  // a normal user agent: posthog-js drops events from browsers that say they are headless
  const context = await browser.newContext({ viewport: { width: 1440, height: 790 }, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' });
  // ...and from automated ones, which is right for the live site but would hide everything here
  await context.addInitScript(() => Object.defineProperty(Object.getPrototypeOf(navigator), 'webdriver', { get: () => false }));
  if (dnt) await context.addInitScript(() => Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' }));
  const events = [];
  const hosts = new Set();
  let library = false;
  await context.route(/posthog\.com/, (route) => {
    hosts.add(new URL(route.request().url()).host);
    events.push(...decode(route.request()));
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":1}' });
  });
  // serve the local build under the real site address, to test the host check
  if (onSite) await context.route(`${SITE}/**`, async (route) => route.fulfill({ response: await route.fetch({ url: route.request().url().replace(SITE, BASE) }) }));
  const page = await context.newPage();
  const logs = [];
  page.on('console', (msg) => logs.push(msg.text()));
  page.on('request', (r) => /module\.no-external/.test(r.url()) && (library = true));
  await page.goto((onSite ? SITE : BASE) + url);
  await page.waitForTimeout(3500);
  if (act) await act(page);
  await page.waitForTimeout(4500); // posthog sends in batches every few seconds
  const storage = await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage), cookie: document.cookie }));
  const cookies = await context.cookies();
  await context.close();
  return { events, hosts: [...hosts], library, storage, cookies, logs };
}

// the full browser, not the headless shell: its client hints do not say "HeadlessChrome"
const browser = await playwright.chromium.launch({ channel: 'chromium' });

let r = await visit(browser, { url: '/' });
report(!r.library && r.events.length === 0, `localhost, no flag: library ${r.library ? 'LOADED' : 'not loaded'}, ${r.events.length} events`);

r = await visit(browser, { url: '/', onSite: true });
const names = (events) => [...new Set(events.map((e) => e.event))].join(', ');
report(r.library && r.events.some((e) => e.event === '$pageview'), `real site address: library loaded, events: ${names(r.events)}`);
report(r.hosts.every((h) => h === 'us.i.posthog.com'), `requests go only to: ${r.hosts.join(', ')}`);

r = await visit(browser, { url: '/', onSite: true, dnt: true });
report(!r.library && r.events.length === 0, `real site address with Do Not Track: library ${r.library ? 'LOADED' : 'not loaded'}, ${r.events.length} events`);

r = await visit(browser, {
  url: '/?ph_debug=1',
  act: async (page) => {
    // keep the links from navigating away, so every click can be checked on one page
    await page.evaluate(() => window.addEventListener('click', (e) => e.target.closest('a') && !e.target.closest('[data-contact-open]') && e.preventDefault()));
    await page.click('.site-nav [data-event=github_click]');
    await page.click('.site-nav [data-event=linkedin_click]');
    await page.click('.site-nav [data-event=resume_open]');
    await page.click('.world-unify', { position: { x: 150, y: 250 } });
    await page.click('.mini:nth-child(3) .mini-link');
    await page.click('[data-contact-open]');
    await page.click('#contact-panel [data-event=email_click]');
  },
});
const custom = r.events.filter((e) => !e.event.startsWith('$'));
console.log(`     debug run: ${r.events.map((e) => (e.properties?.slug ? `${e.event}(${e.properties.slug})` : e.event)).join(', ')}`);
for (const want of ['github_click', 'linkedin_click', 'resume_open', 'project_open', 'contact_open', 'email_click']) report(custom.some((e) => e.event === want), `?ph_debug=1 sends ${want}`);
report(custom.filter((e) => e.event === 'project_open').map((e) => e.properties.slug).join() === 'unify,pipeline-simulator', 'project_open carries the project slug');
report(r.events.some((e) => e.event === '$pageview'), 'page view captured');
report(r.logs.some((l) => l.startsWith('[analytics] contact_open')), `events are logged to the console (${r.logs.filter((l) => l.startsWith('[analytics]')).length} lines)`);
// the map's own "seen" flag and the transition origin are not analytics
const phKeys = r.storage.session.filter((k) => k.startsWith('ph_'));
report(r.cookies.length === 0 && !r.storage.cookie && r.storage.local.length === 0 && phKeys.length > 0, `stored in sessionStorage only: ${r.cookies.length} cookies, localStorage [${r.storage.local}], sessionStorage [${r.storage.session}]`);
const props = r.events.find((e) => e.event === '$pageview')?.properties ?? {};
report(!r.events.some((e) => ['$autocapture', '$snapshot', '$$heatmap', '$rageclick', '$dead_click', '$pageleave'].includes(e.event)), 'no autocapture, recording, heatmap or page-leave events');
console.log(`     page view: host=${props.$host} path=${props.$pathname} person profile=${props.$process_person_profile}`);

await browser.close();
if (failed) process.exitCode = 1;
