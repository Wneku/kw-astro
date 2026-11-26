/**
 * Grupy usług = kolumny mega menu "Oferta".
 * Aby dodać nową kolumnę: dopisz obiekt tutaj, a w plikach .md usług
 * ustaw `group: '<id>'`. Kolejność w tablicy = kolejność kolumn.
 */
export const SERVICE_GROUPS = [
  {
    id: 'strategia-i-analiza',
    label: 'Strategia i Analiza',
    description: 'Diagnoza strony i plan działań SEO',
    icon: 'compass',
  },
  {
    id: 'pozycjonowanie',
    label: 'Pozycjonowanie',
    description: 'Długofalowy wzrost widoczności w Google',
    icon: 'trending-up',
  },
  {
    id: 'linkbuilding',
    label: 'Linkbuilding',
    description: 'Budowa autorytetu i profilu linków',
    icon: 'link',
  },
] as const;

export type ServiceGroupId = (typeof SERVICE_GROUPS)[number]['id'];
export const SERVICE_GROUP_IDS = SERVICE_GROUPS.map((g) => g.id) as [
  ServiceGroupId,
  ...ServiceGroupId[],
];

/** Karta CTA wyświetlana po prawej stronie mega menu */
export const MEGA_MENU_CTA = {
  title: 'Nie wiesz, od czego zacząć?',
  text: 'Umów bezpłatną rozmowę – sprawdzimy, które działania SEO dadzą Twojej stronie najwięcej.',
  label: 'Umów rozmowę',
  href: '/kontakt/',
};
