/**
 * JSON-LD w formie @graph – zgodnie z docs/schema-propozycja.md.
 *
 * 🌍 Globalnie (każda strona ze schemą): Person, Organization, WebSite.
 * 📄 Na stronie: węzeł strony (WebPage / ProfilePage / CollectionPage / ContactPage, + FAQPage gdy jest FAQ),
 *    BreadcrumbList oraz węzły dodatkowe (Service, BlogPosting, OfferCatalog, ItemList) przekazane przez stronę.
 */
import { SITE, PERSON, ORGANIZATION, SOCIALS } from '../config/site';

export type Crumb = { name: string; href: string };
export type FaqItem = { id?: string; question: string; answer: string };
export type PageType = 'WebPage' | 'ProfilePage' | 'CollectionPage' | 'ContactPage';
export type SchemaNode = Record<string, unknown>;

export const abs = (href: string) => new URL(href, SITE.url).href;
const stripHtml = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

export const ID = {
  person: `${SITE.url}/#person`,
  organization: `${SITE.url}/#organization`,
  website: `${SITE.url}/#website`,
  /** @id węzła na konkretnej stronie, np. ID.on('/oferta/audyt-seo/', 'service') */
  on: (path: string, fragment: string) => `${abs(path)}#${fragment}`,
};
export const ref = (id: string) => ({ '@id': id });

/* ───────────── 🌍 Globalne ───────────── */

function personNode(): SchemaNode {
  return {
    '@type': 'Person',
    '@id': ID.person,
    name: PERSON.name,
    url: PERSON.url,
    image: { '@type': 'ImageObject', url: abs(PERSON.image.url), width: PERSON.image.width, height: PERSON.image.height },
    jobTitle: PERSON.jobTitle,
    description: PERSON.description,
    email: SITE.email,
    knowsAbout: PERSON.knowsAbout,
    hasCredential: PERSON.credentials.map((c) => ({
      '@type': 'EducationalOccupationalCredential',
      name: c.name,
      credentialCategory: 'certificate',
      dateCreated: c.date,
      recognizedBy: { '@type': 'Organization', name: c.issuer },
      identifier: { '@type': 'PropertyValue', propertyID: 'Identyfikator poświadczenia', value: c.id },
    })),
    worksFor: ref(ID.organization),
    sameAs: SOCIALS.map((s) => s.href),
  };
}

function organizationNode(): SchemaNode {
  return {
    '@type': 'Organization',
    '@id': ID.organization,
    name: ORGANIZATION.name,
    alternateName: ORGANIZATION.alternateName,
    url: ORGANIZATION.url,
    logo: {
      '@type': 'ImageObject',
      url: abs(ORGANIZATION.logo.url),
      width: ORGANIZATION.logo.width,
      height: ORGANIZATION.logo.height,
    },
    email: SITE.email,
    taxID: ORGANIZATION.taxID,
    vatID: ORGANIZATION.vatID,
    address: { '@type': 'PostalAddress', addressLocality: ORGANIZATION.city, addressCountry: ORGANIZATION.country },
    areaServed: { '@type': 'Country', name: ORGANIZATION.areaServed },
    founder: ref(ID.person),
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      email: SITE.email,
      url: abs('/kontakt/'),
      availableLanguage: ['pl'],
    },
  };
}

function websiteNode(): SchemaNode {
  return {
    '@type': 'WebSite',
    '@id': ID.website,
    url: abs('/'),
    name: SITE.name,
    alternateName: ['kamilwnek.pl', ORGANIZATION.alternateName],
    description: 'SEO oparte na danych, AI i strategii. Audyty, konsultacje, pozycjonowanie i link building.',
    inLanguage: 'pl-PL',
    publisher: ref(ID.person),
    about: ref(ID.person),
  };
}

/* ───────────── 📄 Węzły dodatkowe (budowane przez strony) ───────────── */

export type ServiceOffer = { name?: string; minPrice: number; maxPrice?: number; unit?: 'HUR' | 'MON' };

export function serviceNode(opts: {
  path: string;
  name: string;
  description: string;
  category?: string;
  offers?: ServiceOffer[];
}): SchemaNode {
  return {
    '@type': 'Service',
    '@id': ID.on(opts.path, 'service'),
    name: opts.name,
    serviceType: opts.name,
    description: opts.description,
    url: abs(opts.path),
    ...(opts.category && { category: opts.category }),
    provider: ref(ID.organization),
    areaServed: { '@type': 'Country', name: ORGANIZATION.areaServed },
    availableChannel: { '@type': 'ServiceChannel', serviceUrl: abs('/kontakt/'), availableLanguage: 'pl' },
    ...(opts.offers?.length && {
      offers: opts.offers.map((o) => ({
        '@type': 'Offer',
        ...(o.name && { name: o.name }),
        priceSpecification: {
          '@type': o.unit ? 'UnitPriceSpecification' : 'PriceSpecification',
          minPrice: o.minPrice,
          ...(o.maxPrice && { maxPrice: o.maxPrice }),
          priceCurrency: 'PLN',
          valueAddedTaxIncluded: false,
          ...(o.unit && { unitCode: o.unit, unitText: o.unit === 'MON' ? 'miesięcznie' : 'za godzinę' }),
        },
      })),
    }),
  };
}

export function blogPostingNode(opts: {
  path: string;
  headline: string;
  description: string;
  image?: { url: string; width?: number; height?: number };
  datePublished: Date;
  dateModified?: Date;
  sections: string[];
  wordCount: number;
  minutes: number;
}): SchemaNode {
  return {
    '@type': 'BlogPosting',
    '@id': ID.on(opts.path, 'article'),
    headline: opts.headline,
    description: opts.description,
    ...(opts.image && { image: { '@type': 'ImageObject', ...opts.image, url: abs(opts.image.url) } }),
    datePublished: opts.datePublished.toISOString(),
    dateModified: (opts.dateModified ?? opts.datePublished).toISOString(),
    author: ref(ID.person),
    publisher: ref(ID.person),
    mainEntityOfPage: ref(ID.on(opts.path, 'webpage')),
    ...(opts.sections.length && { articleSection: opts.sections }),
    wordCount: opts.wordCount,
    timeRequired: `PT${opts.minutes}M`,
    inLanguage: 'pl-PL',
  };
}

export function itemListNode(path: string, urls: string[]): SchemaNode {
  return {
    '@type': 'ItemList',
    '@id': ID.on(path, 'list'),
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    numberOfItems: urls.length,
    itemListElement: urls.map((u, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(u) })),
  };
}

export function offerCatalogNode(path: string, groups: { name: string; servicePaths: string[] }[]): SchemaNode {
  return {
    '@type': 'OfferCatalog',
    '@id': ID.on(path, 'catalog'),
    name: 'Usługi SEO',
    itemListElement: groups.map((g) => ({
      '@type': 'OfferCatalog',
      name: g.name,
      itemListElement: g.servicePaths.map((p) => ({ '@type': 'Offer', itemOffered: ref(ID.on(p, 'service')) })),
    })),
  };
}

/* ───────────── Złożenie grafu strony ───────────── */

export type PageSchema = {
  /** Typ strony (domyślnie WebPage). FAQPage dokłada się sam, gdy strona ma FAQ. */
  type?: PageType;
  /** about → np. ref(ID.person) albo usługa */
  about?: SchemaNode;
  /** mainEntity (np. Person na /o-mnie/, lista na blogu) – ignorowane, gdy strona ma FAQ */
  mainEntity?: SchemaNode;
  primaryImage?: string;
  /** Dodatkowe węzły (Service, BlogPosting, OfferCatalog, ItemList…) */
  nodes?: SchemaNode[];
};

export function buildGraph(opts: {
  url: string;
  title: string;
  description?: string;
  crumbs?: Crumb[];
  faq?: FaqItem[];
  datePublished?: Date;
  dateModified?: Date;
  page?: PageSchema;
}) {
  const url = abs(opts.url);
  const page = opts.page ?? {};
  const hasFaq = Boolean(opts.faq?.length);
  const type = page.type ?? 'WebPage';

  const webpage: SchemaNode = {
    '@type': hasFaq ? [type, 'FAQPage'] : type,
    '@id': `${url}#webpage`,
    url,
    name: opts.title,
    ...(opts.description && { description: opts.description }),
    isPartOf: ref(ID.website),
    ...(page.about && { about: page.about }),
    ...(page.primaryImage && { primaryImageOfPage: { '@type': 'ImageObject', url: abs(page.primaryImage) } }),
    ...(opts.datePublished && { datePublished: opts.datePublished.toISOString() }),
    ...(opts.dateModified && { dateModified: opts.dateModified.toISOString() }),
    ...(opts.crumbs?.length && { breadcrumb: ref(`${url}#breadcrumb`) }),
    ...(hasFaq
      ? {
          mainEntity: opts.faq!.map((f) => ({
            '@type': 'Question',
            ...(f.id && { url: `${url}#${f.id}` }),
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: stripHtml(f.answer) },
          })),
        }
      : page.mainEntity && { mainEntity: page.mainEntity }),
    inLanguage: 'pl-PL',
  };

  const graph: SchemaNode[] = [personNode(), organizationNode(), websiteNode(), webpage];

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

  graph.push(...(page.nodes ?? []));
  return { '@context': 'https://schema.org', '@graph': graph };
}
