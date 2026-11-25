import { slugify } from './slugify.mjs';

/** Tekst węzła hast (rekurencyjnie). */
const textOf = (node) =>
  node.type === 'text' ? node.value : (node.children ?? []).map(textOf).join('');

/**
 * Nadaje nagłówkom h2–h4 w Markdown identyfikatory ASCII (zgodne z importerem z WordPressa).
 * Wbudowany plugin Astro pomija elementy, które mają już `id`.
 */
export default function rehypeHeadingIds() {
  return (tree) => {
    const seen = new Map();
    const visit = (node) => {
      if (node.type === 'element' && /^h[2-4]$/.test(node.tagName) && !node.properties?.id) {
        const base = slugify(textOf(node)) || 'sekcja';
        const n = seen.get(base) ?? 0;
        seen.set(base, n + 1);
        node.properties = { ...node.properties, id: n ? `${base}-${n}` : base };
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}
