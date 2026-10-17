# tatteddev-blog
Personal blog for TattedDev. Astro 5 static site in `app/`, served from Cloudflare Workers static assets.

## Hosting

- Worker name `tatteddev-blog`, configured in `app/wrangler.jsonc`. It serves `app/dist` as static assets with `not_found_handling: "404-page"` and custom domains `tatteddev.com` and `www.tatteddev.com`.
- Cloudflare Workers Builds builds and deploys the Worker from this repository on every push to `main`, the same way olegnovoselskyy.com is deployed. There is no GitHub Actions workflow and no deploy secret in this repository; Cloudflare holds the GitHub connection.
- `npm run deploy` in `app/` builds and deploys from a machine logged in with `npx wrangler login`. Use it only for an emergency; Workers Builds is the normal path.

## Cutover from Vercel

Do these in order. The site keeps serving from Vercel until step 3.

1. **Connect the repository to Workers Builds.** In the Cloudflare dashboard open Compute (Workers & Pages), choose Create, then Import a repository, and pick `tatteddev/tatteddev-blog`. Set root directory `app`, build command `npm run build`, deploy command `npx wrangler deploy`, production branch `main`, and turn preview builds off. Save and deploy. Workers Builds runs the build, then `wrangler deploy` creates the Worker from `app/wrangler.jsonc` and attaches the two custom domains. If the custom-domain step fails because of the existing Vercel records, do step 2 first and retry the deployment.
2. **Confirm the custom domains.** Open the Worker (Compute → `tatteddev-blog` → Settings → Domains & Routes) and wait until `tatteddev.com` and `www.tatteddev.com` show as active. Cloudflare manages the proxied DNS records and the certificate for custom domains itself.
3. **Move DNS off Vercel and remove the Vercel project.** In the `tatteddev.com` zone, open the DNS tab and delete the old Vercel records: the `A` record for `@` (`76.76.21.21`) and the `CNAME` for `www` (`cname.vercel-dns.com`), or whatever Vercel issued. Then in the Vercel dashboard remove both domains from the project and delete the project, so Vercel stops building the repository and the domains cannot flip back. Check `https://tatteddev.com/`, `https://www.tatteddev.com/`, `https://tatteddev.com/rss.xml` and a missing path such as `https://tatteddev.com/nope` (expect a 404).

Rollback before step 3: detach the custom domains from the Worker and the Vercel records take over again. After step 3, rollback means recreating the Vercel project and its `A` and `CNAME` records.

## Known gaps

- The site has no `404.astro` page yet, so the Worker answers missing paths with an empty 404 body. Adding `app/src/pages/404.astro` makes `not_found_handling: "404-page"` serve a real page; no Worker change is needed.
