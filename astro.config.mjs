// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import rehypeHeadingIds from './src/lib/rehype-heading-ids.mjs';
import remarkComponents from './src/lib/remark-components.mjs';
import adminEditor from './src/admin/integration.mjs';
import htaccess from './src/integrations/htaccess.mjs';
import sitemapCheck from './src/integrations/sitemap-check.mjs';

const SITE = 'https://kamilwnek.pl';

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
      // przycisk, ramka i link z rel z edytora (/admin) → HTML
      remarkPlugins: [remarkComponents],
      // id nagłówków w ASCII – zgodne z kotwicami spisów treści z WordPressa
      rehypePlugins: [rehypeHeadingIds],
      // treść 1:1 z WordPressa – bez automatycznej zamiany cudzysłowów
      smartypants: false,
    }),
    shikiConfig: { theme: "github-light" },
  },
  integrations: [
    // sitemapy: src/pages/*-sitemap.xml.ts + src/lib/sitemap.ts; po buildzie kontrola kompletności
    sitemapCheck(),
    htaccess({ host: 'kamilwnek.pl' }),
    // edytor treści /admin – tylko w `npm run dev`, do builda nic nie trafia
    adminEditor(),
  ],
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
});
