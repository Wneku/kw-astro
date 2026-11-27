/**
 * Kontrola sitemap po buildzie (src/lib/sitemap.ts):
 *  - błąd, gdy adres z mapy nie istnieje w dist/ albo ma noindex,
 *  - ostrzeżenie, gdy strona indeksowalna nie trafiła do żadnej mapy (np. nowa podstrona .astro).
 * Paginacja (/page/2/ itd.) celowo jest poza mapami – jak w Rank Math.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MAPS = ['post-sitemap.xml', 'page-sitemap.xml', 'category-sitemap.xml'];
const isNoindex = (html) => /<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html);

async function htmlFiles(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await htmlFiles(p)));
    else if (e.name === 'index.html') out.push(p);
  }
  return out;
}

export default function sitemapCheck() {
  return {
    name: 'kamilwnek-sitemap-check',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        // wersja testowa ma noindex na wszystkich stronach – kontrola dotyczy tylko produkcji
        if (process.env.DEPLOY_ENV === 'test') return;
        const root = fileURLToPath(dir);
        const inMaps = new Set();
        for (const map of MAPS) {
          const xml = await fs.readFile(path.join(root, map), 'utf8');
          for (const [, loc] of xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g)) inMaps.add(new URL(loc).pathname);
        }

        const errors = [];
        for (const p of inMaps) {
          const file = path.join(root, p, 'index.html');
          const html = await fs.readFile(file, 'utf8').catch(() => null);
          if (html === null) errors.push(`${p} – nie ma takiej strony`);
          else if (isNoindex(html)) errors.push(`${p} – strona ma noindex`);
        }
        if (errors.length) throw new Error(`Błędne adresy w sitemapie:\n  ${errors.join('\n  ')}`);

        const missing = [];
        for (const file of await htmlFiles(root)) {
          const p = '/' + path.relative(root, path.dirname(file)).split(path.sep).join('/') + '/';
          const url = p === '//' ? '/' : p;
          if (inMaps.has(url) || /\/page\/\d+\/$/.test(url)) continue;
          if (!isNoindex(await fs.readFile(file, 'utf8'))) missing.push(url);
        }
        if (missing.length) logger.warn(`Strony indeksowalne spoza sitemapy (dopisz je w src/lib/sitemap.ts):\n  ${missing.join('\n  ')}`);
        else logger.info(`Sitemapy OK: ${inMaps.size} adresów`);
      },
    },
  };
}
