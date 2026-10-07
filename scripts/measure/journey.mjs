// The journey every browser is driven through, and the numbers read back from the probe.
//   map -> Unify -> browser Back -> Unify -> next -> previous -> Back to map -> About me -> Back to map
// ("back" is taken both ways: once with the browser's Back button, which restores the map
// from the back-forward cache, and then with the page's own back control.)
export const STEPS = [
  { name: 'load map', to: '/' },
  { name: 'map to Unify', click: '.world-unify .world-link', to: '/projects/unify/' },
  { name: 'browser Back to map', back: true, to: '/' },
  { name: 'map to Unify again', click: '.world-unify .world-link', to: '/projects/unify/' },
  { name: 'next (Cubic)', click: '[data-pager="next"]', to: '/projects/cubic/' },
  { name: 'previous (Unify)', click: '[data-pager="prev"]', to: '/projects/unify/' },
  { name: 'Back to map', click: '.site-header a[href="/"]', to: '/' },
  { name: 'map to About me', click: '.world-about .world-link', to: '/profile/' },
  { name: 'Back to map from About', click: '.site-header a[href="/"]', to: '/' },
];

const round = (n) => (n === null || n === undefined ? null : Math.round(n));

/** Gaps between frames inside [from, to] (ms on the page's clock). */
export function gaps(frames, from, to) {
  const inside = frames.filter((t) => t >= from && t <= to);
  const out = [];
  for (let i = 1; i < inside.length; i++) out.push(Math.round((inside[i] - inside[i - 1]) * 10) / 10);
  return out;
}

export function frameStats(list) {
  if (!list.length) return { frames: 0, worst: null, over33: 0, over50: 0, mean: null };
  return {
    frames: list.length,
    mean: Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 10) / 10,
    worst: Math.max(...list),
    over33: list.filter((g) => g > 33.4).length,
    over50: list.filter((g) => g > 50).length,
  };
}

/** One row of numbers for one page visit recorded by the probe. */
export function summarise(nav) {
  const base = nav.base || 0;
  const firstFrame = nav.frames[0] ?? null;
  const firstScreen = Object.entries(nav.images).filter(([, img]) => img.firstScreen);
  const late = firstScreen.filter(([, img]) => img.loadedAt === null);
  const imagesDone = firstScreen.length && !late.length ? Math.max(...firstScreen.map(([, img]) => img.loadedAt)) : null;
  // anything on the first screen that was different at a later frame than at the first one
  const unstable = [];
  for (const [key, entry] of Object.entries(nav.changes)) {
    if (!entry.firstScreen) continue;
    for (const [prop, p] of Object.entries(entry.props)) {
      if (!p.count) continue;
      unstable.push({ el: key, prop, first: p.first, last: p.last, from: round(p.from - base), to: round(p.to - base), steps: p.count });
    }
  }
  const m = nav.marks;
  const transition = m.transition && m.transitionFinished ? { from: m.pagereveal, to: m.transitionFinished } : null;
  return {
    url: nav.url,
    restored: nav.restored,
    // from the click on the page before to this page's first frame
    clickToFirstFrame: nav.clickAt !== null && firstFrame !== null ? round(firstFrame - nav.clickAt) : null,
    firstFrame: round(firstFrame - base),
    firstPaint: nav.paints['first-paint'] ?? null,
    firstContentfulPaint: nav.paints['first-contentful-paint'] ?? null,
    lcp: nav.paints.lcp ?? null,
    lcpElement: nav.paints.lcpElement ?? null,
    domContentLoaded: round(m.DOMContentLoaded),
    load: round(m.load),
    firstScreenImages: firstScreen.length,
    firstScreenImagesDone: round(imagesDone === null ? null : imagesDone - base),
    imagesAfterFirstFrame: firstScreen.filter(([, img]) => img.loadedAt !== null && img.loadedAt > firstFrame + 1).map(([key, img]) => ({ el: key, at: round(img.loadedAt - base), loading: img.loading, priority: img.priority })),
    imagesNeverLoaded: late.map(([key]) => key),
    layoutShift: Math.round(nav.shifts.reduce((a, s) => a + s.value, 0) * 10000) / 10000,
    layoutShifts: nav.shifts,
    transition: m.transition ? (m.transitionFinished ? round(m.transitionFinished - m.pagereveal) : 'skipped') : 'none',
    transitionFrames: transition ? frameStats(gaps(nav.frames, transition.from, transition.to)) : null,
    transitionGaps: transition ? gaps(nav.frames, transition.from, transition.to) : null,
    // the half second after the transition ends (or after the first frame, with no transition)
    afterFrames: frameStats(gaps(nav.frames, transition ? transition.to : firstFrame, (transition ? transition.to : firstFrame) + 600)),
    unstable,
  };
}
