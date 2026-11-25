/**
 * Jednorazowy import treści z WordPressa (kamilwnek.pl) do Astro.
 *
 *   node scripts/import-wp.mjs            – import (z cache odpowiedzi HTTP)
 *   node scripts/import-wp.mjs --fresh    – pobierz wszystko od nowa
 *
 * Co robi:
 *  - pobiera strony, wpisy, kategorie i media z REST API (/wp-json/wp/v2),
 *  - z wyrenderowanego HTML każdej podstrony czyta meta Rank Math (title, description, robots, og),
 *  - ściąga oryginały obrazków do src/assets/images/wp/RRRR/MM/ (Astro je optymalizuje),
 *  - konwertuje treść Gutenberga/Stackable do Markdown (FAQ → frontmatter, przyciski → .cta),
 *  - zapisuje: src/content/{oferta,blog,strony}/*.md, src/content/kategorie.json,
 *    src/data/page-seo.json, src/data/wp-media.json (mapa do przekierowań obrazków).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import YAML from 'yaml';
import { slugify } from '../src/lib/slugify.mjs';

const BASE = 'https://kamilwnek.pl';
const ROOT = process.cwd();
const CACHE_DIR = path.join(ROOT, 'node_modules/.cache/wp-import');

const FRESH = process.argv.includes('--fresh');
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; site-migration)' };

/* ───────────────────────── HTTP z cache ───────────────────────── */

async function fetchCached(url, { binary = false } = {}) {
  const key = crypto.createHash('md5').update(url).digest('hex');
  const file = path.join(CACHE_DIR, key + (binary ? '.bin' : '.txt'));
  if (!FRESH) {
    try {
      return binary ? await fs.readFile(file) : await fs.readFile(file, 'utf8');
    } catch {}
  }
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const body = binary ? Buffer.from(await res.arrayBuffer()) : await res.text();
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(file, body);
  return body;
}
const api = async (endpoint) => JSON.parse(await fetchCached(`${BASE}/wp-json/wp/v2/${endpoint}`));
const decode = (html) => cheerio.load(`<i>${html ?? ''}</i>`)('i').text().trim();

/* ───────────────────────── SEO z <head> ───────────────────────── */

async function readSeo(url) {
  const $ = cheerio.load(await fetchCached(url));
  const meta = (sel) => $(sel).attr('content')?.trim() || undefined;
  return {
    title: $('title').first().text().trim(),
    description: meta('meta[name="description"]'),
    robots: meta('meta[name="robots"]'),
    ogTitle: meta('meta[property="og:title"]'),
    ogImage: meta('meta[property="og:image"]'),
  };
}

/* ───────────────────────── Obrazki ───────────────────────── */

const media = await api('media?per_page=100');
const mediaByKey = new Map();
/** '/wp-content/uploads/2025/12/IMG_3829-1024x683.jpg' → { key: '2025/12/IMG_3829', ext: 'jpg' } */
function uploadKey(url) {
  const m = new URL(url, BASE).pathname.match(/^\/wp-content\/uploads\/(\d{4}\/\d{2})\/(.+?)(?:-\d+x\d+|-scaled)*\.(\w+)$/);
  return m ? { key: `${m[1]}/${m[2]}`, ext: m[3].toLowerCase() } : null;
}
for (const item of media) {
  const k = uploadKey(item.source_url);
  if (k) mediaByKey.set(k.key, item);
}

const manifest = new Map(); // key → { oldPath, ext, file }
/** Pobiera oryginał obrazka i zwraca ścieżkę absolutną pliku lokalnego. */
async function localImage(url) {
  const k = uploadKey(url);
  if (!k) return null;
  if (manifest.has(k.key)) return path.join(ROOT, manifest.get(k.key).file);
  const item = mediaByKey.get(k.key);
  const source = item?.source_url ?? new URL(url, BASE).href.replace(/-\d+x\d+(?=\.\w+$)/, '');
  const ext = k.ext === 'jpeg' ? 'jpg' : k.ext;
  const rel = `src/assets/images/wp/${k.key}.${ext}`;
  const abs = path.join(ROOT, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, await fetchCached(source, { binary: true }));
  manifest.set(k.key, { oldPath: `/wp-content/uploads/${k.key}`, ext: k.ext, file: rel });
  return abs;
}
const relFrom = (fromFile, abs) => path.relative(path.dirname(fromFile), abs).split(path.sep).join('/');

/* ───────────────────────── HTML → Markdown ───────────────────────── */

const td = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '_',
  strongDelimiter: '**',
});
td.use(gfm);
// "<" w zwykłym tekście (np. „sekcja <head>”) nie może stać się surowym HTML-em
const baseEscape = td.escape.bind(td);
td.escape = (s) => baseEscape(s).replace(/</g, '&lt;');
td.addRule('cta', {
  filter: (node) => node.nodeName === 'P' && node.getAttribute('data-cta') !== null,
  replacement: (_c, node) => {
    const links = Array.from(node.getElementsByTagName('a'))
      .map((a) => `<a class="btn" href="${a.getAttribute('href')}">${a.textContent.trim()}</a>`)
      .join(' ');
    return `\n\n<p class="cta">${links}</p>\n\n`;
  },
});
/** Bloki wstawiane do Markdown jako gotowy HTML (np. FAQ w treści wpisu) */
const rawBlocks = new Map();
td.addRule('raw', {
  filter: (node) => node.nodeName === 'DIV' && node.getAttribute('data-raw') !== null,
  replacement: (_c, node) => `\n\n${rawBlocks.get(node.getAttribute('data-raw'))}\n\n`,
});
td.addRule('figcaption', {
  filter: 'figcaption',
  replacement: (content) => `\n\n_${content.trim()}_\n\n`,
});

const KEEP_UPPER = ['SEO', 'AI', 'URL', 'CMS', 'GA4'];
function sentenceCase(text) {
  const t = text.trim();
  if (t !== t.toUpperCase()) return t.charAt(0).toUpperCase() + t.slice(1); // normalna pisownia – tylko wielka pierwsza litera
  let out = t.toLowerCase();
  for (const w of KEEP_UPPER) out = out.replace(new RegExp(`(?<![\\p{L}])${w.toLowerCase()}(?![\\p{L}])`, 'gu'), w);
  return out.charAt(0).toUpperCase() + out.slice(1);
}

function normalizeHref(href) {
  if (!href) return href;
  let h = href.replace(/^https?:\/\/(www\.)?kamilwnek\.pl/i, '') || '/';
  h = h.replace(/^\/blog\/k\//, '/blog/'); // kategorie: /blog/k/<id>/ → /blog/<id>/
  if (h.startsWith('/') && !h.startsWith('/wp-content/')) {
    const [p, rest = ''] = h.split(/(?=[?#])/);
    if (!p.endsWith('/') && !/\.\w{2,5}$/.test(p)) h = p + '/' + rest;
  }
  return h;
}

/**
 * Przetwarza HTML treści. Zwraca { markdown, faq, faqTitle, whyMe, intro, eyebrow, hasForm }.
 */
async function convert(html, mdFile, { pageMode = false, faqInline = false } = {}) {
  const $ = cheerio.load(html, null, false);
  const result = { faq: [], faqTitle: undefined, whyMe: false, intro: undefined, eyebrow: undefined, hasForm: false };

  // Kotwice spisu treści: stare id nagłówków WP → slug ASCII (taki sam nada rehype-heading-ids)
  const anchorMap = new Map();
  $('h2[id], h3[id], h4[id]').each((_, h) => anchorMap.set($(h).attr('id'), slugify($(h).text())));
  $('a[href^="#"]').each((_, a) => {
    const id = $(a).attr('href').slice(1);
    if (anchorMap.has(id)) $(a).attr('href', `#${anchorMap.get(id)}`);
  });

  $('style, script, noscript, nav.rank-math-breadcrumb, .wp-block-spacer').remove();
  $('ul.wp-block-social-links, .wp-block-stackable-posts').remove();

  // Wspólny blok „Dlaczego warto ze mną współpracować?” → komponent <WhyMe />
  $('h2').each((_, el) => {
    if (/Dlaczego warto ze mną współpracować/i.test($(el).text())) {
      const block = $(el).closest('article');
      (block.parent().children().length === 1 ? block.parent() : block).remove();
      result.whyMe = true;
    }
  });

  // FAQ Rank Math → frontmatter (dane do schema) + opcjonalnie HTML w miejscu bloku
  for (const el of $('.rank-math-block').toArray()) {
    const block = $(el);
    const items = [];
    for (const item of block.find('.rank-math-list-item').toArray()) {
      const answer = $(item).find('.rank-math-answer');
      answer.find('a[href]').each((_, a) => {
        $(a).attr('href', normalizeHref($(a).attr('href')));
      });
      answer.find('*').removeAttr('class style');
      items.push({
        id: $(item).attr('id') || undefined, // spisy treści linkują do #faq-question-…
        question: $(item).find('.rank-math-question').text().trim(),
        answer: (answer.html() ?? '').replace(/ /g, ' ').replace(/\n+/g, ' ').trim(),
      });
    }
    result.faq.push(...items);
    if (faqInline) {
      const html =
        '<div class="faq">' +
        items
          .map(
            (i) =>
              `<details class="faq__item"${i.id ? ` id="${i.id}"` : ''}><summary class="faq__q">${i.question}</summary><div class="faq__a">${i.answer}</div></details>`,
          )
          .join('') +
        '</div>';
      const key = `raw-${rawBlocks.size}`;
      rawBlocks.set(key, html);
      block.replaceWith(`<div data-raw="${key}">.</div>`);
      continue;
    }
    const prev = block.prev();
    if (prev.is('h2') && /pytan|faq/i.test(prev.text())) {
      result.faqTitle = prev.text().trim();
      prev.remove();
    }
    block.remove();
  }

  // Hero z formularzem (strony usług): pierwsza kolumna → intro
  const formCols = $('.wp-block-columns')
    .filter((_, el) => $(el).find('.wp-block-contact-form-7-contact-form-selector').length > 0)
    .first();
  if (formCols.length) {
    result.hasForm = true;
    const first = formCols.children('.wp-block-column').first();
    first.find('h1').remove();
    result.intro = await convertFragment($, first, mdFile);
    formCols.remove();
  }
  $('.wp-block-contact-form-7-contact-form-selector, form').remove();

  if (pageMode) {
    const h1 = $('h1').first();
    const eyebrow = h1.prevAll('p').filter((_, p) => $(p).children('strong').length > 0).first();
    if (eyebrow.length) {
      result.eyebrow = eyebrow.text().trim();
      eyebrow.remove();
    }
    h1.remove();
  }

  result.markdown = await convertFragment($, $.root(), mdFile);
  return result;
}

async function convertFragment($, root, mdFile) {
  // Przyciski Stackable → <p data-cta>
  for (const group of root.find('.wp-block-stackable-button-group').toArray()) {
    const links = $(group)
      .find('a[href]')
      .toArray()
      .map((a) => `<a href="${normalizeHref($(a).attr('href'))}">${sentenceCase($(a).text())}</a>`);
    $(group).replaceWith(`<p data-cta>${links.join('')}</p>`);
  }
  // Linki
  root.find('a[href]').each((_, a) => {
    $(a).attr('href', normalizeHref($(a).attr('href')));
  });
  // Obrazki → lokalne pliki (+ zdjęcie zamiast linku do pliku)
  for (const img of root.find('img').toArray()) {
    const $img = $(img);
    const src = $img.attr('data-src') || $img.attr('src');
    const abs = src ? await localImage(src) : null;
    if (abs) $img.attr('src', relFrom(mdFile, abs));
    $img.removeAttr('srcset sizes width height class decoding loading data-src');
    const parentLink = $img.parent('a');
    if (parentLink.length && /\/wp-content\/uploads\//.test(parentLink.attr('href') ?? '')) parentLink.replaceWith($img);
  }
  // Tabele bez <thead>: pierwszy wiersz → nagłówek (GFM)
  root.find('table').each((_, t) => {
    const $t = $(t);
    if ($t.find('thead').length) return;
    const first = $t.find('tr').first();
    const cells = first
      .children('td,th')
      .toArray()
      .map((c) => `<th>${$(c).text().trim()}</th>`)
      .join('');
    first.remove();
    $t.prepend(`<thead><tr>${cells}</tr></thead>`);
  });

  const html = (root.is ? (root.html() ?? '') : '').replace(/ /g, ' ');
  return td
    .turndown(html)
    .replace(/^(\s*)(-|\d+\.) {2,}/gm, '$1$2 ') // "-   tekst" → "- tekst"
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ───────────────────────── Zapis ───────────────────────── */

async function writeMd(file, data, body) {
  const fm = YAML.stringify(
    Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0))),
    { lineWidth: 0 },
  );
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `---\n${fm}---\n\n${body.trim()}\n`);
  console.log('✓', path.relative(ROOT, file));
}
async function readFrontmatter(file) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return YAML.parse(raw.split(/^---$/m)[1]) ?? {};
  } catch {
    return {};
  }
}
const isoDate = (d) => d.slice(0, 10);

/* ───────────────────────── Import ───────────────────────── */

const [pages, posts, categories] = await Promise.all([
  api('pages?per_page=100'),
  api('posts?per_page=100'),
  api('categories?per_page=100'),
]);
const offerPage = pages.find((p) => p.slug === 'oferta');

// Krótkie opisy usług z /oferta/ (karty)
const cardDescriptions = {};
{
  const $ = cheerio.load(offerPage.content.rendered);
  $('.stk-block-column').each((_, col) => {
    const href = $(col).find('a[href*="/oferta/"]').attr('href');
    const slug = href?.match(/\/oferta\/([^/]+)/)?.[1];
    if (slug) cardDescriptions[slug] = $(col).find('.stk-block-text__text').text().trim();
  });
}

// 1. Kategorie
const catSlugById = new Map(categories.map((c) => [c.id, c.slug]));
const kategorie = [];
for (const c of categories) {
  const seo = await readSeo(`${BASE}/blog/k/${c.slug}/`).catch(() => ({}));
  kategorie.push({
    id: c.slug,
    name: decode(c.name),
    description: decode(c.description) || undefined,
    seoTitle: seo.title,
    seoDescription: seo.description,
    noindex: seo.robots?.includes('noindex') || undefined,
  });
}
await fs.writeFile(path.join(ROOT, 'src/content/kategorie.json'), JSON.stringify(kategorie, null, 2) + '\n');
console.log('✓ src/content/kategorie.json');

// 2. Usługi
for (const p of pages.filter((p) => p.parent === offerPage.id)) {
  const file = path.join(ROOT, `src/content/oferta/${p.slug}.md`);
  const existing = await readFrontmatter(file);
  const seo = await readSeo(p.link);
  const c = await convert(p.content.rendered, file);
  await writeMd(
    file,
    {
      title: decode(p.title.rendered),
      seoTitle: seo.title,
      description: seo.description,
      group: existing.group,
      menuDescription: existing.menuDescription,
      cardDescription: cardDescriptions[p.slug],
      order: existing.order,
      icon: existing.icon,
      pubDate: isoDate(p.date),
      updatedDate: isoDate(p.modified),
      intro: c.intro,
      whyMe: c.whyMe || undefined,
      faqTitle: c.faqTitle,
      faq: c.faq,
    },
    c.markdown,
  );
}

// 3. Wpisy
for (const p of posts) {
  const file = path.join(ROOT, `src/content/blog/${p.slug}.md`);
  const seo = await readSeo(p.link);
  const c = await convert(p.content.rendered, file, { faqInline: true });
  const cover = media.find((m) => m.id === p.featured_media);
  const coverAbs = cover ? await localImage(cover.source_url) : null;
  await writeMd(
    file,
    {
      title: decode(p.title.rendered),
      seoTitle: seo.title,
      description: seo.description,
      pubDate: `${p.date_gmt}Z`,
      updatedDate: `${p.modified_gmt}Z`,
      categories: p.categories.map((id) => catSlugById.get(id)).filter(Boolean),
      cover: coverAbs ? relFrom(file, coverAbs) : undefined,
      coverAlt: cover ? decode(cover.alt_text) : undefined,
      whyMe: c.whyMe || undefined,
      faqTitle: c.faqTitle,
      faq: c.faq,
    },
    c.markdown,
  );
}

// 4. Strony treściowe (o-mnie, polityka prywatności)
for (const slug of ['o-mnie', 'polityka-prywatnosci']) {
  const p = pages.find((x) => x.slug === slug);
  const file = path.join(ROOT, `src/content/strony/${slug}.md`);
  const seo = await readSeo(p.link);
  const c = await convert(p.content.rendered, file, { pageMode: true, faqInline: true });
  const h1 = cheerio.load(p.content.rendered)('h1').first().text().trim();
  await writeMd(
    file,
    {
      title: h1 || decode(p.title.rendered),
      seoTitle: seo.title,
      description: seo.description,
      eyebrow: c.eyebrow,
      pubDate: isoDate(p.date),
      updatedDate: isoDate(p.modified),
      noindex: seo.robots?.includes('noindex') || undefined,
      faqTitle: c.faqTitle,
      faq: c.faq,
    },
    c.markdown,
  );
}

// 5. SEO stron budowanych ręcznie + obrazki z nich
const pageSeo = {};
for (const p of ['/', '/oferta/', '/kontakt/', '/blog/']) pageSeo[p] = await readSeo(BASE + p);
await fs.mkdir(path.join(ROOT, 'src/data'), { recursive: true });
await fs.writeFile(path.join(ROOT, 'src/data/page-seo.json'), JSON.stringify(pageSeo, null, 2) + '\n');
console.log('✓ src/data/page-seo.json');

// Wszystkie pozostałe obrazki z biblioteki mediów (logotypy klientów, zdjęcia na stronie głównej itd.)
for (const m of media) await localImage(m.source_url);

await fs.writeFile(
  path.join(ROOT, 'src/data/wp-media.json'),
  JSON.stringify([...manifest.values()].sort((a, b) => a.oldPath.localeCompare(b.oldPath)), null, 2) + '\n',
);
console.log(`✓ src/data/wp-media.json (${manifest.size} obrazków)`);
