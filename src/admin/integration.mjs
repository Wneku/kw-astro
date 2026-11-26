/**
 * Edytor treści: http://localhost:4321/admin – działa tylko w `npm run dev`.
 * Do builda (strony na serwerze) nic z tego nie trafia.
 *
 * API (/__admin/api/…) czyta i zapisuje pliki w src/content/ i obrazki w src/assets/images/.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import YAML from 'yaml';
import { slugify } from '../lib/slugify.mjs';
import { ROOT, FILE_PREFIX, markdownToEditorHtml, editorHtmlToMarkdown } from './convert.mjs';

const COLLECTIONS = {
  blog: { dir: 'src/content/blog', ext: 'md', images: 'src/assets/images/blog', url: (s) => `/blog/${s}/`, canCreate: true },
  oferta: { dir: 'src/content/oferta', ext: 'md', images: 'src/assets/images/oferta', url: (s) => `/oferta/${s}/`, canCreate: true },
  strony: { dir: 'src/content/strony', ext: 'md', images: 'src/assets/images/strony', url: (s) => `/${s}/`, canCreate: false },
  kategorie: { dir: 'src/content/kategorie', ext: 'json', url: (s) => `/blog/${s}/`, canCreate: true },
};
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'svg']);
const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', svg: 'image/svg+xml' };

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const abs = (...p) => path.join(ROOT, ...p);
const toPosix = (p) => p.split(path.sep).join('/');
const exists = (p) => fs.access(p).then(() => true, () => false);

function col(name) {
  const c = COLLECTIONS[name];
  if (!c) throw new HttpError(400, `Nieznana kolekcja: ${name}`);
  return c;
}
function checkSlug(slug) {
  if (!SLUG_RE.test(slug ?? '')) throw new HttpError(400, 'Adres URL może mieć tylko małe litery, cyfry i myślniki (np. moj-nowy-wpis).');
  return slug;
}
const entryPath = (c, slug) => abs(c.dir, `${checkSlug(slug)}.${c.ext}`);

function splitFrontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  return m ? { data: YAML.parse(m[1]) ?? {}, body: m[2] } : { data: {}, body: src };
}

async function readEntry(collection, slug) {
  const c = col(collection);
  const file = entryPath(c, slug);
  const [src, stat] = await Promise.all([fs.readFile(file, 'utf8'), fs.stat(file)]);
  const base = { collection, slug, mtime: stat.mtimeMs, fileDir: c.dir, url: c.url(slug) };
  if (c.ext === 'json') return { ...base, data: JSON.parse(src), html: null };
  const { data, body } = splitFrontmatter(src);
  return { ...base, data, html: await markdownToEditorHtml(body, file) };
}

async function listEntries() {
  const out = {};
  for (const [name, c] of Object.entries(COLLECTIONS)) {
    const files = (await fs.readdir(abs(c.dir))).filter((f) => f.endsWith(`.${c.ext}`));
    out[name] = await Promise.all(
      files.map(async (f) => {
        const slug = f.slice(0, -(c.ext.length + 1));
        const src = await fs.readFile(abs(c.dir, f), 'utf8');
        const data = c.ext === 'json' ? JSON.parse(src) : splitFrontmatter(src).data;
        return { slug, title: data.title ?? data.name ?? slug, draft: data.draft === true, date: data.updatedDate ?? data.pubDate ?? null, url: c.url(slug) };
      }),
    );
    out[name].sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')) || a.title.localeCompare(b.title, 'pl'));
  }
  return out;
}

async function saveEntry({ collection, slug, originalSlug, data, html, mtime, force }) {
  const c = col(collection);
  const file = entryPath(c, slug);
  if (!originalSlug) {
    if (!c.canCreate) throw new HttpError(400, 'W tej sekcji nie można dodawać nowych pozycji.');
    if (await exists(file)) throw new HttpError(409, `Pozycja o adresie „${slug}” już istnieje – zmień adres URL.`);
  } else {
    const prev = entryPath(c, originalSlug);
    if (!force && mtime && (await fs.stat(prev)).mtimeMs !== mtime) {
      throw new HttpError(409, 'Plik został w międzyczasie zmieniony poza edytorem (np. w VS Code). Odśwież stronę, żeby nie nadpisać tych zmian, albo zapisz mimo to.');
    }
    if (slug !== originalSlug) {
      if (await exists(file)) throw new HttpError(409, `Pozycja o adresie „${slug}” już istnieje.`);
      await fs.rename(prev, file);
    }
  }
  let content;
  if (c.ext === 'json') content = JSON.stringify(data, null, 2) + '\n';
  else {
    const body = html ? await editorHtmlToMarkdown(html, file) : '';
    content = `---\n${YAML.stringify(data, { lineWidth: 0 })}---\n\n${body}`;
  }
  await fs.writeFile(file, content);
  return { ...(await readEntry(collection, slug)), saved: true };
}

async function saveUpload(query, buffer) {
  const c = col(query.get('collection'));
  if (!c.images) throw new HttpError(400, 'Ta sekcja nie ma obrazków.');
  const slug = checkSlug(query.get('slug'));
  const original = query.get('name') || 'obrazek.jpg';
  const ext = (original.split('.').pop() || '').toLowerCase();
  if (!IMAGE_EXT.has(ext)) throw new HttpError(400, `Nieobsługiwany format: .${ext} (dozwolone: ${[...IMAGE_EXT].join(', ')}).`);
  if (!buffer.length) throw new HttpError(400, 'Pusty plik.');
  const dir = abs(c.images, slug);
  await fs.mkdir(dir, { recursive: true });
  let base = query.get('cover') === '1' ? 'cover' : slugify(original.replace(/\.[^.]+$/, '')) || 'obrazek';
  let name = `${base}.${ext}`;
  if (base !== 'cover') for (let i = 2; await exists(path.join(dir, name)); i++) name = `${base}-${i}.${ext}`;
  const target = path.join(dir, name);
  await fs.writeFile(target, buffer);
  const repoPath = toPosix(path.relative(ROOT, target));
  return { url: FILE_PREFIX + repoPath, path: toPosix(path.relative(abs(c.dir), target)) };
}

function git(args) {
  return new Promise((resolve) => {
    // windowsHide: bez tego Windows na chwilę otwiera okno konsoli przy każdym wywołaniu
    const p = spawn('git', args, { cwd: ROOT, windowsHide: true });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.on('close', () => resolve(out));
    p.on('error', () => resolve(''));
  });
}

async function status() {
  const out = await git(['status', '--porcelain', '--', 'src/content', 'src/assets/images']);
  const branch = (await git(['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
  return { branch, changes: out.split('\n').filter(Boolean).map((l) => l.slice(3)) };
}

function publish(message) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, ['scripts/publish.mjs', ...(message ? [message] : [])], { cwd: ROOT, windowsHide: true, env: { ...process.env, FORCE_COLOR: '0' } });
    let log = '';
    p.stdout.on('data', (d) => (log += d));
    p.stderr.on('data', (d) => (log += d));
    p.on('close', (code) => resolve({ ok: code === 0, log: log.replace(/\x1b\[[0-9;]*m/g, '') }));
  });
}

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

async function serveFile(req, res, rel) {
  const target = path.resolve(ROOT, decodeURIComponent(rel));
  const allowed = [abs('src', 'assets'), abs('public')].some((d) => target.startsWith(d + path.sep));
  const ext = target.split('.').pop().toLowerCase();
  if (!allowed || !MIME[ext] || !(await exists(target))) {
    res.statusCode = 404;
    return res.end();
  }
  res.setHeader('Content-Type', MIME[ext]);
  res.setHeader('Cache-Control', 'no-store');
  res.end(await fs.readFile(target));
}

async function handle(req, res, next) {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith(FILE_PREFIX)) return serveFile(req, res, url.pathname.slice(FILE_PREFIX.length));
  if (!url.pathname.startsWith('/__admin/api/')) return next();

  // tylko z tej samej maszyny i z samego panelu
  const origin = req.headers.origin;
  if (req.method !== 'GET' && origin && new URL(origin).host !== req.headers.host) {
    res.statusCode = 403;
    return res.end();
  }

  const route = url.pathname.slice('/__admin/api/'.length);
  const q = url.searchParams;
  const json = async () => JSON.parse((await readBody(req)).toString('utf8') || '{}');
  let result;
  try {
    if (route === 'list' && req.method === 'GET') result = await listEntries();
    else if (route === 'entry' && req.method === 'GET') result = await readEntry(q.get('collection'), q.get('slug'));
    else if (route === 'entry' && req.method === 'POST') result = await saveEntry(await json());
    else if (route === 'upload' && req.method === 'POST') result = await saveUpload(q, await readBody(req));
    else if (route === 'status' && req.method === 'GET') result = await status();
    else if (route === 'publish' && req.method === 'POST') result = await publish(String((await json()).message ?? '').trim());
    else throw new HttpError(404, 'Nie ma takiej akcji.');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(result));
  } catch (err) {
    res.statusCode = err.status ?? 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: err.status ? err.message : `Błąd: ${err.message}` }));
    if (!err.status) console.error('[admin]', err);
  }
}

export default function adminEditor() {
  return {
    name: 'kamilwnek-admin',
    hooks: {
      'astro:config:setup': ({ command, injectRoute }) => {
        if (command === 'dev') injectRoute({ pattern: '/admin', entrypoint: './src/admin/AdminPage.astro', prerender: true });
      },
      'astro:server:setup': ({ server, logger }) => {
        server.middlewares.use((req, res, next) => handle(req, res, next).catch(next));
        logger.info('Edytor treści: http://localhost:4321/admin');
      },
    },
  };
}
