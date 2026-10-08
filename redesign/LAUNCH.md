# Launch: live on the free address

**Launched 2026-10-07 (Session 9).** The site is live at https://luistanafranca.pages.dev.
There is no custom domain. The old address, https://ltanafranca1004.github.io/portfolio,
forwards to it.

The personal Cloudflare account is `3a459a47f63c6f049c3217b090c824dd`. The Pages project is
`luistanafranca`. Never touch anything under UnifyCN. **(you)** marks a step only Luis can do:
it needs a browser signed in to an account, or a payment.

## How to deploy

Both go through `scripts/deploy.sh`, which aborts unless `npx wrangler whoami` shows exactly
one account and it is `3a459a47f63c6f049c3217b090c824dd`. It runs `astro check`, `eslint` and
the build first. **Stay on the `redesign` branch in git for both**: the name after `--` is only
a label passed to Cloudflare, and the deploy is built from the folder you are in.

| | Command | Address | Indexed |
|---|---|---|---|
| Preview | `npm run deploy` | https://redesign.luistanafranca.pages.dev | No: noindex meta tag and `X-Robots-Tag` header |
| Production | `npm run deploy -- main` | https://luistanafranca.pages.dev | Yes |

The production branch of the Pages project is `main` (confirmed: the Session 9 deploy to it
is listed with Environment "Production"). Deploy a preview first, look at it, then production.

To put an earlier production build back: Cloudflare dashboard, Workers & Pages,
`luistanafranca`, Deployments, the earlier Production deployment, "Rollback to this
deployment" **(you)**. Or check out the earlier commit and run `npm run deploy -- main`.

## The old GitHub Pages address

Resumes already sent link to `https://ltanafranca1004.github.io/portfolio`. GitHub Pages serves
git's `main` branch, folder `/` (unchanged). GitHub Pages cannot send a real 301, so `main` now
holds two small pages that forward to the new site:

- `index.html`: a meta refresh, a canonical link and a `location.replace`, all to
  `https://luistanafranca.pages.dev/`, plus a visible "This site has moved" link.
- `404.html`: the same file, so any other address under `/portfolio/` forwards too.

The README and the old site's images are still on `main`, untouched. The old site as it was
(commit `755b7b1`) is the tag **`old-site-2026`**. The redirect is commit `3d478c0`.

Keep the repository public, Pages switched on and serving `main`, for as long as old resumes
are in circulation. Renaming or deleting the repository, or the GitHub account, breaks the
links. **Do not merge `redesign` into `main`:** that would replace the redirect with the
source of the new site, which GitHub Pages cannot serve.

### Rollback: put the old site back

One step. It adds a commit to `main` whose contents are exactly the tagged old site (no force
push, the redirect commit stays in the history):

```bash
git fetch origin --tags && git push origin "$(git commit-tree 'old-site-2026^{tree}' -p origin/main -m 'Restore the old site from old-site-2026')":main
```

GitHub Pages rebuilds in about a minute. Check with:

```bash
curl -s https://ltanafranca1004.github.io/portfolio/ | grep -c 'luistanafranca.pages.dev'
```

`0` means the old site is back. To put the redirect back after that:

```bash
git fetch origin && git push origin "$(git commit-tree '3d478c0^{tree}' -p origin/main -m 'Redirect the old site again')":main
```

## Checks after any production deploy

Production must have neither the tag nor the header (both print `0`):

```bash
curl -s https://luistanafranca.pages.dev/ | grep -ci 'name="robots"'
```

```bash
curl -sI https://luistanafranca.pages.dev/ | grep -ci 'x-robots-tag'
```

Previews must have both (`noindex, nofollow`):

```bash
curl -s https://redesign.luistanafranca.pages.dev/ | grep -i 'name="robots"'
```

```bash
curl -sI https://redesign.luistanafranca.pages.dev/ | grep -i 'x-robots-tag'
```

The 404 page carries a noindex tag on every build, production included. That is intended.

`npm run lighthouse -- <label> https://luistanafranca.pages.dev` should show SEO 100.

## PostHog

Events are sent only from the host in `SITE_URL` (`luistanafranca.pages.dev`), never from a
preview address or localhost, and not when Do Not Track is on. `?ph_debug=1` forces it on and
prints each event in the console as `[analytics] <event>`.

- [ ] **(you)** PostHog, the personal project (the one whose key starts `phc_x8Xs`), Activity:
      confirm the Session 9 test events arrived (`$pageview` and `contact_open`, host
      `luistanafranca.pages.dev`, 2026-10-07 around 17:12 Vancouver time, browser "Claude").
- [ ] **(you)** If the project restricts domains (Settings, Project, Web analytics, Authorized
      domains or "Authorized URLs"), add `https://luistanafranca.pages.dev`.
- [ ] **(you)** Consider Settings, Project, "Discard client IP data" (see Session 4, note 5).

## Still to do **(you)**

- [ ] Update the link on the resume PDF, LinkedIn, the GitHub profile README and the
      `ltanafranca1004/portfolio` repository's "Website" field to
      `https://luistanafranca.pages.dev`.
- [ ] Google Search Console: add `https://luistanafranca.pages.dev` as a URL-prefix property
      (the HTML-tag or HTML-file method; there is no DNS to verify with) and submit
      `https://luistanafranca.pages.dev/sitemap.xml`. The verification tag or file has to be
      added to the site and deployed.
- [ ] Paste `https://luistanafranca.pages.dev/` into a LinkedIn post draft or a chat app to
      confirm the share image appears.

## Later: adding a custom domain

Not done, and not needed. If a domain is bought later, do these in order. `DOMAIN` stands for
the address, for example `luistanafranca.com`.

### 1. Buy the domain **(you)**

1. Open https://dash.cloudflare.com in the browser.
2. **Check which account the browser is signed in to before paying.** The address bar must read
   `dash.cloudflare.com/3a459a47f63c6f049c3217b090c824dd/...`. If it shows a different ID, or
   the account switcher (top left) names Unify, switch accounts first. A domain registered on
   the wrong account cannot simply be moved: a transfer between accounts is a support request,
   and a transfer between registrars is locked for 60 days.
3. Domain Registration, Register Domains, search for `DOMAIN`, buy it. Cloudflare creates the
   DNS zone for it on the same account.
4. The site lives on the bare domain (`DOMAIN`), and `www.DOMAIN` redirects to it.

### 2. Connect it **(you)**

1. Cloudflare dashboard (same account check), Workers & Pages, `luistanafranca`, Custom
   domains, Set up a custom domain, enter `DOMAIN`. Cloudflare adds the DNS record itself
   because the zone is on the same account. Wait for "Active" (a few minutes).
2. Add `www.DOMAIN` the same way, then make it redirect: in the `DOMAIN` zone, Rules,
   Redirect Rules, create a rule: hostname equals `www.DOMAIN`, dynamic redirect to
   `concat("https://DOMAIN", http.request.uri.path)`, status 301, preserve query string.
3. Open `https://DOMAIN`. If the certificate is not ready yet, wait a few minutes. At this
   point both addresses serve the site and every canonical link still says `pages.dev`.

### 3. Change SITE_URL and redeploy

1. In `astro.config.mjs`, change the one line:
   `const SITE_URL = 'https://DOMAIN';` (no trailing slash, no `www`).
   Canonical links, share tags, `sitemap.xml`, `robots.txt`, JSON-LD and the analytics host
   check all follow it.
2. `scripts/check-analytics.mjs` has the address in its `SITE` constant: change it too.
3. `npm run check && npm run lint && npm run build`, then
   `grep -o 'rel="canonical" href="[^"]*"' dist/index.html` must show `https://DOMAIN/`.
4. Commit on `redesign`, push, `npm run deploy -- main`.
5. Run "Checks after any production deploy" above against `https://DOMAIN`.

From here analytics is sent only from `DOMAIN`; visits to `luistanafranca.pages.dev` are not
counted until step 4 forwards them.

### 4. Redirect pages.dev to the domain **(you)**

`luistanafranca.pages.dev` keeps serving the site, and the links sent out during the free
address period point at it. A `_redirects` file cannot do this (it only matches paths, not
hosts). Use a Bulk Redirect on the account:

1. Cloudflare dashboard (same account check), Bulk Redirects (under Rules at the account
   level), create a Bulk Redirect List with one entry: source `luistanafranca.pages.dev`,
   target `https://DOMAIN`, status 301, with "Preserve query string", "Subpath matching" and
   "Preserve path suffix" switched on.
2. Create a Bulk Redirect Rule that uses the list, and enable it.
3. `curl -sI https://luistanafranca.pages.dev/projects/unify/` must show `301` and
   `location: https://DOMAIN/projects/unify/`.

Until this is done the canonical links already tell search engines to prefer `DOMAIN`.
Preview addresses (`redesign.luistanafranca.pages.dev`) are not affected.

### 5. Point the old GitHub Pages address at the domain

On git's `main`, replace `https://luistanafranca.pages.dev/` with `https://DOMAIN/` in
`index.html` and `404.html` (four links in each, and the link text), commit and push
`main`. Not strictly needed
once step 4 is in place, but it saves a hop.

### 6. PostHog and Search Console **(you)**

1. PostHog: add `https://DOMAIN` to the authorized domains if the project restricts them, open
   `https://DOMAIN/?ph_debug=1` and confirm `$pageview` arrives with the host `DOMAIN`.
2. Search Console: add `DOMAIN` as a Domain property (DNS verification is one click with the
   zone on Cloudflare), submit `https://DOMAIN/sitemap.xml`, and use Change of Address from
   the `pages.dev` property if it was added.
3. Update the link on the resume PDF, LinkedIn and GitHub again.
