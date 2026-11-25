export const SITE = {
  name: 'Kamil Wnęk',
  title: 'Freelancer SEO - Pozycjonowanie, audyty, konsultacje | Kamil Wnęk',
  description:
    'SEO oparte na danych, AI i strategii. Pomagam firmom rosnąć w Google, dzięki audytom, konsultacjom i skutecznemu pozycjonowaniu.',
  url: 'https://kamilwnek.pl',
  locale: 'pl_PL',
  lang: 'pl',
  email: 'kontakt@kamilwnek.pl',
  /** Kalendarz do umawiania bezpłatnej rozmowy */
  calUrl: 'https://cal.com/kamilwnek/rozmowa-30-minut',
} as const;

/**
 * Dane do JSON-LD (src/lib/schema.ts). Uzgodnione w docs/schema-propozycja.md.
 * Obrazki pod STAŁYMI adresami w public/images/schema/ (pliki z /_astro/ zmieniają nazwy).
 */
export const PERSON = {
  name: 'Kamil Wnęk',
  jobTitle: 'Specjalista SEO',
  url: 'https://kamilwnek.pl/o-mnie/',
  description:
    'Specjalista ds. SEO. Od 2018 roku pomagam firmom budować widoczność w Google i AI – od audytów, przez pozycjonowanie, po link building.',
  image: { url: '/images/schema/kamil-wnek.jpg', width: 800, height: 1000 },
  knowsAbout: ['SEO', 'Techniczne SEO', 'AI Search', 'Link building', 'Pozycjonowanie lokalne', 'SEO e-commerce'],
  credentials: [
    {
      name: 'Kurs SEO 3.0',
      issuer: 'SensAI Academy',
      date: '2025-07',
      id: 'fd141441-20d1-4623-9447-48de7b866398',
    },
    {
      name: 'Wykorzystanie AI w rozwoju firmy',
      issuer: 'Google',
      date: '2025-09',
      id: '2248f041-a323-4439-91f1-06b7429d3c9c',
    },
  ],
} as const;

export const ORGANIZATION = {
  name: 'W3 Digital Kamil Wnęk',
  alternateName: 'Kamil Wnęk – Specjalista SEO',
  url: 'https://kamilwnek.pl/',
  logo: { url: '/images/schema/logo.png', width: 512, height: 512 },
  taxID: '5833279388',
  vatID: 'PL5833279388',
  city: 'Warszawa',
  country: 'PL',
  areaServed: 'Polska',
} as const;

/** Tagi i zgody – identyczne jak na WordPressie */
export const TRACKING = {
  gtmId: 'GTM-PV324XZZ',
  cookieYesId: '0d03f36373c50528590d19b793113718',
} as const;

export const SOCIALS = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/kamil-wnek/', icon: 'linkedin' },
  { label: 'YouTube', href: 'https://www.youtube.com/@kamil-wnek', icon: 'youtube' },
  { label: 'Instagram', href: 'https://www.instagram.com/kamilwnekpl/', icon: 'instagram' },
  { label: 'TikTok', href: 'https://www.tiktok.com/@kamilwnekseo', icon: 'tiktok' },
] as const;
