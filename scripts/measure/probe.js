// Injected at the top of <head> by scripts/measure/serve.mjs. Never shipped with the site.
//
// Records, for every page load in the tab: when it first painted, when each image finished,
// the time of every animation frame, and every tracked element whose layout box, opacity,
// visibility, scale or mask changed after the first frame. Each load's record is kept in
// sessionStorage so the driver can read the whole journey at the end.
//   window.__probeMode = 'full'   everything
//   window.__probeMode = 'light'  frame times and navigation marks only (costs almost nothing)
(() => {
  if (window.__probe) return;
  const FULL = window.__probeMode !== 'light';
  const SEL = '.stage, .hero, .hero-stage, .ring, .cube, .world, .mini, .orbits, .orbit-lines, .phone-orbit, .routewrap, .route-draw, img, canvas, h1, .world-text, .project-main, .profile-main, .panel, .tabs, .site-header, .others';
  const now = () => Math.round(performance.now() * 10) / 10;
  const store = (key, value) => {
    try {
      if (value === undefined) return sessionStorage.getItem(key);
      sessionStorage.setItem(key, value);
    } catch {
      /* no storage */
    }
    return null;
  };

  const fresh = (restored) => ({
    url: location.pathname + location.hash,
    restored,
    // when the click that led here happened, on this page's clock (negative: before it began)
    clickAt: restored ? null : Number(store('probe-click') || 0) ? Math.round(Number(store('probe-click')) - performance.timeOrigin) : null,
    base: restored ? now() : 0,
    marks: {},
    paints: {},
    shifts: [],
    frames: [],
    images: {},
    changes: {},
  });
  let nav = fresh(false);
  window.__probe = () => nav;
  store('probe-click', '');

  const describe = (el) => {
    if (!el || !el.tagName) return '';
    const cls = typeof el.className === 'string' ? el.className : el.className?.baseVal || '';
    let name = el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + (cls ? `.${cls.trim().split(/\s+/).slice(0, 3).join('.')}` : '');
    const up = el.closest?.('.world, .mini, .hero, .profile-ring, .panel');
    if (up && up !== el) name = `${describe(up)} ${name}`;
    return name;
  };

  const save = () => {
    nav.id ??= `${performance.timeOrigin}-${nav.base}`;
    const all = JSON.parse(store('probe-log') || '[]').filter((n) => n.id !== nav.id);
    all.push(nav);
    store('probe-log', JSON.stringify(all));
  };

  const observe = (type, each) => {
    try {
      new PerformanceObserver((list) => list.getEntries().forEach(each)).observe({ type, buffered: true });
    } catch {
      /* not in this browser */
    }
  };
  observe('paint', (e) => (nav.paints[e.name] = Math.round(e.startTime)));
  observe('largest-contentful-paint', (e) => {
    nav.paints.lcp = Math.round(e.startTime);
    nav.paints.lcpElement = describe(e.element);
  });
  observe('layout-shift', (e) => {
    if (!e.hadRecentInput) nav.shifts.push({ t: Math.round(e.startTime), value: Math.round(e.value * 10000) / 10000, nodes: (e.sources || []).map((s) => describe(s.node)) });
  });

  for (const type of ['DOMContentLoaded', 'load', 'pageswap', 'pagereveal', 'pageshow', 'pagehide']) {
    addEventListener(
      type,
      (event) => {
        if (type === 'pageshow' && event.persisted) {
          // back from the back-forward cache: a new visit of the same document
          save();
          nav = fresh(true);
        }
        nav.marks[type] = now();
        if (type === 'pagereveal') performance.mark('probe:reveal');
        if (type === 'pagereveal') {
          const vt = event.viewTransition;
          nav.marks.transition = Boolean(vt);
          if (vt) {
            vt.ready.then(
              () => (nav.marks.transitionReady = now()),
              () => (nav.marks.transitionSkipped = now()),
            );
            vt.finished.then(
              () => {
                nav.marks.transitionFinished = now();
                performance.mark('probe:end');
                save();
              },
              () => {},
            );
          }
        }
        if (type === 'pageswap') nav.marks.swapTransition = Boolean(event.viewTransition);
        if (type === 'pageswap' || type === 'pagehide') save();
      },
      true,
    );
  }
  for (const type of ['click', 'touchstart', 'keydown']) {
    addEventListener(
      type,
      () => {
        nav.marks[type] = now();
        performance.mark('probe:click');
        store('probe-click', String(performance.timeOrigin + performance.now()));
      },
      true,
    );
  }
  document.addEventListener('prerenderingchange', () => (nav.marks.activated = now()));
  if (document.prerendering) nav.marks.prerendered = true;

  // ---- what every tracked element looks like, frame by frame ----
  const seen = new Map();
  const inView = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  const look = (el) => {
    const style = getComputedStyle(el);
    const html = el instanceof HTMLElement;
    const r = el.getBoundingClientRect();
    const out = {
      // the layout box: where it is and how big, before any transform (a floating ring does not count)
      box: html ? `${el.offsetLeft},${el.offsetTop} ${el.offsetWidth}x${el.offsetHeight}` : `${Math.round(r.left + scrollX)},${Math.round(r.top + scrollY)} ${Math.round(r.width)}x${Math.round(r.height)}`,
      opacity: style.opacity,
      visibility: style.visibility,
    };
    if (el.matches('.stage, .hero-stage')) out.scale = style.transform;
    if (el.matches('.orbit-lines')) out.mask = el.getAttribute('mask') ? 'set' : 'none';
    if (el.tagName === 'IMG') out.loaded = el.complete && el.naturalWidth > 0 ? 'yes' : 'no';
    if (el.matches('.cube')) out.live = el.classList.contains('is-live') ? 'yes' : 'no';
    return { out, visible: inView(r) };
  };
  const scan = (t) => {
    const counts = {};
    for (const el of document.querySelectorAll(SEL)) {
      let key = seen.get(el);
      if (!key) {
        const base = describe(el);
        counts[base] = (counts[base] || 0) + 1;
        key = counts[base] > 1 ? `${base} (${counts[base]})` : base;
        seen.set(el, key);
      }
      const { out, visible } = look(el);
      if (el.tagName === 'IMG') {
        const img = (nav.images[key] ||= { src: '', loading: el.loading, priority: el.fetchPriority || 'auto', firstScreen: visible, loadedAt: null });
        if (out.loaded === 'yes' && img.loadedAt === null) {
          img.loadedAt = t;
          img.src = (el.currentSrc || el.src).split('/').pop();
        }
      }
      const entry = (nav.changes[key] ||= { firstScreen: visible, props: {} });
      for (const prop in out) {
        const p = (entry.props[prop] ||= { first: out[prop], last: out[prop], count: 0, from: null, to: null });
        if (p.last !== out[prop]) {
          p.count++;
          p.from ??= t;
          p.to = t;
          p.last = out[prop];
        }
      }
    }
  };

  let saved = 0;
  const frame = (t) => {
    t = Math.round(t * 10) / 10;
    if (nav.frames.length < 20000) nav.frames.push(t);
    if (FULL && document.body) scan(t);
    if (t - saved > 700) {
      saved = t;
      save();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
})();
