import { defineCollection, reference } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';
import { SERVICE_GROUP_IDS } from './config/services';

/** Pytania FAQ – renderowane na stronie i jako FAQPage w JSON-LD. `answer` to HTML. */
const faq = z
  .array(z.object({ id: z.string().optional(), question: z.string(), answer: z.string() }))
  .default([]);

/** Usługi – /oferta/<id>/ (id = nazwa pliku) */
const oferta = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/oferta' }),
  schema: z.object({
    title: z.string(),
    seoTitle: z.string().optional(),
    description: z.string(),
    group: z.enum(SERVICE_GROUP_IDS),
    /** Krótki opis w mega menu */
    menuDescription: z.string().optional(),
    /** Opis na karcie usługi (/oferta/, strona główna) */
    cardDescription: z.string().optional(),
    order: z.number().default(100),
    icon: z.string().optional(),
    pubDate: z.coerce.date().optional(),
    updatedDate: z.coerce.date().optional(),
    /** Markdown wyświetlany w hero obok formularza */
    intro: z.string().optional(),
    /** Ceny netto do schemy Service (Offer). unit: HUR = za godzinę, MON = miesięcznie, brak = jednorazowo */
    offers: z
      .array(
        z.object({
          name: z.string().optional(),
          minPrice: z.number(),
          maxPrice: z.number().optional(),
          unit: z.enum(['HUR', 'MON']).optional(),
        }),
      )
      .default([]),
    /** Blok „Dlaczego warto ze mną współpracować?” przed FAQ */
    whyMe: z.boolean().default(false),
    faqTitle: z.string().default('Najczęściej zadawane pytania i odpowiedzi'),
    faq,
    draft: z.boolean().default(false),
  }),
});

/** Kategorie bloga – /blog/<id>/ */
const kategorie = defineCollection({
  loader: file('./src/content/kategorie.json'),
  schema: z.object({
    name: z.string(),
    description: z.string().optional(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    noindex: z.boolean().default(false),
  }),
});

/** Wpisy blogowe – /blog/<id>/ */
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      seoTitle: z.string().optional(),
      description: z.string(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      categories: z.array(reference('kategorie')).default([]),
      cover: image().optional(),
      coverAlt: z.string().default(''),
      faq,
      draft: z.boolean().default(false),
    }),
});

/** Zwykłe strony treściowe – /<id>/ (o-mnie, polityka-prywatnosci) */
const strony = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/strony' }),
  schema: z.object({
    title: z.string(),
    seoTitle: z.string().optional(),
    description: z.string(),
    eyebrow: z.string().optional(),
    pubDate: z.coerce.date().optional(),
    updatedDate: z.coerce.date().optional(),
    noindex: z.boolean().default(false),
    faq,
  }),
});

export const collections = { oferta, kategorie, blog, strony };
