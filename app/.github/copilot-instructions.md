<!-- .github/copilot-instructions.md - guidance for AI coding agents working in this Astro blog repo -->
# Copilot instructions for tatteddev-blog (Astro blog)

This project is an Astro-based static blog (Astro v5) using content collections for markdown/MDX and Tailwind/PostCSS for styling. Use these concise, repo-specific rules to make productive, low-risk changes.

High-level architecture
- Routes & pages live under `src/pages/` (e.g. `index.astro`, `pages/blog/index.astro`, `pages/blog/[...slug].astro`).
- Content lives in `src/content/blog/` as Markdown/MDX files; frontmatter (title, description, pubDate, heroImage) is used by layouts.
- Presentational components are in `src/components/` and page layouts in `src/layouts/` (eg `layouts/BlogPost.astro`).
- Static assets (images, fonts) are in `src/assets/` and `public/` (fonts are referenced from `public/fonts/`).

Key developer workflows
- Local development: `npm install` then `npm run dev` (starts Astro dev server on localhost:4321).
- Build: `npm run build` produces `./dist/`; preview with `npm run preview`.
- Tailwind/PostCSS: global styles are in `src/styles/global.css` and use `@tailwind base; @tailwind components; @tailwind utilities;`. When editing CSS, prefer adding tokens in `:root` here.

Project-specific conventions
- Content frontmatter: posts in `src/content/blog/*.md` use fields `title`, `description`, `pubDate`, and `heroImage` (relative path to `src/assets/`). Match existing examples when adding new fields.
- Images: store web-optimized images under `src/assets/` and reference them from content frontmatter (relative imports like `../../assets/blog-placeholder-3.jpg`).
- Fonts: `public/fonts/` contains `atkinson-regular.woff` and `atkinson-bold.woff`; `src/styles/global.css` declares `@font-face` and sets `body { font-family: "Atkinson", sans-serif; }`.
- Styling: this repo uses Tailwind v4 and PostCSS. The global stylesheet is the primary source for non-utility CSS (typography sizes, layout widths). Avoid duplicating rules between components and `global.css`.

Patterns & examples to follow
- Blog post page: `src/pages/blog/[...slug].astro` resolves a collection entry and renders `layouts/BlogPost.astro`. When adding fields to frontmatter, update any TypeScript schema in `src/content.config.ts` if present.
- Reusable head/meta: `src/components/BaseHead.astro` is used across pages for canonical/OpenGraph metadata — update it when changing site-wide meta patterns.
- Date formatting: use `src/components/FormattedDate.astro` rather than inline date parsing to preserve consistent display.

Integration points & dependencies
- Astro (>=5.13), @astrojs/mdx, @astrojs/rss, @astrojs/sitemap are used. Image processing uses `sharp` at build time.
- No server-side runtime; this is a static site built by Astro. Be cautious adding server-only code.

Testing, linting, and safety
- There are no automated tests in the repo by default. Make minimal, well-scoped edits and prefer non-breaking changes.
- Keep changes compatible with Tailwind v4 APIs and PostCSS v8.

When editing files, be conservative
- Keep page routes and content slugs stable to avoid changing URLs. If you must change a slug, update `rss.xml.js` and any internal links.
- Avoid large dependency upgrades in a single PR. If upgrading (Astro, Tailwind), split into a dedicated PR and include a smoke test (`npm run build` + `npm run preview`).

What to include in a PR from an AI agent
- Short description of the change and why it was needed.
- Files changed with a one-line purpose (eg: "added heroImage to frontmatter sample")
- Run results for `npm run build` (pass/fail) if the change touches build/config files.

Files to inspect for future changes
- `package.json` (scripts & deps)
- `src/content/` (content collections)
- `src/pages/` and `src/layouts/` (routing and templates)
- `src/components/` (shared components)
- `src/styles/global.css` (global style tokens and Tailwind entrypoints)

If anything is ambiguous, ask a human: frontmatter schemas, intended URL changes, or dependency upgrades.

---
If you'd like, I can tune this to include example PR templates or populate inferred frontmatter schemas from `src/content.config.ts` next.
