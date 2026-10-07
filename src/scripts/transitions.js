// Page-to-page transitions (see the notes in layouts/Base.astro, which inlines this file).
(() => {
  const root = document.documentElement;
  const order = (root.dataset.projects || '').split(',').filter(Boolean);
  const path = (url) => new URL(url, location.href).pathname;
  const isMap = (url) => path(url) === '/';
  const slugOf = (url) => (path(url).match(/^\/projects\/([^/]+)\/?$/) || [])[1] || null;

  // The ring of a world on the map, if it is on screen in this layout.
  const ringFor = (slug) => {
    const name = CSS.escape(slug);
    const mini = document.querySelector(`.mini-link[data-slug="${name}"]`);
    const ring = document.querySelector(`.world-${name} .ring`) || (mini && mini.closest('.mini').querySelector('.ring'));
    return ring && ring.getClientRects().length > 0 ? ring : null;
  };

  // Where a zoom should centre, as a CSS transform-origin.
  const originOf = (el) => {
    const r = el.getBoundingClientRect();
    return `${(((r.left + r.width / 2) / innerWidth) * 100).toFixed(1)}% ${(((r.top + r.height / 2) / innerHeight) * 100).toFixed(1)}%`;
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

  // The link last followed: a fallback for browsers that do not say where a page swap is going.
  let lastHref = '';
  document.addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (link) lastHref = link.href;
  });

  // Leaving a page: name the element that should travel.
  window.addEventListener('pageswap', (event) => {
    if (!event.viewTransition) return;
    quiet(event.viewTransition);
    const to = (event.activation && event.activation.entry && event.activation.entry.url) || lastHref;
    if (!to) return;
    const toSlug = slugOf(to);
    if (isMap(location.href) && toSlug) {
      const ring = ringFor(toSlug);
      if (!ring) return;
      ring.style.viewTransitionName = 'hero';
      store('vt-origin', originOf(ring));
    } else if (slugOf(location.href) && isMap(to)) {
      const hero = document.querySelector('.hero');
      if (hero) hero.style.viewTransitionName = 'hero';
    }
  });

  // Arriving on a page: pick the kind of transition and name the matching element.
  window.addEventListener('pagereveal', (event) => {
    const transition = event.viewTransition;
    if (!transition) return;
    quiet(transition);
    const activation = window.navigation && window.navigation.activation;
    const from = (activation && activation.from && activation.from.url) || document.referrer;
    if (!from || new URL(from, location.href).origin !== location.origin) return;

    const fromSlug = slugOf(from);
    const hereSlug = slugOf(location.href);
    let type = 'fade';
    let traveller = null;

    if (isMap(from) && hereSlug) {
      type = 'zoom-in';
      traveller = document.querySelector('.hero');
      const origin = store('vt-origin');
      if (origin) root.style.setProperty('--vt-origin', origin);
    } else if (fromSlug && isMap(location.href)) {
      type = 'zoom-out';
      traveller = ringFor(fromSlug);
      if (traveller) root.style.setProperty('--vt-origin', originOf(traveller));
    } else if (fromSlug && hereSlug && fromSlug !== hereSlug) {
      // next in route order (wrapping round) slides one way, anything else the other
      const a = order.indexOf(fromSlug);
      type = a !== -1 && order.indexOf(hereSlug) === (a + 1) % order.length ? 'slide-next' : 'slide-prev';
    }

    if (transition.types) transition.types.add(type);
    root.dataset.vt = type;
    if (traveller) traveller.style.viewTransitionName = 'hero';
    const tidy = () => {
      if (traveller) traveller.style.viewTransitionName = '';
      root.style.removeProperty('--vt-origin');
    };
    transition.finished.then(tidy, tidy);
  });
})();
