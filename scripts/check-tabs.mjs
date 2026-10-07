// Checks the profile's tabs.
//   node scripts/check-tabs.mjs
// In Chromium, WebKit and Firefox: the ARIA tabs pattern (one Tab stop, arrow
// keys, Home and End), an address per tab that opens it directly and works with Back and
// Forward, one panel showing with all four in the HTML, the summary on the Profile tab, a
// cross-fade on switching and none under reduced motion.
// Phones: the same four tabs, with the bar under the header (not pinned) and the panel
// scrolling with the page.
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

  // phones: the same four tabs. The bar is straight under the header and is not pinned, one
  // panel shows and scrolls with the page, and the address and the Back button work as on wide screens.
  if (engine !== 'firefox') {
    const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await phone.goto(`${BASE}/profile/`);
    await phone.waitForTimeout(400);
    s = await state(phone);
    const place = await phone.evaluate(() => {
      const top = (sel) => Math.round(document.querySelector(sel).getBoundingClientRect().top);
      const header = document.querySelector('.site-header').getBoundingClientRect();
      return { position: getComputedStyle(document.querySelector('.tabs')).position, tabs: top('.tabs'), header: Math.round(header.bottom), photo: top('.profile-ring'), panel: top('#profile') };
    });
    report(s.list === 'tablist' && s.roles === 'tab,tab,tab,tab' && s.controls && s.stops === 1, `${engine}, phone: a tablist of four tabs, one Tab stop`);
    report(s.showing.join() === 'profile' && s.selected.join() === 'Profile', `${engine}, phone: one panel on the page, Profile by default (${s.showing.join(', ')})`);
    report(place.position !== 'sticky' && place.position !== 'fixed', `${engine}, phone: the tab bar is not pinned (${place.position})`);
    report(place.tabs >= place.header && place.tabs - place.header < 40 && place.tabs < place.photo && place.photo < place.panel, `${engine}, phone: header (ends ${place.header}px), tab bar (${place.tabs}px), photo (${place.photo}px), panel (${place.panel}px), in that order`);
    await phone.tap('.tabs a[href="#experience"]');
    await phone.waitForTimeout(450);
    await phone.tap('.tabs a[href="#education"]');
    await phone.waitForTimeout(450);
    const tapped = await state(phone);
    const still = await phone.evaluate(() => ({ scrollY: Math.round(scrollY), photo: document.querySelector('.profile-ring').getClientRects().length, sideways: document.documentElement.scrollWidth > innerWidth }));
    report(tapped.hash === '#education' && tapped.showing.join() === 'education' && tapped.selected.join() === 'Education', `${engine}, phone: tapping Education shows it and sets the address (${tapped.hash}, showing ${tapped.showing.join(', ')})`);
    report(still.scrollY === 0 && !still.sideways, `${engine}, phone: switching tabs does not move the page (scrolled ${still.scrollY}px)`);
    report(still.photo === 0, `${engine}, phone: the photo belongs to the Profile tab (showing on Education: ${still.photo ? 'yes' : 'no'})`);
    await phone.goBack();
    await phone.waitForTimeout(450);
    const back = await state(phone);
    await phone.goBack();
    await phone.waitForTimeout(450);
    const backAgain = await state(phone);
    report(back.showing.join() === 'experience' && back.hash === '#experience' && backAgain.showing.join() === 'profile', `${engine}, phone: Back walks the tabs (${back.hash} then ${backAgain.hash || '(none)'})`);
    // a long panel scrolls with the page, and the bar scrolls away with it
    await phone.goto(`${BASE}/profile/#experience`);
    await phone.waitForTimeout(450);
    const long = await phone.evaluate(async () => {
      const tall = document.documentElement.scrollHeight - innerHeight;
      scrollTo(0, tall);
      await new Promise((done) => setTimeout(done, 100));
      return { tall, tabsTop: Math.round(document.querySelector('.tabs').getBoundingClientRect().top), showing: [...document.querySelectorAll('[data-panel]')].filter((p) => p.checkVisibility({ visibilityProperty: true })).map((p) => p.id) };
    });
    report(long.showing.join() === 'experience' && long.tall > 100 && long.tabsTop < 0, `${engine}, phone: /profile/#experience opens Experience; the page scrolls ${long.tall}px and the tab bar scrolls away with it`);
    await phone.close();
  }
  await browser.close();
}
if (failed) process.exitCode = 1;
