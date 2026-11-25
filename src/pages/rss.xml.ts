import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPosts, postHref } from '../lib/blog';
import { SITE } from '../config/site';

/** Kanał RSS bloga (stary adres /feed/ przekierowuje tutaj – patrz .htaccess). */
export async function GET(context: APIContext) {
  const posts = await getPosts();
  return rss({
    title: `${SITE.name} – blog o SEO`,
    description: 'Blog o SEO, algorytmach Google, strategii budowania widoczności i AI.',
    site: context.site!,
    items: posts.map((p) => ({
      title: p.data.title,
      description: p.data.description,
      pubDate: p.data.pubDate,
      link: postHref(p.id),
    })),
    customData: '<language>pl-pl</language>',
  });
}
