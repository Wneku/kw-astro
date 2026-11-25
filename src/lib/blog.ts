import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;

/** Opublikowane wpisy, od najnowszego. Drafty widoczne tylko w `astro dev`. */
export async function getPosts() {
  const posts = await getCollection('blog', ({ data }) => import.meta.env.DEV || !data.draft);
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export const postHref = (id: string) => `/blog/${id}/`;
export const categoryHref = (id: string) => `/blog/${id}/`;

export const formatDate = (date: Date) =>
  date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Warsaw' });

/** Szacowany czas czytania w minutach (~200 słów/min). */
/** Liczba słów treści (bez bloków kodu i znaczników HTML). */
export function wordCount(markdown = '') {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

export function readingTime(markdown = '') {
  return Math.max(1, Math.round(wordCount(markdown) / 200));
}
