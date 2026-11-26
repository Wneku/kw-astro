/**
 * Sitemapy w układzie jak z Rank Math (te same adresy, które zna już Google Search Console):
 *
 *   /sitemap_index.xml     → spis map
 *   /post-sitemap.xml      → /blog/ + wpisy (z okładką jako image:image)
 *   /page-sitemap.xml      → strona główna, strony, oferta, kontakt
 *   /category-sitemap.xml  → kategorie bloga (bez noindex i pustych)
 *
 * W mapach są tylko strony indeksowalne. Po buildzie integracja src/integrations/sitemap-check.mjs
 * sprawdza, czy żadna strona nie została pominięta i czy każdy adres istnieje.
 */
import { getCollection } from 'astro:content';
import { getImage } from 'astro:assets';
import { getPosts, postHref, categoryHref } from './blog';

export type SitemapUrl = { loc: string; lastmod?: Date; images?: string[] };
export type SitemapName = 'post' | 'page' | 'category';
export const SITEMAPS: SitemapName[] = ['post', 'page', 'category'];

const contentDate = (d: { updatedDate?: Date; pubDate?: Date }) => d.updatedDate ?? d.pubDate;
const newest = (dates: (Date | undefined)[]) => {
  const valid = dates.filter((d): d is Date => d instanceof Date);
  return valid.length ? new Date(Math.max(...valid.map((d) => d.valueOf()))) : undefined;
};

async function posts(): Promise<SitemapUrl[]> {
  const list = (await getPosts()).filter((p) => !p.data.draft);
  const items = await Promise.all(
    list.map(async (p) => ({
      loc: postHref(p.id),
      lastmod: contentDate(p.data),
      // ten sam plik co og:image wpisu (Seo.astro) – bez generowania dodatkowych wersji
      images: p.data.cover ? [(await getImage({ src: p.data.cover, width: 1200, format: 'jpg', quality: 82 })).src] : [],
    })),
  );
  return [{ loc: '/blog/', lastmod: newest(items.map((i) => i.lastmod)) }, ...items];
}

async function pages(): Promise<SitemapUrl[]> {
  const [strony, oferta, blog] = await Promise.all([
    getCollection('strony', ({ data }) => !data.noindex),
    getCollection('oferta', ({ data }) => !data.draft),
    getPosts(),
  ]);
  const services = oferta
    .sort((a, b) => a.data.order - b.data.order)
    .map((s) => ({ loc: `/oferta/${s.id}/`, lastmod: contentDate(s.data) }));
  const contentPages = strony.map((p) => ({ loc: `/${p.id}/`, lastmod: contentDate(p.data) }));
  const servicesDate = newest(services.map((s) => s.lastmod));
  return [
    // strona główna pokazuje usługi i najnowsze wpisy
    { loc: '/', lastmod: newest([servicesDate, ...blog.filter((p) => !p.data.draft).map((p) => contentDate(p.data))]) },
    ...contentPages,
    { loc: '/oferta/', lastmod: servicesDate },
    ...services,
    { loc: '/kontakt/' },
  ];
}

async function categories(): Promise<SitemapUrl[]> {
  const [cats, list] = await Promise.all([getCollection('kategorie'), getPosts()]);
  return cats.flatMap((c) => {
    const inCat = list.filter((p) => !p.data.draft && p.data.categories.some((r) => r.id === c.id));
    // pusta kategoria też dostaje noindex (lib/listing.ts)
    if (c.data.noindex || !inCat.length) return [];
    return [{ loc: categoryHref(c.id), lastmod: newest(inCat.map((p) => contentDate(p.data))) }];
  });
}

export const sitemapUrls: Record<SitemapName, () => Promise<SitemapUrl[]>> = { post: posts, page: pages, category: categories };

// ── XML ──────────────────────────────────────────────────────────────────────

const xmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, '+00:00');
const abs = (path: string, site: URL) => xmlEsc(new URL(path, site).href);
const HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>\n';

const xmlResponse = (body: string) => new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });

export async function sitemapResponse(name: SitemapName, site: URL) {
  const urls = await sitemapUrls[name]();
  const body = urls
    .map(
      (u) =>
        `  <url>\n    <loc>${abs(u.loc, site)}</loc>\n` +
        (u.lastmod ? `    <lastmod>${iso(u.lastmod)}</lastmod>\n` : '') +
        (u.images ?? []).map((img) => `    <image:image>\n      <image:loc>${abs(img, site)}</image:loc>\n    </image:image>\n`).join('') +
        `  </url>\n`,
    )
    .join('');
  return xmlResponse(
    `${HEAD}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${body}</urlset>\n`,
  );
}

export async function sitemapIndexResponse(site: URL) {
  const entries = await Promise.all(
    SITEMAPS.map(async (name) => ({ name, lastmod: newest((await sitemapUrls[name]()).map((u) => u.lastmod)) })),
  );
  const body = entries
    .map(
      (e) =>
        `  <sitemap>\n    <loc>${abs(`/${e.name}-sitemap.xml`, site)}</loc>\n` +
        (e.lastmod ? `    <lastmod>${iso(e.lastmod)}</lastmod>\n` : '') +
        `  </sitemap>\n`,
    )
    .join('');
  return xmlResponse(`${HEAD}<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}</sitemapindex>\n`);
}
