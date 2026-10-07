// @ts-check
import { defineConfig } from 'astro/config';

// The one place the site address lives. Change this line when the domain is ready:
// canonical links, share tags, the sitemap, robots.txt and the analytics host check all follow it.
const SITE_URL = 'https://luistanafranca.pages.dev';

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,
  output: 'static',
  devToolbar: { enabled: false },
});
