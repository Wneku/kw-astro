/**
 * JSON-LD – na razie tylko BreadcrumbList i FAQPage.
 * (Person/Organization, WebSite, WebPage, BlogPosting celowo wyłączone – do dodania później.)
 */
import { SITE } from '../config/site';

export type Crumb = { name: string; href: string };
export type FaqItem = { id?: string; question: string; answer: string };

const stripHtml = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const abs = (href: string) => new URL(href, SITE.url).href;

/** Zwraca obiekt JSON-LD albo null, gdy strona nie ma ani okruszków, ani FAQ. */
export function buildGraph(opts: { url: string; crumbs?: Crumb[]; faq?: FaqItem[] }) {
  const url = abs(opts.url);
  const graph: Record<string, unknown>[] = [];

  if (opts.crumbs?.length) {
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: opts.crumbs.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: { '@id': abs(c.href), name: c.name },
      })),
    });
  }

  if (opts.faq?.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      url,
      inLanguage: 'pl-PL',
      mainEntity: opts.faq.map((f) => ({
        '@type': 'Question',
        ...(f.id && { url: `${url}#${f.id}` }),
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: stripHtml(f.answer) },
      })),
    });
  }

  return graph.length ? { '@context': 'https://schema.org', '@graph': graph } : null;
}
