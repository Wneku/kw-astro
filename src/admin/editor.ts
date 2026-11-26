/**
 * Edytor treści (TipTap): pasek narzędzi, link z rel, obrazki (wklej / przeciągnij / przycisk),
 * tabele, przycisk CTA, ramka, blok kodu HTML i zakładka „HTML”.
 */
import { Editor, Node, mergeAttributes } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import { modal, esc, toast } from './ui';

export type EditorContext = {
  /** wysyła plik na serwer i zwraca adres obrazka w edytorze (albo null, gdy się nie da) */
  upload: (file: File) => Promise<string | null>;
  /** podpowiedzi adresów w oknie linku (podstrony serwisu) */
  links: () => { url: string; title: string }[];
  onChange: () => void;
};

const RAMKA_TYPY = [
  { value: 'info', label: 'Informacja' },
  { value: 'uwaga', label: 'Uwaga' },
  { value: 'wskazowka', label: 'Wskazówka' },
];

// ---------- węzły własne ----------

const Cta = Node.create({
  name: 'cta',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      label: { default: '', parseHTML: (el) => el.getAttribute('data-label') ?? '', renderHTML: (a) => ({ 'data-label': a.label }) },
      href: { default: '/kontakt/', parseHTML: (el) => el.getAttribute('data-href') ?? '', renderHTML: (a) => ({ 'data-href': a.href }) },
    };
  },
  parseHTML: () => [{ tag: 'div[data-cta]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-cta': '', class: 'adm-cta' })],
});

const Ramka = Node.create({
  name: 'ramka',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      typ: { default: 'info', parseHTML: (el) => el.getAttribute('data-typ') || 'info', renderHTML: (a) => ({ 'data-typ': a.typ }) },
      tytul: { default: '', parseHTML: (el) => el.getAttribute('data-tytul') ?? '', renderHTML: (a) => (a.tytul ? { 'data-tytul': a.tytul } : {}) },
    };
  },
  parseHTML: () => [{ tag: 'aside[data-ramka]' }],
  renderHTML: ({ node, HTMLAttributes }) => ['aside', mergeAttributes(HTMLAttributes, { 'data-ramka': '', class: `callout callout--${node.attrs.typ}` }), 0],
});

const RawHtml = Node.create({
  name: 'rawHtml',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return { html: { default: '', parseHTML: (el) => el.getAttribute('data-raw-html') ?? '', renderHTML: (a) => ({ 'data-raw-html': a.html }) } };
  },
  parseHTML: () => [{ tag: 'div[data-raw-html]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', HTMLAttributes],
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div');
      dom.className = 'adm-raw';
      const label = document.createElement('span');
      label.className = 'adm-raw__label';
      label.textContent = 'Kod HTML';
      const pre = document.createElement('pre');
      pre.textContent = node.attrs.html;
      dom.append(label, pre);
      return { dom };
    };
  },
});

// ---------- HTML ↔ edytor ----------

const BLOCK_OK = new Set(['P', 'H2', 'H3', 'H4', 'UL', 'OL', 'BLOCKQUOTE', 'PRE', 'TABLE', 'HR', 'IMG']);

/** Bloki, których edytor nie zna (iframe, div, script, h1…), zamienia na „Kod HTML” – nic nie ginie */
function protectUnknownBlocks(source: string) {
  const doc = new DOMParser().parseFromString(`<body>${source}</body>`, 'text/html');
  for (const el of [...doc.body.children]) {
    const known =
      BLOCK_OK.has(el.tagName) ||
      (el.tagName === 'DIV' && (el.hasAttribute('data-cta') || el.hasAttribute('data-raw-html'))) ||
      (el.tagName === 'ASIDE' && el.hasAttribute('data-ramka'));
    if (!known) {
      const d = doc.createElement('div');
      d.setAttribute('data-raw-html', el.outerHTML);
      el.replaceWith(d);
    }
  }
  return doc.body.innerHTML;
}

/** Czytelny HTML do zakładki „HTML” */
function prettyHtml(src: string) {
  // zawartość <pre> (bloki kodu) zostaje nietknięta
  return src
    .split(/(<pre\b[\s\S]*?<\/pre>)/)
    .map((part, i) => (i % 2 ? part : prettyPart(part)))
    .join('')
    .replace(/<\/pre>(?!\n)/g, '</pre>\n')
    .trim();
}
function prettyPart(src: string) {
  return src
    .replace(/<colgroup>.*?<\/colgroup>/g, '')
    .replace(/ style="min-width: [^"]*"/g, '')
    .replace(/ colspan="1"| rowspan="1"/g, '')
    .replace(/<(ul|ol|table|thead|tbody|tr|blockquote|aside)([^>]*)>/g, '<$1$2>\n')
    .replace(/<\/(p|h[1-6]|li|ul|ol|blockquote|pre|table|thead|tbody|tr|th|td|aside|div)>/g, '</$1>\n')
    .replace(/<(hr|img)([^>]*)>/g, '<$1$2>\n')
    .replace(/\n{2,}/g, '\n');
}

// ---------- okna ----------

async function linkDialog(editor: Editor, ctx: EditorContext) {
  const current = editor.getAttributes('link');
  const isEdit = !!current.href;
  const rels = new Set(String(current.rel ?? '').split(/\s+/).filter(Boolean));
  const { from, to, empty } = editor.state.selection;
  const needText = empty && !isEdit;
  const options = ctx
    .links()
    .map((l) => `<option value="${esc(l.url)}">${esc(l.title)}</option>`)
    .join('');
  const res = await modal({
    title: isEdit ? 'Edytuj link' : 'Wstaw link',
    body: `
      <label class="adm-f"><span>Adres URL</span>
        <input name="href" list="adm-links" required value="${esc(current.href ?? '')}" placeholder="https://… albo /oferta/audyt-seo/">
        <datalist id="adm-links">${options}</datalist></label>
      ${needText ? `<label class="adm-f"><span>Tekst linku</span><input name="text" required></label>` : ''}
      <fieldset class="adm-rel"><legend>Atrybut rel <small>– nic nie zaznaczone = zwykły link (follow)</small></legend>
        <label><input type="checkbox" name="nofollow" ${rels.has('nofollow') ? 'checked' : ''}> nofollow</label>
        <label><input type="checkbox" name="sponsored" ${rels.has('sponsored') ? 'checked' : ''}> sponsored <small>(płatny / reklama)</small></label>
        <label><input type="checkbox" name="ugc" ${rels.has('ugc') ? 'checked' : ''}> ugc <small>(treść użytkowników)</small></label>
      </fieldset>
      <label class="adm-check"><input type="checkbox" name="blank" ${current.target === '_blank' ? 'checked' : ''}> Otwórz w nowej karcie</label>`,
    actions: [...(isEdit ? [{ value: 'remove', label: 'Usuń link', kind: 'danger' as const }] : []), { value: 'ok', label: isEdit ? 'Zapisz' : 'Wstaw', kind: 'primary' as const }],
  });
  if (!res) return editor.commands.focus();
  if (res.action === 'remove') return editor.chain().focus().extendMarkRange('link').unsetLink().run();
  const href = String(res.data.href ?? '').trim();
  if (!href) return;
  const rel = ['nofollow', 'sponsored', 'ugc'].filter((r) => res.data[r]).join(' ') || null;
  const attrs = { href, rel, target: res.data.blank ? '_blank' : null };
  if (needText) {
    const text = String(res.data.text || href);
    editor.chain().focus().insertContentAt({ from, to }, { type: 'text', text, marks: [{ type: 'link', attrs }] }).run();
  } else {
    editor.chain().focus().extendMarkRange('link').setLink(attrs).run();
  }
}

async function imageDialog(editor: Editor, ctx: EditorContext, edit = false) {
  const current = edit ? editor.getAttributes('image') : {};
  const res = await modal({
    title: edit ? 'Obrazek' : 'Wstaw obrazek',
    body: `
      ${edit ? `<img class="adm-modal__img" src="${esc(current.src)}" alt="">` : ''}
      <label class="adm-f"><span>${edit ? 'Podmień plik (opcjonalnie)' : 'Plik'}</span><input type="file" name="file" accept="image/*" ${edit ? '' : 'required'}></label>
      <label class="adm-f"><span>Tekst alternatywny (alt)</span><input name="alt" value="${esc(current.alt ?? '')}" placeholder="Co jest na obrazku – ważne dla SEO i dostępności"></label>
      <p class="adm-hint">Obrazek możesz też po prostu wkleić (Ctrl+V) albo przeciągnąć do treści.</p>`,
    actions: [{ value: 'ok', label: edit ? 'Zapisz' : 'Wstaw', kind: 'primary' }],
  });
  if (!res) return editor.commands.focus();
  const file = res.files.file;
  let src = current.src;
  if (file) {
    src = await ctx.upload(file);
    if (!src) return;
  }
  const alt = String(res.data.alt ?? '').trim();
  if (edit) editor.chain().focus().updateAttributes('image', { src, alt }).run();
  else editor.chain().focus().setImage({ src, alt }).run();
}

async function ctaDialog(editor: Editor, edit = false) {
  const cur = edit ? editor.getAttributes('cta') : { label: 'Umów bezpłatną konsultację', href: '/kontakt/' };
  const res = await modal({
    title: 'Przycisk (CTA)',
    body: `
      <label class="adm-f"><span>Tekst przycisku</span><input name="label" required value="${esc(cur.label)}"></label>
      <label class="adm-f"><span>Adres</span><input name="href" required value="${esc(cur.href)}" placeholder="/kontakt/"></label>`,
    actions: [{ value: 'ok', label: edit ? 'Zapisz' : 'Wstaw', kind: 'primary' }],
  });
  if (!res) return editor.commands.focus();
  const attrs = { label: String(res.data.label), href: String(res.data.href) };
  if (edit) editor.chain().focus().updateAttributes('cta', attrs).run();
  else editor.chain().focus().insertContent({ type: 'cta', attrs }).run();
}

async function rawDialog(editor: Editor, edit = false) {
  const cur = edit ? editor.getAttributes('rawHtml').html : '';
  const res = await modal({
    title: 'Kod HTML',
    body: `
      <label class="adm-f"><span>Kod wstawiany 1:1 na stronę (iframe, embed, tabela z klasami…)</span>
        <textarea name="html" rows="12" class="adm-code" spellcheck="false">${esc(cur)}</textarea></label>`,
    actions: [{ value: 'ok', label: edit ? 'Zapisz' : 'Wstaw', kind: 'primary' }],
    wide: true,
  });
  if (!res) return editor.commands.focus();
  const html = String(res.data.html ?? '').trim();
  if (!html) return;
  if (edit) editor.chain().focus().updateAttributes('rawHtml', { html }).run();
  else editor.chain().focus().insertContent({ type: 'rawHtml', attrs: { html } }).run();
}

async function ramkaDialog(editor: Editor, edit = false) {
  const cur = edit ? editor.getAttributes('ramka') : { typ: 'info', tytul: '' };
  const res = await modal({
    title: 'Ramka',
    body: `
      <label class="adm-f"><span>Rodzaj</span><select name="typ">${RAMKA_TYPY.map((t) => `<option value="${t.value}" ${t.value === cur.typ ? 'selected' : ''}>${t.label}</option>`).join('')}</select></label>
      <label class="adm-f"><span>Tytuł (opcjonalnie)</span><input name="tytul" value="${esc(cur.tytul ?? '')}"></label>
      ${edit ? '' : '<p class="adm-hint">Zaznaczony tekst trafi do ramki. Treść ramki piszesz normalnie w edytorze.</p>'}`,
    actions: [...(edit ? [{ value: 'remove', label: 'Usuń ramkę (zostaw treść)', kind: 'danger' as const }] : []), { value: 'ok', label: edit ? 'Zapisz' : 'Wstaw', kind: 'primary' as const }],
  });
  if (!res) return editor.commands.focus();
  if (res.action === 'remove') return editor.chain().focus().lift('ramka').run();
  const attrs = { typ: String(res.data.typ), tytul: String(res.data.tytul ?? '').trim() };
  if (edit) editor.chain().focus().updateAttributes('ramka', attrs).run();
  else editor.chain().focus().wrapIn('ramka', attrs).run();
}

// ---------- pasek narzędzi ----------

type Btn = { id: string; label: string; title: string; run: () => unknown; active?: () => boolean; enabled?: () => boolean };

export function createEditor(mount: HTMLElement, html: string, ctx: EditorContext) {
  mount.innerHTML = `
    <div class="adm-editor">
      <div class="adm-toolbar">
        <div class="adm-tabs"><button type="button" data-tab="visual" class="is-active">Wizualny</button><button type="button" data-tab="html">HTML</button></div>
        <div class="adm-tools"></div>
      </div>
      <div class="adm-context" hidden></div>
      <div class="adm-surface"></div>
      <textarea class="adm-source adm-code" spellcheck="false" hidden></textarea>
    </div>`;
  const tools = mount.querySelector<HTMLElement>('.adm-tools')!;
  const context = mount.querySelector<HTMLElement>('.adm-context')!;
  const surface = mount.querySelector<HTMLElement>('.adm-surface')!;
  const source = mount.querySelector<HTMLTextAreaElement>('.adm-source')!;

  const insertFiles = async (files: File[], pos?: number) => {
    for (const file of files) {
      const src = await ctx.upload(file);
      if (!src) continue;
      const content = { type: 'image', attrs: { src, alt: '' } };
      if (pos !== undefined) editor.chain().focus().insertContentAt(pos, content).run();
      else editor.chain().focus().insertContent(content).run();
      // od razu pytamy o alt (nazwy plików są unikalne, więc szukamy po adresie)
      let at = -1;
      editor.state.doc.descendants((n, p) => {
        if (n.type.name === 'image' && n.attrs.src === src) at = p;
      });
      if (at >= 0) editor.commands.setNodeSelection(at);
      if (editor.isActive('image')) await imageDialog(editor, ctx, true);
    }
  };
  const imageFiles = (list?: FileList | null) => [...(list ?? [])].filter((f) => f.type.startsWith('image/'));

  const editor = new Editor({
    element: surface,
    content: protectUnknownBlocks(html),
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        underline: false,
        link: {
          openOnClick: false,
          autolink: false,
          linkOnPaste: true,
          HTMLAttributes: { rel: null, target: null, class: null },
        },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({ placeholder: 'Zacznij pisać… (obrazek: wklej Ctrl+V albo przeciągnij plik)' }),
      Cta,
      Ramka,
      RawHtml,
    ],
    editorProps: {
      attributes: { class: 'prose adm-prose' },
      handlePaste(_view, event) {
        const files = imageFiles(event.clipboardData?.files);
        if (!files.length) return false;
        event.preventDefault();
        insertFiles(files);
        return true;
      },
      handleDrop(view, event, _slice, moved) {
        if (moved) return false;
        const files = imageFiles(event.dataTransfer?.files);
        if (!files.length) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        insertFiles(files, pos);
        return true;
      },
      handleDoubleClickOn(_view, _pos, node) {
        if (node.type.name === 'image') imageDialog(editor, ctx, true);
        else if (node.type.name === 'cta') ctaDialog(editor, true);
        else if (node.type.name === 'rawHtml') rawDialog(editor, true);
        else return false;
        return true;
      },
    },
    onUpdate: () => ctx.onChange(),
    onSelectionUpdate: () => refresh(),
    onTransaction: () => refresh(),
  });

  const c = () => editor.chain().focus();
  const groups: (Btn[] | 'block')[] = [
    'block',
    [
      { id: 'bold', label: '<b>B</b>', title: 'Pogrubienie (Ctrl+B)', run: () => c().toggleBold().run(), active: () => editor.isActive('bold') },
      { id: 'italic', label: '<i>I</i>', title: 'Kursywa (Ctrl+I)', run: () => c().toggleItalic().run(), active: () => editor.isActive('italic') },
      { id: 'strike', label: '<s>S</s>', title: 'Przekreślenie', run: () => c().toggleStrike().run(), active: () => editor.isActive('strike') },
      { id: 'code', label: '<code>&lt;/&gt;</code>', title: 'Kod w tekście', run: () => c().toggleCode().run(), active: () => editor.isActive('code') },
    ],
    [
      { id: 'link', label: '🔗 Link', title: 'Link – adres, follow / nofollow / sponsored / ugc (Ctrl+K)', run: () => linkDialog(editor, ctx), active: () => editor.isActive('link') },
      { id: 'image', label: '🖼 Obrazek', title: 'Wstaw obrazek (albo wklej / przeciągnij)', run: () => imageDialog(editor, ctx) },
    ],
    [
      { id: 'ul', label: '• Lista', title: 'Lista punktowana', run: () => c().toggleBulletList().run(), active: () => editor.isActive('bulletList') },
      { id: 'ol', label: '1. Lista', title: 'Lista numerowana', run: () => c().toggleOrderedList().run(), active: () => editor.isActive('orderedList') },
      { id: 'quote', label: '❝', title: 'Cytat', run: () => c().toggleBlockquote().run(), active: () => editor.isActive('blockquote') },
      { id: 'table', label: '▦ Tabela', title: 'Wstaw tabelę', run: () => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    ],
    [
      { id: 'cta', label: 'Przycisk', title: 'Przycisk CTA', run: () => ctaDialog(editor) },
      { id: 'ramka', label: 'Ramka', title: 'Ramka: informacja / uwaga / wskazówka', run: () => ramkaDialog(editor), active: () => editor.isActive('ramka') },
      { id: 'raw', label: '&lt;HTML&gt;', title: 'Blok kodu HTML (embed, iframe…)', run: () => rawDialog(editor) },
      { id: 'pre', label: '{ }', title: 'Blok kodu (wyświetlany jako kod)', run: () => c().toggleCodeBlock().run(), active: () => editor.isActive('codeBlock') },
      { id: 'hr', label: '―', title: 'Linia pozioma', run: () => c().setHorizontalRule().run() },
    ],
    [
      { id: 'undo', label: '↶', title: 'Cofnij (Ctrl+Z)', run: () => c().undo().run(), enabled: () => editor.can().undo() },
      { id: 'redo', label: '↷', title: 'Ponów (Ctrl+Y)', run: () => c().redo().run(), enabled: () => editor.can().redo() },
    ],
  ];

  const blockSelect = document.createElement('select');
  blockSelect.className = 'adm-block';
  blockSelect.title = 'Styl akapitu';
  blockSelect.innerHTML = `<option value="p">Akapit</option><option value="2">Nagłówek H2</option><option value="3">Nagłówek H3</option><option value="4">Nagłówek H4</option>`;
  blockSelect.addEventListener('change', () => {
    const v = blockSelect.value;
    if (v === 'p') c().setParagraph().run();
    else c().setHeading({ level: Number(v) as 2 | 3 | 4 }).run();
  });

  const buttons: { btn: HTMLButtonElement; def: Btn }[] = [];
  for (const g of groups) {
    const wrap = document.createElement('div');
    wrap.className = 'adm-group';
    if (g === 'block') wrap.append(blockSelect);
    else
      for (const def of g) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.innerHTML = def.label;
        btn.title = def.title;
        btn.addEventListener('mousedown', (e) => e.preventDefault());
        btn.addEventListener('click', () => def.run());
        buttons.push({ btn, def });
        wrap.append(btn);
      }
    tools.append(wrap);
  }

  // pasek kontekstowy: co jest zaznaczone i co można z tym zrobić
  const ctxBtn = (label: string, run: () => unknown, kind = '') =>
    Object.assign(document.createElement('button'), { type: 'button', innerHTML: label, className: kind, onclick: run, onmousedown: (e: Event) => e.preventDefault() });

  function refresh() {
    for (const { btn, def } of buttons) {
      btn.classList.toggle('is-active', !!def.active?.());
      btn.disabled = def.enabled ? !def.enabled() : false;
    }
    const h = [2, 3, 4].find((l) => editor.isActive('heading', { level: l }));
    blockSelect.value = h ? String(h) : 'p';

    context.replaceChildren();
    const sel = editor.state.selection;
    const node = sel instanceof NodeSelection ? sel.node : null;
    const info = (html: string) => Object.assign(document.createElement('span'), { className: 'adm-context__info', innerHTML: html });
    if (node?.type.name === 'image') {
      context.append(
        info(`<b>Obrazek</b> alt: ${node.attrs.alt ? esc(node.attrs.alt) : '<em class="adm-warn">brak – uzupełnij</em>'}`),
        ctxBtn('Edytuj alt / podmień', () => imageDialog(editor, ctx, true)),
        ctxBtn('Usuń', () => c().deleteSelection().run(), 'danger'),
      );
    } else if (node?.type.name === 'cta') {
      context.append(info(`<b>Przycisk</b> „${esc(node.attrs.label)}” → ${esc(node.attrs.href)}`), ctxBtn('Edytuj', () => ctaDialog(editor, true)), ctxBtn('Usuń', () => c().deleteSelection().run(), 'danger'));
    } else if (node?.type.name === 'rawHtml') {
      context.append(info('<b>Kod HTML</b>'), ctxBtn('Edytuj kod', () => rawDialog(editor, true)), ctxBtn('Usuń', () => c().deleteSelection().run(), 'danger'));
    } else if (editor.isActive('link')) {
      const a = editor.getAttributes('link');
      const rel = String(a.rel ?? '').trim();
      context.append(
        info(`<b>Link</b> ${esc(a.href)} · <span class="adm-tag ${rel ? 'adm-tag--nf' : ''}">${rel ? esc(rel) : 'follow'}</span>${a.target === '_blank' ? ' · nowa karta' : ''}`),
        ctxBtn('Edytuj', () => linkDialog(editor, ctx)),
        ctxBtn('Otwórz', () => window.open(a.href, '_blank')),
        ctxBtn('Usuń link', () => c().extendMarkRange('link').unsetLink().run(), 'danger'),
      );
    }
    if (editor.isActive('table')) {
      context.append(
        info('<b>Tabela</b>'),
        ctxBtn('+ wiersz', () => c().addRowAfter().run()),
        ctxBtn('+ kolumna', () => c().addColumnAfter().run()),
        ctxBtn('− wiersz', () => c().deleteRow().run()),
        ctxBtn('− kolumna', () => c().deleteColumn().run()),
        ctxBtn('Usuń tabelę', () => c().deleteTable().run(), 'danger'),
      );
    }
    if (editor.isActive('ramka') && !node) {
      const r = editor.getAttributes('ramka');
      context.append(
        info(`<b>Ramka</b> ${esc(RAMKA_TYPY.find((t) => t.value === r.typ)?.label ?? r.typ)}${r.tytul ? ` – „${esc(r.tytul)}”` : ''}`),
        ctxBtn('Ustawienia ramki', () => ramkaDialog(editor, true)),
      );
    }
    context.hidden = !context.children.length;
  }

  // Ctrl+K = link
  surface.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      linkDialog(editor, ctx);
    }
  });

  // zakładki Wizualny / HTML
  let mode: 'visual' | 'html' = 'visual';
  const tabs = mount.querySelectorAll<HTMLButtonElement>('[data-tab]');
  const setMode = (m: 'visual' | 'html') => {
    if (m === mode) return;
    if (m === 'html') {
      source.value = prettyHtml(editor.getHTML());
    } else {
      editor.commands.setContent(protectUnknownBlocks(source.value), { emitUpdate: true });
    }
    mode = m;
    tabs.forEach((t) => t.classList.toggle('is-active', t.dataset.tab === m));
    surface.hidden = m === 'html';
    source.hidden = m !== 'html';
    tools.classList.toggle('is-disabled', m === 'html');
    context.hidden = true;
    if (m === 'html') {
      source.style.height = Math.max(400, surface.offsetHeight || 0) + 'px';
      source.focus();
    } else refresh();
  };
  tabs.forEach((t) => t.addEventListener('click', () => setMode(t.dataset.tab as 'visual' | 'html')));
  source.addEventListener('input', () => ctx.onChange());

  refresh();

  return {
    editor,
    /** HTML do zapisu (z zakładki HTML też) */
    getHTML() {
      if (mode === 'html') editor.commands.setContent(protectUnknownBlocks(source.value), { emitUpdate: false });
      return editor.getHTML();
    },
    destroy() {
      editor.destroy();
    },
    toast,
  };
}
