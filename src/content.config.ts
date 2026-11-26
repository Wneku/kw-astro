import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { marked } from 'marked';
import { SERVICE_GROUP_IDS } from './config/services';

/*
 * Pliki zapisuje edytor /admin (src/admin/) albo ręczna edycja. Puste pola mogą przyjść jako '' albo null,
 * dlatego pola opcjonalne zamieniają je na undefined.
 */
const empty = (v: unknown) => (v === '' || v === null ? undefined : v);
const optStr = z.preprocess(empty, z.string().optional());
const optNum = z.preprocess(empty, z.number().optional());
const optDate = z.preprocess(empty, z.coerce.date().optional());

/** Pytania FAQ – renderowane na stronie i jako FAQPage w JSON-LD. `answer` w panelu to Markdown → tu HTML. */
const faq = z
  .array(
    z.object({
      id: optStr,
      question: z.string(),
      answer: z.string().transform((md) => marked.parse(md, { async: false, gfm: false }).trim()),
    }),
  )
  .nullish()
  .transform((v) => v ?? []);

/** Usługi – /oferta/<id>/ (id = nazwa pliku) */
const oferta = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/oferta' }),
  schema: z.object({
    title: z.string(),
    seoTitle: optStr,
    description: z.string(),
    group: z.enum(SERVICE_GROUP_IDS),
    /** Krótki opis w mega menu */
    menuDescription: optStr,
    /** Opis na karcie usługi (/oferta/, strona główna) */
    cardDescription: optStr,
    order: z.preprocess(empty, z.number().default(100)),
    icon: optStr,
    pubDate: optDate,
    updatedDate: optDate,
    /** Markdown wyświetlany w hero obok formularza */
    intro: optStr,
    /** Ceny netto do schemy Service (Offer). unit: HUR = za godzinę, MON = miesięcznie, brak = jednorazowo */
    offers: z
      .array(
        z.object({
          name: optStr,
          minPrice: z.number(),
          maxPrice: optNum,
          unit: z.preprocess(empty, z.enum(['HUR', 'MON']).optional()),
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

/** Kategorie bloga – /blog/<id>/ (id = nazwa pliku .json) */
const kategorie = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/kategorie' }),
  schema: z.object({
    name: z.string(),
    description: optStr,
    seoTitle: optStr,
    seoDescription: optStr,
    noindex: z.boolean().default(false),
  }),
});

/** Wpisy blogowe – /blog/<id>/ */
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      seoTitle: optStr,
      description: z.string(),
      pubDate: z.coerce.date(),
      updatedDate: optDate,
      categories: z.array(reference('kategorie')).default([]),
      cover: z.preprocess(empty, image().optional()),
      coverAlt: z.preprocess((v) => v ?? '', z.string()),
      faq,
      draft: z.boolean().default(false),
    }),
});

/** Zwykłe strony treściowe – /<id>/ (o-mnie, polityka-prywatnosci) */
const strony = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/strony' }),
  schema: z.object({
    title: z.string(),
    seoTitle: optStr,
    description: z.string(),
    eyebrow: optStr,
    pubDate: optDate,
    updatedDate: optDate,
    noindex: z.boolean().default(false),
    faq,
  }),
});

export const collections = { oferta, kategorie, blog, strony };
