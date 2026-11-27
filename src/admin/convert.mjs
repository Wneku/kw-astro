/**
 * Edytor (/admin): konwersja treści .md ↔ HTML edytora.
 *
 *   .md → HTML: ten sam parser co strona (remark + GFM + komponenty), ale w trybie edytora
 *   HTML → .md: rehype-remark z własnymi regułami dla przycisku, ramki, kodu HTML i linków z atrybutami
 *
 * Obrazki: w pliku .md ścieżki względne (../../assets/images/…), żeby Astro je optymalizowało;
 * w edytorze adresy /__admin/file/<ścieżka w repo>.
 */
import path from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import rehypeParse from 'rehype-parse';
import rehypeRemark from 'rehype-remark';
import remarkStringify from 'remark-stringify';
import { defaultHandlers } from 'hast-util-to-mdast';
import remarkComponents from '../lib/remark-components.mjs';

export const ROOT = process.cwd();
export const FILE_PREFIX = '/__admin/file/';

const toPosix = (p) => p.split(path.sep).join('/');
const visit = (node, fn) => {
  fn(node);
  node.children?.forEach((c) => visit(c, fn));
};
const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Adres obrazka z .md → adres w edytorze */
function remarkEditorImages({ fileDir }) {
  return (tree) =>
    visit(tree, (n) => {
      if (n.type === 'image' && n.url && !/^([a-z]+:|\/\/|\/)/i.test(n.url)) {
        n.url = FILE_PREFIX + toPosix(path.relative(ROOT, path.resolve(fileDir, decodeURI(n.url))));
      }
    });
}

/** Treść .md (bez frontmattera) → HTML dla edytora */
export async function markdownToEditorHtml(md, filePath) {
  const out = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkComponents, { editor: true })
    .use(remarkEditorImages, { fileDir: path.dirname(filePath) })
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeStringify)
    .process(md);
  return String(out);
}

const has = (node, prop) => node.properties?.[prop] !== undefined && node.properties?.[prop] !== null;
const html = (value) => ({ type: 'html', value });

const handlers = {
  div(state, node) {
    if (has(node, 'dataCta')) {
      const label = String(node.properties.dataLabel ?? '');
      const href = String(node.properties.dataHref ?? '');
      return html(`<Cta label="${escAttr(label)}" href="${escAttr(href)}" />`);
    }
    if (has(node, 'dataCtaBox')) {
      const one = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
      const attrs = ['tytul', 'tekst', 'przycisk', 'href', 'link', 'linkHref']
        .map((k) => [k, one(node.properties[`data${k[0].toUpperCase()}${k.slice(1)}`])])
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}="${escAttr(v)}"`);
      return html(`<CtaBox ${attrs.join(' ')} />`);
    }
    if (has(node, 'dataRawHtml')) {
      // blok HTML w Markdown nie może mieć pustych linii (pusta linia go kończy)
      const code = String(node.properties.dataRawHtml).replace(/\r\n?/g, '\n').replace(/\n\s*\n/g, '\n').trim();
      return code ? html(code) : undefined;
    }
    return defaultHandlers.div(state, node);
  },
  aside(state, node) {
    if (has(node, 'dataRamka')) {
      const typ = String(node.properties.dataTyp || 'info');
      const tytul = node.properties.dataTytul ? ` tytul="${escAttr(node.properties.dataTytul)}"` : '';
      return [html(`<Ramka typ="${escAttr(typ)}"${tytul}>`), ...state.toFlow(state.all(node)), html('</Ramka>')];
    }
    return defaultHandlers.aside ? defaultHandlers.aside(state, node) : state.toFlow(state.all(node));
  },
  a(state, node) {
    const rel = [].concat(node.properties?.rel ?? []).flatMap((r) => String(r).split(/\s+/)).filter(Boolean);
    const blank = node.properties?.target === '_blank';
    const extra = rel.filter((r) => !['nofollow', 'sponsored', 'ugc', 'noopener', 'noreferrer'].includes(r));
    const flags = ['nofollow', 'sponsored', 'ugc'].filter((r) => rel.includes(r));
    if (!flags.length && !blank && !extra.length) return defaultHandlers.a(state, node);
    const href = String(node.properties?.href ?? '');
    const attrs = [`href="${escAttr(href)}"`, ...flags, ...(blank ? ['nowaKarta'] : []), ...(extra.length ? [`rel="${escAttr(extra.join(' '))}"`] : [])];
    return [html(`<LinkRel ${attrs.join(' ')}>`), ...state.all(node), html('</LinkRel>')];
  },
};

/** Adres obrazka z edytora → ścieżka względna w .md */
function remarkFileImages({ fileDir }) {
  return (tree) =>
    visit(tree, (n) => {
      if (n.type === 'image' && n.url?.startsWith(FILE_PREFIX)) {
        const abs = path.resolve(ROOT, decodeURI(n.url.slice(FILE_PREFIX.length)));
        let rel = toPosix(path.relative(fileDir, abs));
        if (!rel.startsWith('.')) rel = './' + rel;
        n.url = rel;
      }
    });
}

/**
 * Listy zawsze „ciasne” (<li>tekst</li>, jak w dotychczasowych treściach). Edytor trzyma tekst punktu w <p>,
 * więc bez tego każda lista dostałaby na stronie <li><p>. Luźny zostaje tylko punkt z kilkoma akapitami.
 */
function remarkTightLists() {
  return (tree) =>
    visit(tree, (n) => {
      if (n.type === 'list') n.spread = false;
      if (n.type === 'listItem') n.spread = n.children.filter((c) => c.type !== 'list').length > 1;
    });
}

/**
 * Edytor zapisuje cały pogrubiony link jako <a><strong>…</strong></a>, a na stronie `strong` ma kolor nagłówków –
 * link straciłby niebieski kolor. Zamieniamy na <strong><a>…</a></strong> (tak jak w dotychczasowych treściach).
 */
function remarkMarksOutsideLinks() {
  const isMark = (n) => n && (n.type === 'strong' || n.type === 'emphasis');
  const isOpen = (n) => n?.type === 'html' && /^<LinkRel\b/.test(n.value);
  const isClose = (n) => n?.type === 'html' && n.value === '</LinkRel>';
  return (tree) =>
    visit(tree, (node) => {
      if (!node.children) return;
      node.children = node.children.map((n) => {
        if (n.type === 'link' && n.children.length === 1 && isMark(n.children[0])) {
          const mark = n.children[0];
          return { ...mark, children: [{ ...n, children: mark.children }] };
        }
        return n;
      });
      for (let i = 0; i + 2 < node.children.length; i++) {
        const [a, m, b] = node.children.slice(i, i + 3);
        if (isOpen(a) && isMark(m) && isClose(b)) node.children.splice(i, 3, { ...m, children: [a, ...m.children, b] });
      }
    });
}

/** Obrazki w edytorze są blokami – sąsiednie obrazki nie mogą skleić się w jeden akapit */
function remarkSplitImages() {
  const onlyImages = (p) => p.type === 'paragraph' && p.children.length > 1 && p.children.every((c) => c.type === 'image' || (c.type === 'text' && !c.value.trim()));
  return (tree) =>
    visit(tree, (node) => {
      if (!node.children?.some(onlyImages)) return;
      node.children = node.children.flatMap((c) =>
        onlyImages(c) ? c.children.filter((i) => i.type === 'image').map((i) => ({ type: 'paragraph', children: [i] })) : [c],
      );
    });
}

/** HTML z edytora → treść .md */
export async function editorHtmlToMarkdown(htmlSource, filePath) {
  const out = await unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeRemark, { handlers })
    .use(remarkFileImages, { fileDir: path.dirname(filePath) })
    .use(remarkTightLists)
    .use(remarkMarksOutsideLinks)
    .use(remarkSplitImages)
    .use(remarkGfm)
    .use(remarkStringify, { bullet: '-', emphasis: '*', strong: '*', rule: '-', fences: true, listItemIndent: 'one', incrementListMarker: true })
    .process(htmlSource);
  return String(out).replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
