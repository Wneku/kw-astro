/**
 * Pola formularza w edytorze (/admin) dla każdej sekcji. Kolejność = kolejność w pliku .md.
 * Pola spoza listy, które są już w pliku, zostają nietknięte.
 * Walidacja na stronie: src/content.config.ts.
 */
import { SERVICE_GROUPS } from '../config/services';

export type Option = { value: string; label: string };
export type Field =
  | { type: 'heading'; label: string }
  | { type: 'text' | 'textarea' | 'markdown'; name: string; label: string; help?: string; required?: boolean; max?: number; rows?: number }
  | { type: 'number'; name: string; label: string; help?: string; required?: boolean }
  | { type: 'date'; name: string; label: string; help?: string; required?: boolean; today?: boolean }
  | { type: 'checkbox'; name: string; label: string; help?: string }
  | { type: 'select'; name: string; label: string; help?: string; options: Option[] }
  | { type: 'categories'; name: string; label: string }
  | { type: 'image'; name: string; label: string; help?: string }
  | { type: 'list'; name: string; label: string; addLabel: string; titleField: string; fields: Field[] };

export type Collection = {
  label: string;
  /** „Nowy …” */
  newLabel?: string;
  /** pole tytułu (duże pole nad edytorem) */
  titleField: string;
  titleLabel: string;
  /** czy ma treść (edytor) */
  body: boolean;
  canCreate: boolean;
  urlPrefix: string;
  fields: Field[];
};

const ICONS = ['search', 'bar-chart', 'git-compare', 'link', 'map-pin', 'message-circle', 'shopping-cart', 'trending-up', 'compass', 'calendar'];

const faq: Field = {
  type: 'list',
  name: 'faq',
  label: 'FAQ',
  addLabel: 'Dodaj pytanie',
  titleField: 'question',
  fields: [
    { type: 'text', name: 'question', label: 'Pytanie', required: true },
    { type: 'markdown', name: 'answer', label: 'Odpowiedź', required: true, rows: 4, help: '**pogrubienie**, [link](/adres/)' },
  ],
};

const seo: Field[] = [
  { type: 'heading', label: 'SEO' },
  { type: 'text', name: 'seoTitle', label: 'Meta title', max: 60, help: 'Puste = tytuł' },
  { type: 'textarea', name: 'description', label: 'Meta description', required: true, max: 160, rows: 3 },
];

export const COLLECTIONS: Record<string, Collection> = {
  blog: {
    label: 'Wpisy',
    newLabel: 'Nowy wpis',
    titleField: 'title',
    titleLabel: 'Tytuł wpisu (H1)',
    body: true,
    canCreate: true,
    urlPrefix: '/blog/',
    fields: [
      ...seo,
      { type: 'heading', label: 'Publikacja' },
      { type: 'checkbox', name: 'draft', label: 'Szkic', help: 'Zaznaczone = wpis nie pojawi się na stronie' },
      { type: 'date', name: 'pubDate', label: 'Data publikacji', required: true, today: true },
      { type: 'date', name: 'updatedDate', label: 'Data aktualizacji', today: true },
      { type: 'categories', name: 'categories', label: 'Kategorie' },
      { type: 'heading', label: 'Okładka' },
      { type: 'image', name: 'cover', label: 'Obrazek okładki' },
      { type: 'text', name: 'coverAlt', label: 'Alt okładki', help: 'Co jest na obrazku' },
      { type: 'heading', label: 'FAQ (pod treścią + schema FAQPage)' },
      faq,
    ],
  },
  oferta: {
    label: 'Oferta',
    newLabel: 'Nowa usługa',
    titleField: 'title',
    titleLabel: 'Nazwa usługi (H1)',
    body: true,
    canCreate: true,
    urlPrefix: '/oferta/',
    fields: [
      ...seo,
      { type: 'heading', label: 'Menu i karty' },
      { type: 'select', name: 'group', label: 'Kolumna w mega menu', options: SERVICE_GROUPS.map((g) => ({ value: g.id, label: g.label })) },
      { type: 'number', name: 'order', label: 'Kolejność', help: 'Mniejsza liczba = wyżej (domyślnie 100)' },
      { type: 'select', name: 'icon', label: 'Ikona', options: [{ value: '', label: '— brak —' }, ...ICONS.map((i) => ({ value: i, label: i }))] },
      { type: 'text', name: 'menuDescription', label: 'Opis w mega menu' },
      { type: 'textarea', name: 'cardDescription', label: 'Opis na karcie usługi', rows: 3 },
      { type: 'heading', label: 'Hero' },
      { type: 'markdown', name: 'intro', label: 'Tekst obok formularza', rows: 8, help: 'Markdown: akapity, listy z „- ”, **pogrubienie**' },
      { type: 'heading', label: 'Ceny (schema Offer)' },
      {
        type: 'list',
        name: 'offers',
        label: 'Warianty',
        addLabel: 'Dodaj wariant',
        titleField: 'name',
        fields: [
          { type: 'text', name: 'name', label: 'Nazwa' },
          { type: 'number', name: 'minPrice', label: 'Cena od (zł netto)', required: true },
          { type: 'number', name: 'maxPrice', label: 'Cena do' },
          {
            type: 'select',
            name: 'unit',
            label: 'Rozliczenie',
            options: [
              { value: '', label: 'jednorazowo' },
              { value: 'HUR', label: 'za godzinę' },
              { value: 'MON', label: 'miesięcznie' },
            ],
          },
        ],
      },
      { type: 'heading', label: 'Publikacja' },
      { type: 'checkbox', name: 'draft', label: 'Szkic', help: 'Zaznaczone = usługa nie pojawi się na stronie' },
      { type: 'date', name: 'pubDate', label: 'Data publikacji', today: true },
      { type: 'date', name: 'updatedDate', label: 'Data aktualizacji', today: true },
      { type: 'heading', label: 'Sekcje pod treścią' },
      { type: 'checkbox', name: 'whyMe', label: 'Blok „Dlaczego warto ze mną współpracować?”' },
      { type: 'text', name: 'faqTitle', label: 'Nagłówek FAQ' },
      faq,
    ],
  },
  strony: {
    label: 'Strony',
    titleField: 'title',
    titleLabel: 'Tytuł strony (H1)',
    body: true,
    canCreate: false,
    urlPrefix: '/',
    fields: [
      { type: 'text', name: 'eyebrow', label: 'Nadtytuł', help: 'Mały tekst nad H1' },
      ...seo,
      { type: 'heading', label: 'Publikacja' },
      { type: 'date', name: 'pubDate', label: 'Data publikacji', today: true },
      { type: 'date', name: 'updatedDate', label: 'Data aktualizacji', today: true },
      { type: 'checkbox', name: 'noindex', label: 'noindex', help: 'Strona poza Google i sitemapą' },
      { type: 'heading', label: 'FAQ' },
      faq,
    ],
  },
  kategorie: {
    label: 'Kategorie',
    newLabel: 'Nowa kategoria',
    titleField: 'name',
    titleLabel: 'Nazwa kategorii',
    body: false,
    canCreate: true,
    urlPrefix: '/blog/',
    fields: [
      { type: 'textarea', name: 'description', label: 'Opis na stronie kategorii', rows: 4 },
      { type: 'heading', label: 'SEO' },
      { type: 'text', name: 'seoTitle', label: 'Meta title', max: 60 },
      { type: 'textarea', name: 'seoDescription', label: 'Meta description', max: 160, rows: 3 },
      { type: 'checkbox', name: 'noindex', label: 'noindex', help: 'Kategoria poza Google i sitemapą' },
    ],
  },
};
