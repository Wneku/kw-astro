/** Dane listingów bloga i kategorii – wspólne dla strony 1 i kolejnych stron paginacji. */
import { getCollection, type CollectionEntry } from 'astro:content';
import { getPosts, categoryHref } from './blog';
import { paginate } from './pagination';
import pageSeo from '../data/page-seo.json';

const home = { name: 'Strona główna', href: '/' };
const blog = { name: 'Blog', href: '/blog/' };

export const blogListingProps = {
  heading: 'Blog',
  lead: pageSeo['/blog/'].description,
  seoTitle: pageSeo['/blog/'].title,
  seoDescription: pageSeo['/blog/'].description,
  crumbs: [home, blog],
  showCategories: true,
};

export function categoryListingProps(category: CollectionEntry<'kategorie'>, postCount: number) {
  const { data } = category;
  return {
    heading: data.name,
    eyebrow: 'Kategoria',
    description: data.description,
    seoTitle: data.seoTitle ?? `${data.name} | Kamil Wnęk`,
    seoDescription: data.seoDescription ?? data.description ?? `Wpisy z kategorii ${data.name}.`,
    noindex: data.noindex || postCount === 0,
    crumbs: [home, blog, { name: data.name, href: categoryHref(category.id) }],
    showCategories: true,
    activeCategory: category.id,
  };
}

/** Wszystkie strony wszystkich kategorii: [{ category, page, postCount }] */
export async function getCategoryPages() {
  const [categories, posts] = await Promise.all([getCollection('kategorie'), getPosts()]);
  return categories.flatMap((category) => {
    const inCategory = posts.filter((p) => p.data.categories.some((c) => c.id === category.id));
    return paginate(inCategory, categoryHref(category.id)).map((page) => ({
      category,
      page,
      postCount: inCategory.length,
    }));
  });
}

