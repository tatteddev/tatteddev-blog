# tatteddev-blog
Personal blog for TattedDev. Astro 5 static site in `app/`, served from Cloudflare Workers static assets.

## Hosting

- Worker name `tatteddev-blog`, configured in `app/wrangler.jsonc`. It serves `app/dist` as static assets with `not_found_handling: "404-page"` and custom domains `tatteddev.com` and `www.tatteddev.com`.
- `.github/workflows/deploy.yml` builds on every pull request and builds then deploys on every push to `main` (and on manual dispatch). The deploy step needs a repository secret `CLOUDFLARE_API_TOKEN`: a Cloudflare API token made from the **Edit Cloudflare Workers** template, scoped to this account and the `tatteddev.com` zone. If the first deploy is refused while attaching the custom domains, add **Zone: DNS: Edit** for that zone to the token. The account id is committed in `wrangler.jsonc`, so no account secret is needed.
- `npm run deploy` in `app/` builds and deploys from a machine logged in with `npx wrangler login`. Use it only for the first manual deploy or an emergency; the workflow is the normal path.

## Cutover from Vercel

Do these in order. Each step is safe to stop after; the site keeps serving from Vercel until step 3.

1. **Deploy the Worker.** Add the `CLOUDFLARE_API_TOKEN` secret, merge this change to `main`, and watch the "Build and deploy tatteddev.com" workflow finish. Alternatively run `npm run deploy` in `app/`. Wrangler creates the Worker and attaches the two custom domains. Custom-domain attachment needs the hostnames to be free of conflicting DNS records, so if the deploy fails on the route step, do step 2 first and rerun the deploy.
2. **Move DNS in Cloudflare.** In the Cloudflare dashboard for the `tatteddev.com` zone, open DNS and delete the records that point at Vercel: the `A` record for `@` (`76.76.21.21`) and the `CNAME` for `www` (`cname.vercel-dns.com`), or whatever Vercel issued. Then open the Worker (Workers & Pages → `tatteddev-blog` → Settings → Domains & Routes) and confirm `tatteddev.com` and `www.tatteddev.com` show as active custom domains. Cloudflare manages the proxied DNS records and the certificate for custom domains itself. Check `https://tatteddev.com/`, `https://www.tatteddev.com/`, `https://tatteddev.com/rss.xml` and a missing path such as `https://tatteddev.com/nope` (expect a 404) once the records propagate.
3. **Remove the project from Vercel.** In the Vercel dashboard, remove both domains from the project and then delete the project, so Vercel stops building the repository and the domains cannot flip back. Revoke the Vercel GitHub app's access to this repository if nothing else uses it.

Rollback before step 3: recreate the Vercel `A` and `CNAME` records and detach the custom domains from the Worker. After step 3, rollback means redeploying to Vercel from the repository.

## Known gaps

- The site has no `404.astro` page yet, so the Worker answers missing paths with an empty 404 body. Adding `app/src/pages/404.astro` makes `not_found_handling: "404-page"` serve a real page; no Worker change is needed.
