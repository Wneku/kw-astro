/**
 * Porównuje zbudowaną stronę (dist/) z obecnym WordPressem.
 *   npm run build && node scripts/verify-migration.mjs
 *
 * Sprawdza:
 *  1. każdy URL ze starej sitemapy istnieje w dist/,
 *  2. title, meta description, canonical, robots (index/noindex) i H1 są takie same,
 *  3. wszystkie linki wewnętrzne i kotwice (#…) w dist/ prowadzą do istniejących stron/elementów,
 *  4. liczba słów treści nie spadła (wykrywa zgubione fragmenty).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';

const BASE = 'https://kamilwnek.pl';
const DIST = path.resolve('dist');
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; site-migration)' };
const problems = [];
const warn = (url, msg) => problems.push(`${url}  →  ${msg}`);

const fetchText = async (url) => (await fetch(url, { headers: HEADERS })).text();
const distFile = (pathname) => path.join(DIST, decodeURI(pathname), pathname.endsWith('/') ? 'index.html' : '');
const norm = (s = '') => s.replace(/\s+/g, ' ').replace(/[–—]/g, '-').trim();


async function oldUrls() {
  const index = cheerio.load(await fetchText(`${BASE}/sitemap_index.xml`), { xml: true });
  const urls = [];
  for (const loc of index('sitemap > loc').toArray().map((l) => index(l).text())) {
    const sm = cheerio.load(await fetchText(loc), { xml: true });
    urls.push(...sm('url > loc').toArray().map((l) => sm(l).text()));
  }
  return urls;
}

function seoOf($) {
  return {
    title: norm($('title').first().text()),
    description: norm($('meta[name="description"]').attr('content')),
    canonical: $('link[rel="canonical"]').attr('href'),
    noindex: /noindex/.test($('meta[name="robots"]').attr('content') ?? ''),
    h1: norm($('h1').first().text()),
  };
}

// 1–2, 4: porównanie stron
const urls = await oldUrls();
console.log(`Stara sitemapa: ${urls.length} adresów\n`);
for (const url of urls) {
  // kategorie przeniesione z /blog/k/<id>/ na /blog/<id>/ (301 w .htaccess)
  const pathname = new URL(url).pathname.replace(/^\/blog\/k\//, '/blog/');
  let html;
  try {
    html = await fs.readFile(distFile(pathname), 'utf8');
  } catch {
    warn(pathname, 'BRAK STRONY w dist/');
    continue;
  }
  const $old = cheerio.load(await fetchText(url));
  const $new = cheerio.load(html);
  const a = seoOf($old);
  const b = seoOf($new);
  for (const key of ['title', 'description', 'canonical', 'noindex', 'h1']) {
    // WordPress nie dawał canonicala na stronach noindex – u nas jest (to poprawne)
    if (key === 'canonical' && a.noindex && !a.canonical) continue;
    // canonical kategorii zmienił się razem z adresem
    if (key === 'canonical' && a.canonical?.replace('/blog/k/', '/blog/') === b.canonical) continue;
    if (String(a[key]) !== String(b[key])) warn(pathname, `${key}: "${a[key]}" ≠ "${b[key]}"`);
  }
  // Każdy akapit / punkt listy / komórka tabeli ze starej treści musi być na nowej stronie
  $old('script, style, noscript, form').remove();
  $new('script, style, noscript').remove();
  const newText = norm($new('main').text());
  const blocks = $old('.entry-content')
    .find('p, li, h2, h3, h4, td, th, figcaption, blockquote')
    .toArray()
    .filter((e) => $old(e).closest('.stk-block-posts, .wp-block-social-links, .rank-math-breadcrumb').length === 0)
    // zagnieżdżone listy sprawdzamy osobno – bierzemy tylko „własny” tekst elementu
    .map((e) => norm($old(e).clone().children('ul, ol, .rank-math-answer').remove().end().text()))
    .filter((t) => t.length > 3);
  for (const t of new Set(blocks)) {
    if (!newText.includes(t)) warn(pathname, `brak tekstu: "${t.slice(0, 110)}${t.length > 110 ? '…' : ''}"`);
  }
}

// 3: linki i kotwice w dist/
async function* htmlFiles(dir) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* htmlFiles(p);
    else if (e.name.endsWith('.html')) yield p;
  }
}
const pages = new Map();
for await (const file of htmlFiles(DIST)) {
  const rel = '/' + path.relative(DIST, file).split(path.sep).join('/').replace(/index\.html$/, '');
  pages.set(rel, cheerio.load(await fs.readFile(file, 'utf8')));
}
for (const [from, $] of pages) {
  for (const a of $('a[href]').toArray()) {
    const href = $(a).attr('href');
    if (/^(mailto:|tel:|https?:\/\/(?!kamilwnek\.pl))/.test(href)) continue;
    const u = new URL(href, BASE + from);
    if (u.origin !== BASE) continue;
    if (/\.(xml|txt|webp|png|jpe?g|svg|pdf)$/.test(u.pathname)) continue;
    const target = pages.get(u.pathname);
    if (!target) {
      warn(from, `zepsuty link: ${href}`);
      continue;
    }
    if (u.hash && target(`[id="${decodeURIComponent(u.hash.slice(1))}"]`).length === 0) {
      warn(from, `brak kotwicy: ${href}`);
    }
  }
}

console.log(problems.length ? problems.join('\n') : '✓ Brak różnic.');
console.log(`\nSprawdzono ${urls.length} adresów i ${pages.size} plików HTML. Problemy: ${problems.length}`);
process.exitCode = problems.length ? 1 : 0;
