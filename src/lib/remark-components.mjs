/**
 * Komponenty w treści (.md) → HTML strony.
 *
 * Edytor (/admin) zapisuje przyciski, ramki i linki z atrybutami jako tagi w pliku .md.
 * Parser Markdown widzi je jako zwykłe węzły HTML, więc zamieniamy je na elementy, zanim trafią do rehype:
 *
 *   <Cta label="Umów rozmowę" href="/kontakt/" />          → <p class="cta"><a class="btn" href="/kontakt/">Umów rozmowę</a></p>
 *   <CtaBox tytul="…" tekst="…" przycisk="Umów rozmowę" href="/kontakt/" link="Oferta" linkHref="/oferta/" />
 *                                                           → <aside class="cta-box">nagłówek, opis, przycisk i opcjonalny link</aside>
 *   <Ramka typ="info" tytul="Ważne">…treść…</Ramka>          → <aside class="callout callout--info"><p class="callout__title">Ważne</p>…</aside>
 *   <LinkRel href="https://x.pl" nofollow nowaKarta>tekst</LinkRel>
 *                                                           → <a href="https://x.pl" rel="nofollow noopener" target="_blank">tekst</a>
 *
 * Opcja `{ editor: true }` (używa jej tylko edytor) zamiast HTML strony daje znaczniki, które rozumie edytor
 * (div[data-cta], div[data-cta-box], aside[data-ramka], div[data-raw-html] dla dowolnego innego bloku HTML).
 */

/** Atrybuty JSX: name="…", name={"…"}, name={true}, name (bez wartości = true) */
export function parseAttrs(src) {
  const attrs = {};
  const re = /([A-Za-z_][\w-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\}))?/g;
  let m;
  while ((m = re.exec(src))) {
    const [, name, dq, sq, expr] = m;
    if (dq !== undefined) attrs[name] = decode(dq);
    else if (sq !== undefined) attrs[name] = decode(sq);
    else if (expr !== undefined) {
      try {
        attrs[name] = JSON.parse(expr);
      } catch {
        attrs[name] = expr;
      }
    } else attrs[name] = true;
  }
  return attrs;
}
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const tagRe = (name, kind) =>
  kind === 'self' ? new RegExp(`^<${name}\\b([^>]*?)\\/>\\s*$`) : kind === 'open' ? new RegExp(`^<${name}\\b([^>]*)>\\s*$`) : new RegExp(`^<\\/${name}>\\s*$`);

const RAMKA_TYPY = new Set(['info', 'uwaga', 'wskazowka']);

const dedent = (text) => {
  const lines = text.replace(/^\n+|\s+$/g, '').split('\n');
  const min = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  return lines.map((l) => l.slice(Number.isFinite(min) ? min : 0)).join('\n');
};

/** rel z atrybutów LinkRel: nofollow / sponsored / ugc jako osobne atrybuty albo rel="…" */
export function linkRelProps(attrs) {
  const { rel = '', nowaKarta } = attrs;
  const rels = new Set(String(rel).split(/[\s,]+/).filter(Boolean));
  for (const t of ['nofollow', 'sponsored', 'ugc']) if (attrs[t] === true) rels.add(t);
  const props = {};
  if (nowaKarta === true) {
    props.target = '_blank';
    rels.add('noopener');
  }
  if (rels.size) props.rel = [...rels].join(' ');
  return props;
}

export default function remarkComponents(options = {}) {
  const editor = options.editor === true;
  const processor = this;

  const ramka = (attrs, children) => {
    const { typ, tytul } = attrs;
    const variant = RAMKA_TYPY.has(typ) ? typ : 'info';
    if (editor) {
      return {
        type: 'blockquote',
        data: { hName: 'aside', hProperties: { dataRamka: '', dataTyp: variant, ...(tytul ? { dataTytul: tytul } : {}) } },
        children,
      };
    }
    return {
      type: 'blockquote',
      data: { hName: 'aside', hProperties: { className: ['callout', `callout--${variant}`] } },
      children: [
        ...(tytul ? [{ type: 'paragraph', data: { hProperties: { className: ['callout__title'] } }, children: [{ type: 'text', value: tytul }] }] : []),
        ...children,
      ],
    };
  };

  const ctaBox = (attrs) => {
    const str = (v) => (typeof v === 'string' ? v : '');
    const a = { tytul: str(attrs.tytul), tekst: str(attrs.tekst), przycisk: str(attrs.przycisk), href: str(attrs.href) || '/kontakt/', link: str(attrs.link), linkHref: str(attrs.linkHref) };
    if (editor) {
      const props = { dataCtaBox: '' };
      for (const [k, v] of Object.entries(a)) if (v) props[`data${k[0].toUpperCase()}${k.slice(1)}`] = v;
      return { type: 'ctaBox', data: { hName: 'div', hProperties: props } };
    }
    const p = (cls, children) => ({ type: 'paragraph', data: { hProperties: { className: [cls] } }, children });
    const text = (value) => ({ type: 'text', value });
    const link = (url, cls, children) => ({ type: 'link', url, data: { hProperties: { className: [cls] } }, children });
    const actions = [];
    if (a.przycisk) actions.push(link(a.href, 'cta-box__btn', [text(a.przycisk)]));
    if (a.link && a.linkHref)
      actions.push(link(a.linkHref, 'cta-box__link', [text(a.link + ' '), { type: 'ctaArrow', data: { hName: 'span', hProperties: { ariaHidden: 'true' } }, children: [text('→')] }]));
    return {
      type: 'ctaBox',
      data: { hName: 'aside', hProperties: { className: ['cta-box'] } },
      children: [...(a.tytul ? [p('cta-box__title', [text(a.tytul)])] : []), ...(a.tekst ? [p('cta-box__text', [text(a.tekst)])] : []), ...(actions.length ? [p('cta-box__actions', actions)] : [])],
    };
  };

  return (tree, file) => {
    const source = typeof file?.value === 'string' ? file.value : String(file?.value ?? '');

    const visit = (node, isFlow) => {
      if (!Array.isArray(node.children)) return;
      const out = [];
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];

        if (child.type === 'html') {
          // <Cta ... />
          const cta = child.value.match(tagRe('Cta', 'self'));
          if (cta) {
            const { label = '', href = '#' } = parseAttrs(cta[1]);
            out.push(
              editor
                ? { type: 'ctaBlock', data: { hName: 'div', hProperties: { dataCta: '', dataLabel: label, dataHref: href } } }
                : {
                    type: 'paragraph',
                    data: { hProperties: { className: ['cta'] } },
                    children: [{ type: 'link', url: href, data: { hProperties: { className: ['btn'] } }, children: [{ type: 'text', value: label }] }],
                  },
            );
            continue;
          }

          // <CtaBox ... />
          const box = child.value.match(tagRe('CtaBox', 'self'));
          if (box) {
            out.push(ctaBox(parseAttrs(box[1])));
            continue;
          }

          // <Ramka ...> … </Ramka>
          // Blok HTML w Markdown kończy się na pustej linii, więc parser tnie ramkę na kawałki.
          // Dlatego bierzemy cały fragment ze źródła i parsujemy go od nowa jako Markdown.
          const start = child.position?.start?.offset;
          if (/^<Ramka\b/.test(child.value) && source && start !== undefined) {
            const open = source.slice(start).match(/^<Ramka\b([^>]*)>/);
            const innerStart = open ? start + open[0].length : -1;
            const closeAt = open ? source.indexOf('</Ramka>', innerStart) : -1;
            if (open && closeAt !== -1) {
              const closeEnd = closeAt + '</Ramka>'.length;
              let j = i + 1;
              while (j < node.children.length && (node.children[j].position?.start?.offset ?? Infinity) < closeEnd) j++;
              const inner = dedent(source.slice(innerStart, closeAt));
              const parsed = processor.parse(inner);
              // pozycje w zagnieżdżonym drzewie dotyczą fragmentu, nie całego pliku – podmieniamy źródło na czas obróbki
              const wrapper = ramka(parseAttrs(open[1]), parsed.children);
              const saved = file.value;
              file.value = inner;
              visit(wrapper, true);
              file.value = saved;
              out.push(wrapper);
              i = j - 1;
              continue;
            }
          }

          // <LinkRel ...> … </LinkRel>  (w tekście)
          const lr = child.value.match(tagRe('LinkRel', 'open'));
          if (lr) {
            const end = node.children.findIndex((c, j) => j > i && c.type === 'html' && tagRe('LinkRel', 'close').test(c.value));
            if (end !== -1) {
              const attrs = parseAttrs(lr[1]);
              // tekst linku będący adresem (https://…, e-mail) parser sam zamienia w link – spłaszczamy, żeby nie było <a> w <a>
              const unwrap = (nodes) => nodes.flatMap((n) => (n.type === 'link' ? unwrap(n.children) : [{ ...n, ...(n.children ? { children: unwrap(n.children) } : {}) }]));
              out.push({ type: 'link', url: attrs.href ?? '#', data: { hProperties: linkRelProps(attrs) }, children: unwrap(node.children.slice(i + 1, end)) });
              i = end;
              continue;
            }
          }

          // Tag z wielkiej litery = komponent edytora. Nieobsłużony (np. wpis używa bloku, którego ta wersja kodu
          // jeszcze nie ma) zatrzymuje build – na serwer nie trafi strona z surowym tagiem.
          if (/^<\/?[A-Z]/.test(child.value)) {
            const msg = `Nierozpoznany komponent: ${child.value.slice(0, 60)}`;
            if (editor) file.message(msg, child);
            else file.fail(`${msg}\nTa wersja strony go nie obsługuje albo ma błąd w zapisie. Jeśli to nowy blok z edytora, najpierw wdróż kod (npm run wdroz).`, child);
          } else if (editor && isFlow) {
            // dowolny inny blok HTML (np. iframe, embed) – w edytorze jako blok „Kod HTML”, na stronie bez zmian
            out.push({ type: 'rawHtml', data: { hName: 'div', hProperties: { dataRawHtml: child.value } } });
            continue;
          }
        }

        visit(child, child.type === 'blockquote' || child.type === 'listItem');
        out.push(child);
      }
      node.children = out;
    };
    visit(tree, true);
  };
}
