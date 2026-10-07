// Checks the profile's tabs.
//   node scripts/check-tabs.mjs
// Wide screens, in Chromium, WebKit and Firefox: the ARIA tabs pattern (one Tab stop, arrow
// keys, Home and End), an address per tab that opens it directly and works with Back and
// Forward, one panel showing with all four in the HTML, the summary on the Profile tab, a
// cross-fade on switching and none under reduced motion.
// Phones: the same links are plain jump links and every section is on the page.
import { BASE, playwright } from './browsers.mjs';

let failed = false;
const report = (ok, text) => {
  if (!ok) failed = true;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${text}`);
};

const state = (page) =>
  page.evaluate(() => {
    const tabs = [...document.querySelectorAll('.tabs a')];
    const panels = [...document.querySelectorAll('[data-panel]')];
    const visible = (el) => el.checkVisibility({ visibilityProperty: true });
    return {
      list: document.querySelector('.tabs').getAttribute('role'),
      roles: tabs.map((t) => t.getAttribute('role')).join(),
      selected: tabs.filter((t) => t.getAttribute('aria-selected') === 'true').map((t) => t.textContent.trim()),
      stops: tabs.filter((t) => t.tabIndex === 0).length,
      controls: tabs.every((t) => document.getElementById(t.getAttribute('aria-controls'))?.getAttribute('aria-labelledby') === t.id),
      showing: panels.filter(visible).map((p) => p.id),
      inHtml: panels.filter((p) => p.textContent.trim().length > 40).length,
      focus: document.activeElement?.textContent.trim(),
      hash: location.hash,
    };
  });

for (const engine of ['chromium', 'webkit', 'firefox']) {
  const browser = await playwright[engine].launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const settle = () => page.waitForTimeout(450); // longer than the 250ms cross-fade

  await page.goto(`${BASE}/profile/`);
  await settle();
  let s = await state(page);
  report(s.list === 'tablist' && s.roles === 'tab,tab,tab,tab' && s.controls, `${engine}: a tablist of four tabs, each tied to its panel`);
  report(s.selected.join() === 'Profile' && s.showing.join() === 'profile', `${engine}: Profile is the default (selected: ${s.selected}, showing: ${s.showing})`);
  report(s.stops === 1, `${engine}: the tabs are one Tab stop (${s.stops})`);
  report(s.inHtml === 4, `${engine}: all four panels are in the HTML (${s.inHtml})`);
  const summary = await page.evaluate(() => {
    const panel = document.querySelector('#profile');
    const seen = (sel) => [...panel.querySelectorAll(sel)].filter((el) => el.checkVisibility({ visibilityProperty: true }));
    return { quote: seen('.bio').length, facts: seen('.quick-facts dt').length, buttons: seen('.cta a').map((a) => a.innerText.replace(/\s+/g, ' ').trim()) };
  });
  report(summary.quote === 1 && summary.facts === 4 && summary.buttons[0] === 'Email me' && summary.buttons[1]?.startsWith('Resume'), `${engine}: the Profile tab has the quote, ${summary.facts} facts and the buttons ${summary.buttons.join(' and ')}`);

  // arrow keys, Home and End
  await page.focus('.tabs a[aria-selected="true"]');
  const steps = [];
  for (const key of ['ArrowRight', 'ArrowRight', 'End', 'ArrowRight', 'ArrowLeft', 'Home']) {
    await page.keyboard.press(key);
    await settle();
    s = await state(page);
    steps.push(`${key}: ${s.focus}${s.focus === s.selected[0] && s.showing.join() === s.hash.slice(1) && s.showing.length === 1 ? '' : ' (WRONG)'}`);
  }
  report(steps.join(', ') === 'ArrowRight: Experience, ArrowRight: Skills, End: Education, ArrowRight: Profile, ArrowLeft: Education, Home: Profile', `${engine}: keys move focus, selection, panel and address together (${steps.join(', ')})`);

  // an address per tab: clicks, Back and Forward, and opening one directly
  await page.goto(`${BASE}/profile/`);
  await settle();
  await page.click('.tabs a[href="#experience"]');
  await settle();
  await page.click('.tabs a[href="#skills"]');
  await settle();
  const clicked = await state(page);
  await page.goBack();
  await settle();
  const back = await state(page);
  await page.goBack();
  await settle();
  const backAgain = await state(page);
  await page.goForward();
  await settle();
  const forward = await state(page);
  report(
    clicked.hash === '#skills' && clicked.showing.join() === 'skills' && back.hash === '#experience' && back.showing.join() === 'experience' && back.selected.join() === 'Experience' && backAgain.showing.join() === 'profile' && forward.showing.join() === 'experience' && page.url().includes('/profile/'),
    `${engine}: clicks set the address; Back and Forward walk the tabs (${clicked.hash} > back ${back.hash || '(none)'} > back ${backAgain.hash || '(none)'} > forward ${forward.hash})`,
  );
  const scrolled = await page.evaluate(() => scrollY);
  report(scrolled === 0, `${engine}: switching tabs does not move the page (scrolled ${scrolled})`);
  for (const id of ['experience', 'skills', 'education']) {
    await page.goto(`${BASE}/profile/#${id}`);
    await settle();
    s = await state(page);
    report(s.showing.join() === id && s.selected.length === 1 && s.selected[0].toLowerCase() === id, `${engine}: /profile/#${id} opens the ${s.selected[0]} tab directly`);
  }

  // the cross-fade
  await page.goto(`${BASE}/profile/`);
  await settle();
  await page.click('.tabs a[href="#experience"]');
  const fade = await page.evaluate(() =>
    [...document.querySelectorAll('[data-panel]')].flatMap((p) =>
      p.getAnimations().map((a) => {
        const frames = a.effect.getKeyframes();
        return { id: p.id, ms: a.effect.getTiming().duration, from: `${frames[0].opacity} ${frames[0].transform}`, to: `${frames.at(-1).opacity} ${frames.at(-1).transform}` };
      }),
    ),
  );
  const incoming = fade.find((f) => f.id === 'experience');
  const outgoing = fade.find((f) => f.id === 'profile');
  report(incoming?.ms === 250 && outgoing?.ms === 250 && incoming.from === '0 translateX(16px)' && outgoing.to === '0 translateX(-16px)', `${engine}: panels cross-fade over ${incoming?.ms}ms with a 16px shift (in from "${incoming?.from}", out to "${outgoing?.to}")`);
  await settle();
  report(errors.length === 0, `${engine}: ${errors.length} errors ${errors.slice(0, 2).join(' | ')}`);
  await page.close();

  // reduced motion: the panels swap, nothing animates
  const calm = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await calm.goto(`${BASE}/profile/`);
  await calm.waitForTimeout(400);
  await calm.click('.tabs a[href="#skills"]');
  const moving = await calm.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
  const after = await state(calm);
  report(moving === 0 && after.showing.join() === 'skills', `${engine}, reduced motion: the tab switches with ${moving} animations running`);
  await calm.close();

  // phones: jump links, every section on the page
  if (engine !== 'firefox') {
    const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await phone.goto(`${BASE}/profile/`);
    await phone.waitForTimeout(400);
    s = await state(phone);
    const sticky = await phone.evaluate(() => getComputedStyle(document.querySelector('.tabs')).position);
    report(s.list === null && s.roles === ',,,' && s.showing.length === 4, `${engine}, phone: plain links, and all four sections are on the page (${s.showing.join(', ')})`);
    report(sticky !== 'sticky' && sticky !== 'fixed', `${engine}, phone: the row of links is not pinned (${sticky})`);
    await phone.tap('.tabs a[href="#education"]');
    await phone.waitForTimeout(1200);
    const jumped = await phone.evaluate(() => ({ hash: location.hash, top: Math.round(document.querySelector('#education').getBoundingClientRect().top), scrollY: Math.round(scrollY) }));
    report(jumped.hash === '#education' && jumped.scrollY > 500 && jumped.top < 400, `${engine}, phone: tapping Education jumps down to it (scrolled ${jumped.scrollY}px, section now ${jumped.top}px from the top)`);
    await phone.close();
  }
  await browser.close();
}
if (failed) process.exitCode = 1;
