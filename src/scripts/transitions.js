// Page-to-page transitions (see the notes in layouts/Base.astro, which inlines this file).
//
// The page itself (the sky, and on project pages and the profile the orbit lines) is never
// moved: old and new cross-fade in place, so there is never a gap to see through. What
// moves is named here, just for the length of the transition:
//   hero     the world that travels: a ring on the map, the hero or the profile photo
//   map      the map's stage           (wide screens only)
//   content  a page's stage, or between two projects just its hero and text column
// On phones only "hero" is named: a whole stacked page is too big to move as one picture.
(() => {
  const root = document.documentElement;
  const order = (root.dataset.projects || '').split(',').filter(Boolean);
  const path = (url) => new URL(url, location.href).pathname;
  const isMap = (url) => path(url) === '/';
  const slugOf = (url) => (path(url).match(/^\/projects\/([^/]+)\/?$/) || [])[1] || null;
  // The world on the map a page belongs to: a project's slug, or "about" for the profile.
  const worldOf = (url) => (path(url) === '/profile/' ? 'about' : slugOf(url));
  const wide = () => innerWidth >= 1200;
  const stage = () => document.querySelector('.stage');
  // What a page opens with: a project's hero, or the photo ring on the profile.
  const heroHere = () => document.querySelector('.hero, .profile-ring');

  // The ring of a world on the map, if it is on screen in this layout.
  const ringFor = (id) => {
    const name = CSS.escape(id);
    const mini = document.querySelector(`.mini-link[data-slug="${name}"]`);
    const ring = document.querySelector(`.world-${name} .ring`) || (mini && mini.closest('.mini').querySelector('.ring'));
    return ring && ring.getClientRects().length > 0 ? ring : null;
  };

  // Where a zoom should centre, as a CSS transform-origin inside the stage.
  const originOf = (el) => {
    const r = el.getBoundingClientRect();
    const box = (wide() && stage() ? stage() : root).getBoundingClientRect();
    return `${(((r.left + r.width / 2 - box.left) / box.width) * 100).toFixed(1)}% ${(((r.top + r.height / 2 - box.top) / box.height) * 100).toFixed(1)}%`;
  };

  // A skipped transition rejects its promises. That is fine, and should not reach the console.
  const quiet = (transition) => {
    for (const promise of [transition.ready, transition.finished, transition.updateCallbackDone]) if (promise) promise.catch(() => {});
  };

  const store = (key, value) => {
    try {
      if (value === undefined) return sessionStorage.getItem(key) || '';
      sessionStorage.setItem(key, value);
    } catch {
      /* storage is optional */
    }
    return '';
  };

  const named = [];
  const name = (el, as) => {
    if (!el) return;
    el.style.viewTransitionName = as;
    named.push(el);
  };

  // The link last followed: a fallback for browsers that do not say where a page swap is going.
  let lastHref = '';
  document.addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (link) lastHref = link.href;
  });

  // Leaving a page: name what should travel.
  window.addEventListener('pageswap', (event) => {
    if (!event.viewTransition) return;
    quiet(event.viewTransition);
    const to = (event.activation && event.activation.entry && event.activation.entry.url) || lastHref;
    if (!to) return;
    const here = location.href;
    if (isMap(here) && worldOf(to)) {
      const ring = ringFor(worldOf(to));
      if (!ring) return;
      name(ring, 'hero');
      store('vt-origin', originOf(ring));
      if (wide()) name(stage(), 'map');
    } else if (worldOf(here) && isMap(to)) {
      name(heroHere(), 'hero');
      if (wide()) name(stage(), 'content');
    } else if (slugOf(here) && slugOf(to) && wide()) {
      name(document.querySelector('.project-body'), 'content');
    }
  });

  // Arriving on a page: pick the kind of transition and name the matching parts.
  window.addEventListener('pagereveal', (event) => {
    const transition = event.viewTransition;
    if (!transition) return;
    quiet(transition);
    const activation = window.navigation && window.navigation.activation;
    const from = (activation && activation.from && activation.from.url) || document.referrer;
    if (!from || new URL(from, location.href).origin !== location.origin) return;

    const here = location.href;
    let type = 'fade';

    if (isMap(from) && worldOf(here)) {
      type = 'zoom-in';
      name(heroHere(), 'hero');
      if (wide()) name(stage(), 'content');
      const origin = store('vt-origin');
      if (origin) root.style.setProperty('--vt-origin', origin);
    } else if (worldOf(from) && isMap(here)) {
      type = 'zoom-out';
      const ring = ringFor(worldOf(from));
      name(ring, 'hero');
      if (wide()) name(stage(), 'map');
      if (ring) root.style.setProperty('--vt-origin', originOf(ring));
    } else if (slugOf(from) && slugOf(here) && slugOf(from) !== slugOf(here)) {
      // next in route order (wrapping round) moves one way, anything else the other
      const a = order.indexOf(slugOf(from));
      type = a !== -1 && order.indexOf(slugOf(here)) === (a + 1) % order.length ? 'slide-next' : 'slide-prev';
      if (wide()) name(document.querySelector('.project-body'), 'content');
    }

    if (transition.types) transition.types.add(type);
    root.dataset.vt = type;
    const tidy = () => {
      for (const el of named.splice(0)) el.style.viewTransitionName = '';
      root.style.removeProperty('--vt-origin');
    };
    transition.finished.then(tidy, tidy);
  });
})();
