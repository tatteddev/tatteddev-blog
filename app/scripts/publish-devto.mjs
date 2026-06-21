import fs from 'node:fs/promises';
import path from 'node:path';

const BLOG_ROOT = new URL('../', import.meta.url);
const CONTENT_DIR = new URL('../src/content/blog/', import.meta.url);

const args = parseArgs(process.argv.slice(2));

if (!args.url) {
  fail('Usage: npm run crosspost:devto -- --url https://tatteddev.com/blog/post-slug/');
}

const apiKey = process.env.DEVTO_API_KEY;
if (!apiKey) {
  fail('DEVTO_API_KEY is not set in this shell. Set it as a user env var or in the current terminal before running.');
}

const sourceUrl = normalizeSourceUrl(args.url);
const slug = slugFromUrl(sourceUrl);
const localPostPath = path.join(fileURLToPath(CONTENT_DIR), `${slug}.md`);

const [pageMeta, localPost] = await Promise.all([
  fetchPageMeta(sourceUrl),
  readLocalPost(localPostPath),
]);

const title = pageMeta.title ?? localPost.front.title;
const description = pageMeta.description ?? localPost.front.description ?? '';
const canonicalUrl = pageMeta.canonical ?? sourceUrl;
const mainImage = pageMeta.image ?? absolutizeHeroImage(localPost.front.heroImage);
const tags = parseTags(localPost.front.tags).filter(isDevTag).slice(0, 4);
const bodyMarkdown = absolutizeBlogLinks(localPost.body);
const published = args.draft ? false : true;

if (!title || !bodyMarkdown.trim()) {
  fail(`Could not resolve title/body for ${sourceUrl}. Expected local file at ${localPostPath}.`);
}

const payload = {
  article: {
    title,
    published,
    body_markdown: bodyMarkdown,
    tags,
    canonical_url: canonicalUrl,
    description,
  },
};

if (mainImage) {
  payload.article.main_image = mainImage;
}

if (args.dryRun) {
  console.log(JSON.stringify({ dryRun: true, sourceUrl, slug, payload }, null, 2));
} else {
  const existing = await findExistingArticle(title, canonicalUrl);
  const article = existing
    ? await devto('PUT', `/articles/${existing.id}`, payload)
    : await devto('POST', '/articles', payload);

  console.log(JSON.stringify({
    action: existing ? 'updated' : 'created',
    published: article.published,
    title: article.title,
    url: article.url,
    canonical_url: article.canonical_url,
    main_image: mainImage,
    tags,
  }, null, 2));
}

function parseArgs(argv) {
  const parsed = { draft: false, dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--url') parsed.url = argv[++index];
    else if (arg === '--draft') parsed.draft = true;
    else if (arg === '--dry-run') parsed.dryRun = true;
    else if (arg === '--help' || arg === '-h') parsed.help = true;
    else fail(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function normalizeSourceUrl(value) {
  const url = new URL(value);
  if (!url.pathname.endsWith('/')) {
    url.pathname = `${url.pathname}/`;
  }
  return url.toString();
}

function slugFromUrl(value) {
  const url = new URL(value);
  const parts = url.pathname.split('/').filter(Boolean);
  const slug = parts.at(-1);
  if (!slug) fail(`Could not infer slug from URL: ${value}`);
  return slug;
}

async function fetchPageMeta(url) {
  const response = await fetch(url);
  if (!response.ok) {
    fail(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();
  return {
    canonical: getLink(html, 'canonical'),
    title: getMeta(html, 'property', 'og:title') ?? getMeta(html, 'name', 'title') ?? getTitle(html),
    description: getMeta(html, 'property', 'og:description') ?? getMeta(html, 'name', 'description'),
    image: getMeta(html, 'property', 'og:image'),
  };
}

async function readLocalPost(postPath) {
  let raw;
  try {
    raw = await fs.readFile(postPath, 'utf8');
  } catch (error) {
    fail(`Could not read local post ${postPath}: ${error.message}`);
  }

  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    fail(`Local post has no front matter: ${postPath}`);
  }

  const front = {};
  for (const line of match[1].split(/\r?\n/)) {
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim();
    let value = line.slice(colon + 1).trim();
    if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
      value = value.slice(1, -1);
    }
    front[key] = value;
  }

  return { front, body: match[2].trimStart() };
}

function parseTags(value) {
  if (!value) return [];
  return Array.from(value.matchAll(/'([^']+)'|"([^"]+)"|([a-zA-Z0-9_-]+)/g))
    .map((match) => match[1] ?? match[2] ?? match[3])
    .filter((tag) => !['tags'].includes(tag));
}

function isDevTag(value) {
  return /^[a-zA-Z0-9]+$/.test(value);
}

function absolutizeBlogLinks(markdown) {
  return markdown.replace(/\]\(\/blog\/([^)]+)\)/g, '](https://tatteddev.com/blog/$1)');
}

function absolutizeHeroImage(heroImage) {
  if (!heroImage || /^https?:\/\//i.test(heroImage)) return heroImage;
  const normalized = heroImage.replace(/^\.\.\/\.\.\/assets\//, '');
  return normalized ? `https://tatteddev.com/assets/${normalized}` : undefined;
}

async function findExistingArticle(title, canonicalUrl) {
  const articles = await devto('GET', '/articles/me/all?per_page=1000');
  return articles.find((article) => article.title === title || article.canonical_url === canonicalUrl);
}

async function devto(method, endpoint, body) {
  const response = await fetch(`https://dev.to/api${endpoint}`, {
    method,
    headers: {
      'api-key': apiKey,
      accept: 'application/vnd.forem.api-v1+json',
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const data = text ? safeJson(text) : null;
  if (!response.ok) {
    fail(`${method} ${endpoint} failed: ${response.status} ${text}`);
  }
  return data;
}

function getMeta(html, attr, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<meta\\b(?=[^>]*\\b${attr}=["']${escaped}["'])(?=[^>]*\\bcontent=["']([^"']*)["'])[^>]*>`, 'i');
  return decodeHtml(html.match(pattern)?.[1]);
}

function getLink(html, rel) {
  const escaped = rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<link\\b(?=[^>]*\\brel=["']${escaped}["'])(?=[^>]*\\bhref=["']([^"']*)["'])[^>]*>`, 'i');
  return decodeHtml(html.match(pattern)?.[1]);
}

function getTitle(html) {
  return decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim());
}

function decodeHtml(value) {
  if (!value) return undefined;
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function fileURLToPath(url) {
  return decodeURIComponent(url.pathname.replace(/^\/([A-Za-z]:)/, '$1'));
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
