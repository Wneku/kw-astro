import { getCollection } from 'astro:content';
import { SERVICE_GROUPS } from '../config/services';

export type NavLink = { label: string; href: string };
export type MegaItem = NavLink & { description?: string; icon?: string };
export type MegaColumn = {
  id: string;
  label: string;
  description: string;
  icon: string;
  items: MegaItem[];
};
export type NavItem = NavLink & { mega?: MegaColumn[] };

export const serviceHref = (id: string) => `/oferta/${id}/`;

/** Usługi pogrupowane wg SERVICE_GROUPS (puste grupy są pomijane). */
export async function getServiceColumns(): Promise<MegaColumn[]> {
  const services = (await getCollection('oferta', ({ data }) => !data.draft)).sort(
    (a, b) => a.data.order - b.data.order,
  );
  return SERVICE_GROUPS.map((group) => ({
    ...group,
    items: services
      .filter((s) => s.data.group === group.id)
      .map((s) => ({
        label: s.data.title,
        href: serviceHref(s.id),
        description: s.data.menuDescription,
        icon: s.data.icon,
      })),
  })).filter((col) => col.items.length > 0);
}

export async function getMainNav(): Promise<NavItem[]> {
  return [
    { label: 'O mnie', href: '/o-mnie/' },
    { label: 'Oferta', href: '/oferta/', mega: await getServiceColumns() },
    { label: 'Blog', href: '/blog/' },
    { label: 'Kontakt', href: '/kontakt/' },
  ];
}
