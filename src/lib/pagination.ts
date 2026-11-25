/** Liczba wpisów na stronie listingu bloga i kategorii (3 rzędy po 3). */
export const POSTS_PER_PAGE = 9;

/** URL strony listingu: 1 → /blog/, 2 → /blog/page/2/ (wzorzec z WordPressa). */
export const pageUrl = (base: string, page: number) => (page === 1 ? base : `${base}page/${page}/`);

export type PageInfo<T> = {
  items: T[];
  current: number;
  total: number;
  base: string;
};

/** Dzieli listę na strony. Zawsze zwraca co najmniej jedną (pustą) stronę. */
export function paginate<T>(items: T[], base: string, perPage = POSTS_PER_PAGE): PageInfo<T>[] {
  const total = Math.max(1, Math.ceil(items.length / perPage));
  return Array.from({ length: total }, (_, i) => ({
    items: items.slice(i * perPage, (i + 1) * perPage),
    current: i + 1,
    total,
    base,
  }));
}

/** Numery stron do wyświetlenia, z wielokropkami: [1, '…', 4, 5, 6, '…', 12] */
export function pageNumbers(current: number, total: number): (number | '…')[] {
  const pages = new Set([1, total, current - 1, current, current + 1].filter((n) => n >= 1 && n <= total));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push('…');
    out.push(n);
  });
  return out;
}
