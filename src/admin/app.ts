/**
 * Edytor treści kamilwnek.pl (/admin, tylko lokalnie w `npm run dev`).
 * Lista wpisów, formularz pól (fields.ts), edytor treści (editor.ts), zapis, podgląd, publikacja.
 */
import { COLLECTIONS, type Field, type Collection } from './fields';
import { createEditor } from './editor';
import { modal, esc, toast, confirmBox } from './ui';
import { slugify } from '../lib/slugify.mjs';

type ListItem = { slug: string; title: string; draft: boolean; date: string | null; url: string };
type Lists = Record<string, ListItem[]>;
type Entry = { collection: string; slug: string; mtime: number; fileDir: string; url: string; data: Record<string, any>; html: string | null };

const FILE_PREFIX = '/__admin/file/';
const SITE = 'https://kamilwnek.pl';
const NEW = '~nowy';

async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch('/__admin/api/' + path, init);
  const j = await r.json().catch(() => ({ error: `Błąd serwera (${r.status})` }));
  if (!r.ok) throw Object.assign(new Error(j.error || r.statusText), { status: r.status });
  return j;
}
const post = <T = any>(path: string, body: unknown) => api<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;
const today = () => new Date().toLocaleDateString('sv-SE');
const isEmpty = (v: unknown) => v === undefined || v === null || v === '' || v === false || (Array.isArray(v) && v.length === 0);
/** ścieżka z pliku .md (np. ../../assets/…) → adres obrazka w edytorze */
const fileUrl = (fileDir: string, rel: string) => {
  if (!rel) return '';
  if (/^(https?:)?\/\//.test(rel)) return rel;
  return FILE_PREFIX + new URL(rel, `http://x/${fileDir}/`).pathname.slice(1);
};

let lists: Lists = {};
let current: View | null = null;

// ---------- pola formularza ----------

type Getter = () => unknown;

function counter(input: HTMLInputElement | HTMLTextAreaElement, max: number) {
  const el = document.createElement('span');
  el.className = 'adm-count';
  const upd = () => {
    const n = input.value.length;
    el.textContent = `${n} / ${max}`;
    el.classList.toggle('is-over', n > max);
  };
  input.addEventListener('input', upd);
  upd();
  return el;
}

function renderField(f: Field, value: any, ctx: FieldCtx): { el: HTMLElement; get?: Getter; validate?: () => string | null } {
  const wrap = document.createElement('div');
  wrap.className = 'adm-field';
  if (f.type === 'heading') {
    wrap.className = 'adm-field-heading';
    wrap.textContent = f.label;
    return { el: wrap };
  }
  const label = `<span class="adm-field__label">${esc(f.label)}${'required' in f && f.required ? ' <i>*</i>' : ''}</span>`;
  const help = 'help' in f && f.help ? `<small class="adm-field__help">${esc(f.help)}</small>` : '';
  const required = (get: Getter) => () => ('required' in f && f.required && isEmpty(get()) ? `Uzupełnij pole „${f.label}”.` : null);

  switch (f.type) {
    case 'text':
    case 'textarea':
    case 'markdown': {
      wrap.innerHTML = `<label>${label}${
        f.type === 'text' ? `<input type="text">` : `<textarea rows="${f.rows ?? 3}"${f.type === 'markdown' ? ' class="adm-mono"' : ''}></textarea>`
      }</label>${help}`;
      const input = wrap.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')!;
      input.value = value == null ? '' : String(value);
      if (f.max) wrap.querySelector('label')!.append(counter(input, f.max));
      const get = () => (f.type === 'text' ? input.value.trim() : input.value.replace(/\s+$/, '')) || undefined;
      return { el: wrap, get, validate: required(get) };
    }
    case 'number': {
      wrap.innerHTML = `<label>${label}<input type="number" step="any"></label>${help}`;
      const input = $<HTMLInputElement>('input', wrap);
      input.value = value == null ? '' : String(value);
      const get = () => (input.value === '' ? undefined : Number(input.value));
      return { el: wrap, get, validate: required(get) };
    }
    case 'date': {
      wrap.innerHTML = `<label>${label}<span class="adm-row"><input type="date"><button type="button" class="adm-small">dziś</button></span></label>${help}`;
      const input = $<HTMLInputElement>('input', wrap);
      input.value = value ? String(value).slice(0, 10) : '';
      $('button', wrap).addEventListener('click', () => {
        input.value = today();
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      const get = () => input.value || undefined;
      return { el: wrap, get, validate: required(get) };
    }
    case 'checkbox': {
      wrap.innerHTML = `<label class="adm-check"><input type="checkbox"> ${esc(f.label)}</label>${help}`;
      const input = $<HTMLInputElement>('input', wrap);
      input.checked = value === true;
      return { el: wrap, get: () => input.checked };
    }
    case 'select': {
      wrap.innerHTML = `<label>${label}<select>${f.options.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}</select></label>${help}`;
      const input = $<HTMLSelectElement>('select', wrap);
      input.value = value == null ? f.options[0]?.value ?? '' : String(value);
      return { el: wrap, get: () => input.value || undefined };
    }
    case 'categories': {
      const selected: string[] = Array.isArray(value) ? value : [];
      const all = lists.kategorie ?? [];
      wrap.innerHTML = `<span class="adm-field__label">${esc(f.label)}</span><div class="adm-cats">${all
        .map((k) => `<label class="adm-check"><input type="checkbox" value="${esc(k.slug)}" ${selected.includes(k.slug) ? 'checked' : ''}> ${esc(k.title)}</label>`)
        .join('')}</div>`;
      const get = () => {
        const checked = [...wrap.querySelectorAll<HTMLInputElement>('input:checked')].map((i) => i.value);
        // kolejność jak w pliku (pierwsza kategoria = główna), nowe na końcu
        return [...selected.filter((s) => checked.includes(s)), ...checked.filter((s) => !selected.includes(s))];
      };
      return { el: wrap, get };
    }
    case 'image': {
      let path: string = value ?? '';
      wrap.innerHTML = `<span class="adm-field__label">${esc(f.label)}</span>
        <div class="adm-image"><div class="adm-image__preview"></div>
        <div class="adm-row"><button type="button" data-pick>Wybierz plik…</button><button type="button" data-clear class="danger">Usuń</button></div>
        <input type="file" accept="image/*" hidden></div>${help}`;
      const preview = $('.adm-image__preview', wrap);
      const file = $<HTMLInputElement>('input[type=file]', wrap);
      const show = () => {
        preview.innerHTML = path ? `<img src="${esc(fileUrl(ctx.fileDir, path))}" alt="">` : '<span>Brak obrazka – kliknij „Wybierz plik…” albo przeciągnij tutaj</span>';
        $('[data-clear]', wrap).hidden = !path;
      };
      const upload = async (f: File) => {
        const r = await ctx.upload(f, true);
        if (r) {
          path = r.path;
          show();
          wrap.dispatchEvent(new Event('input', { bubbles: true }));
        }
      };
      $('[data-pick]', wrap).addEventListener('click', () => file.click());
      file.addEventListener('change', () => file.files?.[0] && upload(file.files[0]));
      $('[data-clear]', wrap).addEventListener('click', () => {
        path = '';
        show();
        wrap.dispatchEvent(new Event('input', { bubbles: true }));
      });
      preview.addEventListener('dragover', (e) => e.preventDefault());
      preview.addEventListener('drop', (e) => {
        e.preventDefault();
        const f = e.dataTransfer?.files?.[0];
        if (f) upload(f);
      });
      show();
      return { el: wrap, get: () => path || undefined };
    }
    case 'list': {
      const items: { el: HTMLElement; get: Getter; validate: () => string | null }[] = [];
      wrap.className = 'adm-field adm-list';
      wrap.innerHTML = `<div class="adm-list__items"></div><button type="button" class="adm-small" data-add>+ ${esc(f.addLabel)}</button>`;
      const box = $('.adm-list__items', wrap);
      const add = (item: Record<string, any> = {}, open = false) => {
        const card = document.createElement('details');
        card.className = 'adm-card';
        card.open = open;
        card.innerHTML = `<summary><span class="adm-card__title"></span><span class="adm-card__tools">
          <button type="button" data-up title="W górę">↑</button><button type="button" data-down title="W dół">↓</button><button type="button" data-del class="danger" title="Usuń">✕</button></span></summary>
          <div class="adm-card__body"></div>`;
        const body = $('.adm-card__body', card);
        const subs = f.fields.map((sf) => ({ sf, ...renderField(sf, item['name' in sf ? sf.name : ''], ctx) }));
        subs.forEach((s) => body.append(s.el));
        const titleEl = $('.adm-card__title', card);
        const updTitle = () => {
          const t = subs.find((s) => 'name' in s.sf && s.sf.name === f.titleField)?.get?.();
          titleEl.textContent = t ? String(t) : '(bez nazwy)';
        };
        card.addEventListener('input', updTitle);
        updTitle();
        const entry = {
          el: card,
          get: () => {
            // pola spoza formularza (np. id pytania FAQ) zostają
            const out: Record<string, any> = { ...item };
            for (const s of subs) {
              if (!('name' in s.sf) || !s.get) continue;
              const v = s.get();
              if (isEmpty(v)) delete out[s.sf.name];
              else out[s.sf.name] = v;
            }
            return out;
          },
          validate: () => subs.map((s) => s.validate?.()).find(Boolean) ?? null,
        };
        const move = (d: number) => {
          const i = items.indexOf(entry);
          const j = i + d;
          if (j < 0 || j >= items.length) return;
          items.splice(i, 1);
          items.splice(j, 0, entry);
          items.forEach((it) => box.append(it.el));
          wrap.dispatchEvent(new Event('input', { bubbles: true }));
        };
        const stop = (fn: () => void) => (e: Event) => {
          e.preventDefault();
          fn();
        };
        $('[data-up]', card).addEventListener('click', stop(() => move(-1)));
        $('[data-down]', card).addEventListener('click', stop(() => move(1)));
        $('[data-del]', card).addEventListener(
          'click',
          stop(async () => {
            if (!(await confirmBox('Usunąć?', `Usunąć „${esc(titleEl.textContent)}”?`, 'Usuń', 'danger'))) return;
            items.splice(items.indexOf(entry), 1);
            card.remove();
            wrap.dispatchEvent(new Event('input', { bubbles: true }));
          }),
        );
        items.push(entry);
        box.append(card);
      };
      (Array.isArray(value) ? value : []).forEach((it) => add(it));
      $('[data-add]', wrap).addEventListener('click', () => {
        add({}, true);
        wrap.dispatchEvent(new Event('input', { bubbles: true }));
        box.lastElementChild?.querySelector<HTMLElement>('input, textarea')?.focus();
      });
      return { el: wrap, get: () => items.map((i) => i.get()), validate: () => items.map((i) => i.validate()).find(Boolean) ?? null };
    }
  }
}

type FieldCtx = { fileDir: string; upload: (f: File, cover?: boolean) => Promise<{ url: string; path: string } | null> };

// ---------- widok wpisu ----------

class View {
  dirtyBody = false;
  saved = '';
  getters: Record<string, Getter> = {};
  validators: (() => string | null)[] = [];
  editor: ReturnType<typeof createEditor> | null = null;
  slugTouched = false;
  root!: HTMLElement;
  title!: HTMLInputElement;
  slug!: HTMLInputElement;

  constructor(
    public collection: string,
    public def: Collection,
    public entry: Entry | null,
  ) {}

  get isNew() {
    return !this.entry;
  }
  get originalSlug() {
    return this.entry?.slug ?? null;
  }
  get fileDir() {
    return this.entry?.fileDir ?? `src/content/${this.collection}`;
  }

  render(main: HTMLElement) {
    const { def } = this;
    const data = this.entry?.data ?? this.defaults();
    main.innerHTML = `
      <div class="adm-entry">
        <div class="adm-bar">
          <div class="adm-bar__crumb">${esc(def.label)} › <b></b></div>
          <span class="adm-dirty" hidden>● niezapisane zmiany</span>
          <button type="button" data-preview>Podgląd ↗</button>
          <button type="button" data-save class="primary">Zapisz <kbd>Ctrl+S</kbd></button>
        </div>
        <div class="adm-cols${def.body ? '' : ' adm-cols--nobody'}">
          <div class="adm-col-main">
            <input class="adm-title" placeholder="${esc(def.titleLabel)}">
            <div class="adm-slug"><span>Adres:</span> <span class="adm-slug__prefix">${esc(SITE + def.urlPrefix)}</span><input spellcheck="false"><span>/</span>
              <button type="button" class="adm-small" data-slug-edit hidden>zmień</button></div>
            <div class="adm-editor-mount"></div>
          </div>
          <aside class="adm-col-side"></aside>
        </div>
      </div>`;
    this.root = $('.adm-entry', main);
    this.title = $<HTMLInputElement>('.adm-title', main);
    this.slug = $<HTMLInputElement>('.adm-slug input', main);
    this.title.value = data[def.titleField] ?? '';
    this.slug.value = this.entry?.slug ?? '';
    $('.adm-bar__crumb b', main).textContent = this.title.value || def.newLabel || '';

    // adres: nowy wpis – z tytułu; istniejący – zablokowany (zmiana adresu = nowy URL)
    const slugEdit = $('[data-slug-edit]', main);
    if (!this.isNew) {
      this.slug.readOnly = true;
      slugEdit.hidden = false;
      slugEdit.addEventListener('click', async () => {
        const ok = await confirmBox(
          'Zmienić adres URL?',
          'Zmiana adresu opublikowanej strony = nowy URL. Stary adres przestanie działać (trzeba dodać przekierowanie 301), a Google straci historię strony.',
          'Rozumiem, zmień',
          'danger',
        );
        if (!ok) return;
        this.slug.readOnly = false;
        this.slug.focus();
        slugEdit.hidden = true;
      });
    }
    this.title.addEventListener('input', () => {
      $('.adm-bar__crumb b', main).textContent = this.title.value || def.newLabel || '';
      if (this.isNew && !this.slugTouched) this.slug.value = slugify(this.title.value);
    });
    this.slug.addEventListener('input', () => {
      this.slugTouched = true;
    });
    this.slug.addEventListener('change', () => {
      this.slug.value = slugify(this.slug.value);
    });

    // pola
    const side = $('.adm-col-side', main);
    const ctx: FieldCtx = { fileDir: this.fileDir, upload: (f, cover) => this.upload(f, cover) };
    for (const f of def.fields) {
      const r = renderField(f, 'name' in f ? data[f.name] : undefined, ctx);
      side.append(r.el);
      if ('name' in f && r.get) this.getters[f.name] = r.get;
      if (r.validate) this.validators.push(r.validate);
    }

    // treść
    if (def.body) {
      this.editor = createEditor($('.adm-editor-mount', main), this.entry?.html ?? '', {
        upload: async (f) => (await this.upload(f))?.url ?? null,
        links: () => linkSuggestions(),
        onChange: () => {
          this.dirtyBody = true;
          this.updateDirty();
        },
      });
    }

    this.root.addEventListener('input', () => this.updateDirty());
    this.root.addEventListener('change', () => this.updateDirty());
    $('[data-save]', main).addEventListener('click', () => this.save());
    $('[data-preview]', main).addEventListener('click', () => this.preview());
    this.saved = this.snapshot();
    if (this.isNew) this.title.focus();
  }

  defaults(): Record<string, any> {
    const d: Record<string, any> = {};
    for (const f of this.def.fields) {
      if (f.type === 'date' && f.required) d[f.name] = today();
      if (f.type === 'select' && f.name === 'group') d[f.name] = f.options[0].value;
    }
    if (this.collection === 'oferta') d.faqTitle = 'Najczęściej zadawane pytania i odpowiedzi';
    return d;
  }

  /** dane do zapisu: kolejność kluczy jak w pliku, pola spoza formularza bez zmian, puste pola pomijane */
  buildData() {
    const original = this.entry?.data ?? {};
    const values: Record<string, unknown> = { [this.def.titleField]: this.title.value.trim() };
    for (const [k, get] of Object.entries(this.getters)) values[k] = get();
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(original)) {
      if (k in values) {
        if (!isEmpty(values[k])) out[k] = values[k];
      } else out[k] = original[k];
    }
    for (const k of Object.keys(values)) if (!(k in original) && !isEmpty(values[k])) out[k] = values[k];
    return out;
  }

  snapshot() {
    return JSON.stringify([this.slug.value, this.buildData()]);
  }
  get dirty() {
    return this.dirtyBody || this.snapshot() !== this.saved;
  }
  updateDirty() {
    $('.adm-dirty', this.root).hidden = !this.dirty;
  }

  async upload(file: File, cover = false) {
    const slug = this.slug.value || slugify(this.title.value);
    if (!slug) {
      toast('Najpierw wpisz tytuł – z niego powstaje adres i folder na obrazki.', 'error');
      return null;
    }
    try {
      const q = new URLSearchParams({ collection: this.collection, slug, name: file.name || 'obrazek.png', ...(cover ? { cover: '1' } : {}) });
      const r = await api<{ url: string; path: string }>('upload?' + q, { method: 'POST', body: file });
      toast('Obrazek dodany');
      return r;
    } catch (e: any) {
      toast(e.message, 'error');
      return null;
    }
  }

  async save(force = false): Promise<boolean> {
    if (!this.title.value.trim()) {
      toast(`Uzupełnij pole „${this.def.titleLabel}”.`, 'error');
      this.title.focus();
      return false;
    }
    if (!this.slug.value) this.slug.value = slugify(this.title.value);
    const err = this.validators.map((v) => v()).find(Boolean);
    if (err) {
      toast(err, 'error');
      return false;
    }
    const btn = $<HTMLButtonElement>('[data-save]', this.root);
    btn.disabled = true;
    try {
      const r = await post<Entry>('entry', {
        collection: this.collection,
        slug: this.slug.value,
        originalSlug: this.originalSlug,
        data: this.buildData(),
        html: this.editor ? this.editor.getHTML() : null,
        mtime: this.entry?.mtime,
        force,
      });
      const wasNew = this.isNew;
      this.entry = { ...r, html: this.entry?.html ?? r.html };
      this.dirtyBody = false;
      this.slug.readOnly = true;
      $('[data-slug-edit]', this.root).hidden = false;
      this.saved = this.snapshot();
      this.updateDirty();
      history.replaceState(null, '', `#/${this.collection}/${r.slug}`);
      toast(wasNew ? 'Utworzono i zapisano' : 'Zapisano');
      await Promise.all([loadLists(), refreshStatus()]);
      return true;
    } catch (e: any) {
      if (e.status === 409 && /zmieniony/.test(e.message)) {
        if (await confirmBox('Plik zmieniony poza edytorem', esc(e.message), 'Zapisz mimo to', 'danger')) return this.save(true);
      } else toast(e.message, 'error');
      return false;
    } finally {
      btn.disabled = false;
    }
  }

  async preview() {
    const win = window.open('about:blank', '_blank');
    if (this.dirty || this.isNew) {
      if (!(await this.save())) return win?.close();
    }
    if (win) win.location.href = this.entry!.url;
  }

  destroy() {
    this.editor?.destroy();
  }
}

function linkSuggestions() {
  const out = [
    { url: '/', title: 'Strona główna' },
    { url: '/kontakt/', title: 'Kontakt' },
    { url: '/oferta/', title: 'Oferta' },
    { url: '/blog/', title: 'Blog' },
  ];
  for (const [c, items] of Object.entries(lists)) for (const i of items) if (!i.draft) out.push({ url: i.url, title: `${COLLECTIONS[c].label}: ${i.title}` });
  return out;
}

// ---------- nawigacja ----------

async function loadLists() {
  lists = await api<Lists>('list');
  renderNav();
}

function renderNav() {
  const nav = $('.adm-nav');
  const filter = ($<HTMLInputElement>('.adm-search')?.value ?? '').toLowerCase();
  const route = parseRoute();
  const html = Object.entries(COLLECTIONS)
    .map(([c, def]) => {
      const items = (lists[c] ?? []).filter((i) => !filter || i.title.toLowerCase().includes(filter));
      return `<section>
        <div class="adm-nav__head"><span>${esc(def.label)}</span>${def.canCreate ? `<a href="#/${c}/${NEW}" class="adm-small" title="${esc(def.newLabel ?? '')}">+ nowy</a>` : ''}</div>
        <ul>${items
          .map(
            (i) =>
              `<li><a href="#/${c}/${esc(i.slug)}" class="${route?.collection === c && route.slug === i.slug ? 'is-active' : ''}">${esc(i.title)}${i.draft ? ' <span class="adm-badge">szkic</span>' : ''}</a></li>`,
          )
          .join('')}</ul></section>`;
    })
    .join('');
  $('.adm-nav__lists').innerHTML = html;
  nav.dataset.ready = '1';
}

function parseRoute() {
  const m = location.hash.match(/^#\/([a-z]+)\/(.+)$/);
  return m ? { collection: m[1], slug: decodeURIComponent(m[2]) } : null;
}

let lastHash = location.hash;
async function route() {
  if (current?.dirty && location.hash !== lastHash) {
    const ok = await confirmBox('Niezapisane zmiany', 'Masz niezapisane zmiany. Wyjść bez zapisywania?', 'Wyjdź bez zapisu', 'danger');
    if (!ok) {
      history.replaceState(null, '', lastHash);
      return;
    }
  }
  lastHash = location.hash;
  current?.destroy();
  current = null;
  const main = $('.adm-main');
  const r = parseRoute();
  renderNav();
  if (!r || !COLLECTIONS[r.collection]) return renderHome(main);
  const def = COLLECTIONS[r.collection];
  try {
    const entry = r.slug === NEW ? null : await api<Entry>(`entry?collection=${r.collection}&slug=${encodeURIComponent(r.slug)}`);
    current = new View(r.collection, def, entry);
    current.render(main);
  } catch (e: any) {
    main.innerHTML = `<div class="adm-home"><h1>Nie udało się otworzyć</h1><p>${esc(e.message)}</p></div>`;
  }
}

function renderHome(main: HTMLElement) {
  main.innerHTML = `
    <div class="adm-home">
      <h1>Edytor treści</h1>
      <p>Wybierz wpis z listy po lewej albo <a href="#/blog/${NEW}">dodaj nowy wpis</a>.</p>
      <ol>
        <li><b>Zapisz</b> (Ctrl+S) zapisuje plik na dysku. <b>Podgląd ↗</b> pokazuje gotową stronę (lokalnie, także szkice).</li>
        <li><b>Opublikuj</b> (u góry) sprawdza build, robi commit i push – strona zaktualizuje się na serwerze po 2–3 min.</li>
      </ol>
      <h2>W edytorze</h2>
      <ul>
        <li><b>Obrazki</b>: wklej (Ctrl+V), przeciągnij plik albo przycisk „Obrazek”. Kliknij obrazek, żeby ustawić alt.</li>
        <li><b>Link</b> (Ctrl+K): adres + nofollow / sponsored / ugc / nowa karta. Nic nie zaznaczone = follow.</li>
        <li><b>HTML</b>: zakładka nad paskiem narzędzi – edycja całej treści jako kod. Blok „&lt;HTML&gt;” wstawia dowolny kod (embed, iframe).</li>
      </ul>
    </div>`;
}

// ---------- publikacja ----------

async function refreshStatus() {
  try {
    const s = await api<{ branch: string; changes: string[] }>('status');
    const el = $('.adm-status');
    el.textContent = s.changes.length ? `${s.changes.length} nieopublikowanych zmian` : 'wszystko opublikowane';
    el.classList.toggle('has-changes', s.changes.length > 0);
    el.title = s.changes.join('\n');
    return s;
  } catch {
    return null;
  }
}

async function publish() {
  if (current?.dirty && !(await current.save())) return;
  const s = await refreshStatus();
  const branchWarn =
    s && s.branch !== 'main' ? `<p class="adm-warn">Jesteś na gałęzi <b>${esc(s.branch)}</b> – zmiany trafią na serwer dopiero po scaleniu z <b>main</b>.</p>` : '';
  const res = await modal({
    title: 'Opublikować zmiany?',
    body: `${branchWarn}
      <p>Sprawdzę, czy strona się buduje, zrobię commit i push. Serwer zaktualizuje się po 2–3 minutach.</p>
      <details><summary>Zmienione pliki treści (${s?.changes.length ?? '?'})</summary><pre class="adm-log">${esc(s?.changes.join('\n') || '—')}</pre></details>
      <label class="adm-f"><span>Opis zmian (commit)</span><input name="message" value="${esc(current ? `Treść: ${current.title.value}` : 'Treść: aktualizacja')}"></label>`,
    actions: [{ value: 'ok', label: 'Opublikuj', kind: 'primary' }],
  });
  if (!res) return;
  const btn = $<HTMLButtonElement>('[data-publish]');
  btn.disabled = true;
  btn.textContent = 'Publikuję…';
  toast('Buduję stronę i wysyłam – to potrwa chwilę…');
  try {
    const r = await post<{ ok: boolean; log: string }>('publish', { message: res.data.message });
    await modal({
      title: r.ok ? 'Opublikowano' : 'Publikacja nie powiodła się',
      body: `<pre class="adm-log">${esc(r.log.trim())}</pre>`,
      actions: [{ value: 'ok', label: 'OK', kind: 'primary' }],
      cancel: false,
      wide: true,
    });
  } catch (e: any) {
    toast(e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Opublikuj';
    refreshStatus();
  }
}

// ---------- start ----------

// Zapis pliku / obrazka w src/ powoduje, że serwer deweloperski każe przeładować otwarte strony.
// Edytor nie może się przeładować (zgubiłby niezapisaną pracę), więc to polecenie wstrzymujemy na zawsze –
// Vite czeka na ten listener przed przeładowaniem. Podgląd strony w innej karcie odświeża się normalnie.
if (import.meta.hot) import.meta.hot.on('vite:beforeFullReload', () => new Promise(() => {}));

$('[data-publish]').addEventListener('click', publish);
$('.adm-search').addEventListener('input', renderNav);
window.addEventListener('hashchange', route);
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    current?.save();
  }
});
window.addEventListener('beforeunload', (e) => {
  if (current?.dirty) e.preventDefault();
});
// licznik zmian odświeżany po powrocie do karty – najwyżej raz na 15 s
let lastStatus = 0;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || Date.now() - lastStatus < 15000) return;
  lastStatus = Date.now();
  refreshStatus();
});

// do testów automatycznych: HTML, który zostałby zapisany
Object.assign(window, { __admHtml: () => current?.editor?.getHTML() ?? null });

await loadLists();
await route();
refreshStatus();
