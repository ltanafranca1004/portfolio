import { projects } from './projects';

/** The site address, set once as SITE_URL in astro.config.mjs. */
export const SITE_URL: string = import.meta.env.SITE ?? '';

/**
 * Only the production deploy may be indexed. scripts/deploy.sh sets PUBLIC_SITE_ENV to
 * "production" for the production branch; every other build (previews, local) is noindex.
 */
export const IS_PRODUCTION: boolean = import.meta.env.PUBLIC_SITE_ENV === 'production';

export const absoluteUrl = (path: string): string => new URL(path, SITE_URL).href;

/** The share image: 1200 x 630, made by scripts/make-og.mjs. */
export const OG_IMAGE = { path: '/og.jpg', width: 1200, height: 630 };

/** Every page on the site, for the sitemap. */
export const PAGES: string[] = ['/', '/profile/', ...projects.map((p) => `/projects/${p.slug}/`)];

/** Cut a description to a length search results show in full, on a word boundary. */
export function metaDescription(text: string, max = 158): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3).replace(/\s+\S*$/, '').replace(/[,;:.]$/, '')}...`;
}
