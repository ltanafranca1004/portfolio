// Keeps the decorative orbit lines and node markers away from text, and decides when the page
// is settled. layouts/Base.astro inlines this file at the end of the page's content, so it runs
// before the first paint.
//
// Every svg[data-keepout] gets a mask with a hole over each line of text on the page, 14px
// larger than the text on every side and stepped down in strength beyond that, so a line fades
// out before it reaches a word instead of passing behind it. The holes are measured from the
// real layout, so this holds at any window size.
//
// The mask is only as large as the part of the drawing that is on the page. The orbit drawing
// is 2840 x 1700 with its run-off lines; a mask over all of it is a far larger picture than
// the window, and it is repainted on every frame of a page transition.
//
// Settling: text is measured in its real font. When the font is already here (every page
// after the first) the masks are made in this script, before anything is painted, and the page
// simply appears. On a first visit the stage and the lines stay hidden until the font arrives,
// then fade in once (global.css, .settling). Nothing is ever painted and then moved or re-masked.
//
// After that the masks are only made again when the layout really changes (the window is
// resized, a profile tab is switched), never while scrolling. On a phone the browser's toolbar
// hides and shows as you scroll, which changes the window height and fires "resize" each time;
// the stacked layouts only depend on the width, so those are ignored.
(() => {
  const PAD = 14; // px kept completely clear around text
  // The soft edge beyond that: rings of rising brightness, drawn as plain shapes. (A blur
  // filter inside the mask looked the same and cost a slow repaint on phones.)
  const EDGE = [
    { grow: PAD + 11, fill: '#aaa' },
    { grow: PAD + 7, fill: '#555' },
    { grow: PAD + 3, fill: '#000' },
  ];
  const STAGE_FROM = 1200; // px: from this width the page is one scaled stage (see global.css)
  const FONT = '16px Jost';
  const NS = 'http://www.w3.org/2000/svg';
  const root = document.documentElement;
  const made = new WeakMap(); // the shapes each drawing's mask was last made from
  let version = 0;

  /** One box per line of visible text, in viewport coordinates. */
  function textBoxes() {
    const boxes = [];
    const range = document.createRange();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const el = node.parentElement;
      if (!el || !node.data.trim()) continue;
      if (el.closest('svg[data-keepout], script, style, noscript, dialog, .sr-only')) continue;
      if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true })) continue; // hidden: needs no hole
      // Text inside an SVG: take the element's own box. A Range there can answer with the
      // scale the drawing had when it was first laid out (seen in Chromium, on the pipeline
      // hero, after its scale was set), which put the hole in the wrong place.
      let rects;
      if (el instanceof SVGElement) rects = [el.getBoundingClientRect()];
      else {
        range.selectNodeContents(node);
        rects = range.getClientRects();
      }
      for (const r of rects) {
        if (r.width < 1 || r.height < 1) continue;
        boxes.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
      }
    }
    return boxes;
  }

  function apply(svg, index, boxes) {
    const lines = svg.querySelector('.orbit-lines');
    const ctm = svg.getScreenCTM();
    if (!lines || !ctm) return;
    const toSvg = ctm.inverse();
    const scale = Math.abs(toSvg.a); // svg units per screen px

    const view = svg.getBoundingClientRect();
    const near = [];
    for (const b of boxes) {
      // skip text nowhere near this drawing
      if (b.right < view.left - 600 || b.left > view.right + 600 || b.bottom < view.top - 600 || b.top > view.bottom + 600) continue;
      const p = new DOMPoint(b.left, b.top).matrixTransform(toSvg);
      const q = new DOMPoint(b.right, b.bottom).matrixTransform(toSvg);
      near.push({ x: p.x, y: p.y, w: q.x - p.x, h: q.y - p.y });
    }
    // the part of the drawing that is on the page
    const a = new DOMPoint(-scrollX, -scrollY).matrixTransform(toSvg);
    const b = new DOMPoint(root.scrollWidth - scrollX, root.scrollHeight - scrollY).matrixTransform(toSvg);
    const box = `x="${Math.floor(a.x)}" y="${Math.floor(a.y)}" width="${Math.ceil(b.x - a.x) + 1}" height="${Math.ceil(b.y - a.y) + 1}"`;
    // every outer ring first, so one line's soft edge never lightens the hole of the next line
    let html = `<rect ${box} fill="#fff"/>`;
    for (const { grow, fill } of EDGE) {
      const g = grow * scale;
      html += `<g fill="${fill}">`;
      for (const r of near) html += `<rect x="${(r.x - g).toFixed(1)}" y="${(r.y - g).toFixed(1)}" width="${(r.w + g * 2).toFixed(1)}" height="${(r.h + g * 2).toFixed(1)}" rx="${(8 * scale).toFixed(1)}"/>`;
      html += '</g>';
    }
    // Nothing moved since last time: leave the mask alone. Replacing it repaints the lines.
    if (made.get(svg) === html) return;
    made.set(svg, html);
    // A fresh mask under a new name each time. Changing the shapes inside the old one left
    // Chromium showing stale tiles: lines drawn through text until something else repainted.
    const id = `keepout-${index}-${++version}`;
    const defs = document.createElementNS(NS, 'defs');
    defs.setAttribute('data-keepout-mask', '');
    defs.innerHTML = `<mask id="${id}" maskUnits="userSpaceOnUse" ${box}>${html}</mask>`;
    const old = svg.querySelector('defs[data-keepout-mask]');
    svg.prepend(defs);
    lines.setAttribute('mask', `url(#${id})`);
    if (old) old.remove();
  }

  function update() {
    const drawings = [...document.querySelectorAll('svg[data-keepout]')].filter((svg) => svg.getClientRects().length > 0);
    if (!drawings.length) return;
    const boxes = textBoxes();
    drawings.forEach((svg, i) => apply(svg, i, boxes));
  }

  // ---- settle: once, when the text is in its real font ----
  const began = performance.now();
  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    update();
    // Kept waiting for the font (a first visit): fade in once. Otherwise the page is simply
    // there, in its first frame.
    if (performance.now() - began > 100) root.classList.add('settle-fade');
    root.classList.remove('settling');
  };
  if (!document.fonts || document.fonts.check(FONT)) settle();
  else document.fonts.load(FONT).then(settle, settle);
  // (the head of the page also lifts .settling after three seconds, whatever happens here)

  // ---- afterwards: only when the layout really changes ----
  let timer = 0;
  // The map's worlds rise 10px into place on a first visit. Text measured on the way up would
  // put its hole 10px low, so wait until they have arrived.
  const arriving = () => document.getAnimations().some((animation) => animation.animationName === 'arrive' && animation.playState === 'running');
  const later = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (arriving()) later();
      else if (settled) update();
    }, 150);
  };
  let width = innerWidth;
  let height = innerHeight;
  addEventListener('resize', () => {
    const w = innerWidth;
    const h = innerHeight;
    // below the stage width only a change of width moves anything
    const changed = w !== width || (h !== height && w >= STAGE_FROM);
    width = w;
    height = h;
    if (changed) later();
  });
  // A drawing that fills the page is rescaled when the page changes height, which moves its
  // lines but not the text. (If nothing moved, update() leaves the mask as it is.)
  if ('ResizeObserver' in window) {
    const sized = new ResizeObserver(later);
    for (const svg of document.querySelectorAll('svg[data-keepout]')) sized.observe(svg);
  }
  addEventListener('load', later);
  addEventListener('pageshow', (event) => event.persisted && later());
  // a page can ask for a fresh measurement after it changes what text is showing
  document.addEventListener('keepout:update', () => settled && update());
})();
