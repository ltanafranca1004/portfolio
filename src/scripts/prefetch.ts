// Fallback for browsers without speculation rules (Safari, Firefox). Chrome and Edge render
// the next page ahead of the click (see layouts/Base.astro) and skip this file.
//
// When a link to another page of this site is hovered, focused or touched, the page is
// fetched, and so are the pictures it marks as its most important (its hero, the sky). The
// click then finds them in the browser's cache and the page opens with its hero in place.

const supportsRules = typeof HTMLScriptElement.supports === 'function' && HTMLScriptElement.supports('speculationrules');
const done = new Set<string>([location.pathname]);
const kept: HTMLImageElement[] = []; // held so a fetch is not dropped with its element

async function warm(href: string): Promise<void> {
  const url = new URL(href, location.href);
  if (url.origin !== location.origin || done.has(url.pathname) || /\.[a-z0-9]+$/i.test(url.pathname)) return;
  done.add(url.pathname);
  try {
    const response = await fetch(url.pathname, { credentials: 'same-origin' });
    if (!response.ok) return;
    const page = new DOMParser().parseFromString(await response.text(), 'text/html');
    for (const img of page.querySelectorAll<HTMLImageElement>('img[fetchpriority="high"]')) {
      // The file the page itself will pick: the first source whose media matches. (AVIF is
      // listed first everywhere; a browser too old to show it just fails this fetch quietly.)
      const source = [...(img.closest('picture')?.querySelectorAll('source') ?? [])].find((s) => !s.media || matchMedia(s.media).matches);
      const copy = new Image();
      copy.sizes = source?.getAttribute('sizes') ?? img.getAttribute('sizes') ?? '';
      const srcset = source?.getAttribute('srcset') ?? img.getAttribute('srcset');
      if (srcset) copy.srcset = srcset;
      else copy.src = img.getAttribute('src') ?? '';
      kept.push(copy);
    }
  } catch {
    done.delete(url.pathname); // offline or interrupted: the click will simply load it
  }
}

if (!supportsRules) {
  const link = (event: Event): string | undefined => (event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]:not([target])') : null)?.href;
  let timer = 0;
  // hover: after a short pause, so sweeping the pointer across the map fetches nothing
  document.addEventListener('mouseover', (event) => {
    const href = link(event);
    clearTimeout(timer);
    if (href) timer = window.setTimeout(() => void warm(href), 80);
  });
  for (const type of ['touchstart', 'focusin'] as const) {
    document.addEventListener(
      type,
      (event) => {
        const href = link(event);
        if (href) void warm(href);
      },
      { passive: true },
    );
  }
}
