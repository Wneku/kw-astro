/**
 * Atrybut rel (nofollow / sponsored / ugc) dla linków w treści Markdown.
 *
 * Markdown nie ma składni na rel, a edytor wizualny Pages CMS usuwa surowy HTML,
 * dlatego znacznik dopisujemy na końcu adresu linku:
 *
 *   https://example.com/#nofollow              → rel="nofollow"
 *   https://example.com/#sponsored             → rel="sponsored"
 *   https://example.com/#ugc                   → rel="ugc"
 *   https://example.com/#nofollow-sponsored    → rel="nofollow sponsored"
 *   https://example.com/#sekcja~nofollow       → href=".../#sekcja", rel="nofollow"
 *
 * Znacznikiem jest tylko CAŁY fragment po # (albo część po ~), więc zwykłe kotwice
 * typu #co-to-jest-nofollow zostają nietknięte. Kotwice na tej samej stronie (#...) są pomijane.
 *
 * Znacznik jest usuwany z href, więc w kodzie strony zostaje czysty adres.
 * Alternatywnie (widok „Source”): [tekst](https://example.com "nofollow").
 *
 * Linki zewnętrzne otwierane w nowej karcie (target="_blank") dostają też noopener.
 */
const TOKENS = ['nofollow', 'sponsored', 'ugc'];
const MARKER = new RegExp(`(?:^|~)((?:${TOKENS.join('|')})(?:-(?:${TOKENS.join('|')}))*)$`);

const toList = (v) => (Array.isArray(v) ? v : typeof v === 'string' ? v.split(/\s+/) : []).filter(Boolean);

export default function rehypeLinkRel() {
  return (tree) => {
    const visit = (node) => {
      if (node.type === 'element' && node.tagName === 'a' && typeof node.properties?.href === 'string') {
        const props = node.properties;
        const rel = new Set(toList(props.rel));

        // 1) znacznik w adresie: ...#nofollow, ...#sekcja~nofollow
        const hashAt = props.href.indexOf('#');
        if (hashAt > 0) {
          const hash = props.href.slice(hashAt + 1);
          const m = hash.match(MARKER);
          if (m) {
            m[1].split('-').forEach((t) => rel.add(t));
            const rest = hash.slice(0, m.index);
            props.href = props.href.slice(0, hashAt) + (rest ? `#${rest}` : '');
          }
        }

        // 2) tytuł linku: [tekst](url "nofollow sponsored")
        if (typeof props.title === 'string') {
          const words = props.title.trim().toLowerCase().split(/[\s,]+/);
          if (words.length && words.every((w) => TOKENS.includes(w))) {
            words.forEach((t) => rel.add(t));
            delete props.title;
          }
        }

        if (props.target === '_blank') rel.add('noopener');
        if (rel.size) props.rel = [...rel];
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}
