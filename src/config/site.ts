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

/** Dane do JSON-LD (przeniesione z ustawień Rank Math) */
export const PERSON = {
  name: 'Kamil Wnęk',
  jobTitle: 'Specjalista SEO',
  url: 'https://kamilwnek.pl/o-mnie/',
  knowsAbout: ['SEO', 'Techniczne SEO', 'AI Search', 'Link building', 'Pozycjonowanie lokalne', 'SEO e-commerce'],
  worksFor: { name: 'W3 Digital Kamil Wnęk', taxID: '5833279388', url: 'https://kamilwnek.pl/' },
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
