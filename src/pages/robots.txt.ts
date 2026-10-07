import type { APIRoute } from 'astro';
import { absoluteUrl } from '../lib/site';

// Crawling is allowed everywhere. Preview builds are kept out of search results by a
// noindex meta tag and an X-Robots-Tag header instead, which only work if pages can be fetched.
export const GET: APIRoute = () =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl('/sitemap.xml')}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
