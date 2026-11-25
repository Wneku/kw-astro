// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import fs from 'node:fs';
import YAML from 'yaml';
import rehypeHeadingIds from './src/lib/rehype-heading-ids.mjs';
import rehypeCta from './src/lib/rehype-cta.mjs';
import htaccess from './src/integrations/htaccess.mjs';

const SITE = 'https://kamilwnek.pl';

/** Kategorie oznaczone jako noindex (z Rank Math) – poza sitemapą */
const noindexPaths = new Set(
  JSON.parse(fs.readFileSync('./src/content/kategorie.json', 'utf8'))
    .filter((/** @type {any} */ c) => c.noindex)
    .map((/** @type {any} */ c) => `${SITE}/blog/${c.id}/`),
);

/** lastmod do sitemapy z frontmattera (updatedDate / pubDate) */
const lastmod = new Map();
for (const [dir, prefix] of [
  ['oferta', '/oferta/'],
  ['blog', '/blog/'],
  ['strony', '/'],
]) {
  for (const f of fs.readdirSync(`./src/content/${dir}`).filter((f) => f.endsWith('.md'))) {
    const fm = YAML.parse(fs.readFileSync(`./src/content/${dir}/${f}`, 'utf8').split(/^---$/m)[1]) ?? {};
    const date = fm.updatedDate ?? fm.pubDate;
    if (date) lastmod.set(`${SITE}${prefix}${f.replace(/\.md$/, '')}/`, new Date(date).toISOString());
  }
}

// https://astro.build/config
export default defineConfig({
  site: SITE,
  // Linki i canonical zawsze z ukośnikiem (build.format: directory) – jak w WordPressie.
  // 'ignore' tylko po to, by błędne adresy bez ukośnika (np. /awsfad) dawały stronę 404, a nie komunikat Astro;
  // przekierowanie /o-mnie → /o-mnie/ robi serwer (DirectorySlash w .htaccess)
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  markdown: {
    processor: unified({
      // id nagłówków w ASCII – zgodne z kotwicami spisów treści z WordPressa
      rehypePlugins: [rehypeHeadingIds, rehypeCta],
      // treść 1:1 z WordPressa – bez automatycznej zamiany cudzysłowów
      smartypants: false,
    }),
    shikiConfig: { theme: "github-light" },
  },
  integrations: [
    sitemap({
      filter: (page) => !noindexPaths.has(page) && !page.endsWith('/404/') && !page.endsWith('/kontakt/dziekuje/'),
      serialize: (item) => ({ ...item, lastmod: lastmod.get(item.url) ?? item.lastmod }),
    }),
    htaccess({ host: 'kamilwnek.pl' }),
  ],
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
});
