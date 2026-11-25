/**
 * Przycisk w treści Markdown: akapit zawierający WYŁĄCZNIE pogrubiony link.
 *
 *   **[Umów bezpłatną rozmowę](/kontakt/#kalendarz)**
 *
 * → <p class="cta"><a class="btn" href="/kontakt/#kalendarz">Umów bezpłatną rozmowę</a></p>
 *
 * W edytorze wizualnym Pages CMS: napisz tekst w osobnym akapicie, dodaj link i pogrub całość.
 * (Działa też odwrotna kolejność: link zawierający pogrubienie.)
 */
const isBlank = (n) => n.type === 'text' && n.value.trim() === '';
const onlyChild = (node) => {
  const kids = (node.children ?? []).filter((c) => !isBlank(c));
  return kids.length === 1 ? kids[0] : null;
};
const isEl = (n, tag) => n?.type === 'element' && n.tagName === tag;

export default function rehypeCta() {
  return (tree) => {
    const visit = (node) => {
      if (isEl(node, 'p')) {
        const child = onlyChild(node);
        let link = null;
        // **[tekst](url)**  →  <strong><a>…</a></strong>
        if (isEl(child, 'strong') && isEl(onlyChild(child), 'a')) link = onlyChild(child);
        // [**tekst**](url)  →  <a><strong>…</strong></a>
        if (isEl(child, 'a') && isEl(onlyChild(child), 'strong')) {
          link = child;
          link.children = onlyChild(child).children;
        }
        if (link) {
          node.properties = { ...node.properties, className: ['cta'] };
          link.properties = { ...link.properties, className: ['btn'] };
          node.children = [link];
          return;
        }
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}
