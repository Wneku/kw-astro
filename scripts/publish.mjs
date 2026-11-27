/**
 * Publikacja TREŚCI (też przycisk „Opublikuj” w edytorze /admin):  npm run publikuj  [-- "opis zmian"]
 *
 * Bierze tylko treści i obrazki (src/content/, src/assets/images/) – zmiany w kodzie zostają na dysku.
 *   1. sprawdza, czy strona się buduje,
 *   2. robi commit samych treści na bieżącej gałęzi (zwykle dev) i push → wersja testowa,
 *   3. ten sam commit przenosi na main (w tymczasowym katalogu, bez przełączania Twojej gałęzi) i push → produkcja.
 *
 * Kod wdraża się osobno: npm run wdroz (scripts/deploy.mjs).
 */
import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CONTENT_PATHS = ['src/content', 'src/assets/images'];
const PROD = 'main';

const git = (args, opts = {}) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
// bez trim() na początku – w `git status --porcelain` pierwsza spacja to część kodu statusu
const porcelain = (paths = []) => execFileSync('git', ['status', '--porcelain', '--', ...paths], { encoding: 'utf8' }).trimEnd();
const gitLive = (args, opts = {}) => execFileSync('git', args, { stdio: 'inherit', ...opts });
const fail = (msg) => {
  console.error('\n' + msg);
  process.exit(1);
};

const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
const contentChanges = porcelain(CONTENT_PATHS);
const otherChanges = porcelain()
  .split('\n')
  .filter((l) => l && !CONTENT_PATHS.some((p) => l.slice(3).replace(/^"|"$/g, '').startsWith(p)));

if (!contentChanges) {
  console.log('Brak zmian w treściach do opublikowania.');
  process.exit(0);
}
console.log('\nPublikuję treści:\n' + contentChanges + '\n');
if (otherChanges.length) console.log('Zostają tylko na dysku (kod, nie treść):\n' + otherChanges.join('\n') + '\n');

console.log('Sprawdzam, czy strona się buduje…');
try {
  execSync('npm run build', { stdio: ['ignore', 'ignore', 'inherit'] });
} catch {
  fail('Build nie przeszedł – nic nie zostało opublikowane. Popraw błąd powyżej.');
}

// 1. commit samych treści na bieżącej gałęzi
const message = process.argv.slice(2).join(' ').trim() || 'Treść: aktualizacja z panelu';
git(['add', '-A', '--', ...CONTENT_PATHS]);
gitLive(['commit', '-m', message, '--only', '--', ...CONTENT_PATHS]);
const sha = git(['rev-parse', 'HEAD']);

// 2. ten sam commit na main (produkcja) – w osobnym katalogu roboczym, Twoje pliki zostają nietknięte
if (branch !== PROD) {
  console.log(`\nPrzenoszę treści na ${PROD} (produkcja)…`);
  gitLive(['fetch', 'origin', PROD]);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kw-publish-'));
  try {
    git(['worktree', 'add', '--detach', dir, `origin/${PROD}`]);
    try {
      git(['cherry-pick', sha], { cwd: dir });
    } catch {
      try {
        git(['cherry-pick', '--abort'], { cwd: dir });
      } catch {}
      fail(
        `Nie udało się przenieść treści na ${PROD} (konflikt – ten sam plik zmieniony inaczej na produkcji).\n` +
          `Commit został na gałęzi „${branch}”. Rozwiąż to ręcznie albo wdróż całość: npm run wdroz`,
      );
    }
    gitLive(['push', 'origin', `HEAD:${PROD}`], { cwd: dir });
  } finally {
    try {
      git(['worktree', 'remove', '--force', dir]);
    } catch {}
    fs.rmSync(dir, { recursive: true, force: true });
  }
  // lokalna gałąź main w zgodzie z serwerem (bez przełączania)
  try {
    git(['fetch', 'origin', `${PROD}:${PROD}`]);
  } catch {}
}

// 3. push bieżącej gałęzi (dev → wersja testowa; albo main, jeśli pracujesz bezpośrednio na nim)
console.log(`\nWysyłam gałąź „${branch}”…`);
try {
  gitLive(['push', 'origin', branch]);
} catch {
  console.error(`\nUwaga: push gałęzi „${branch}” się nie udał (np. zmiany z innego komputera – zrób git pull).`);
  if (branch === PROD) process.exit(1);
  console.error('Produkcja jest już zaktualizowana – brakuje tylko wersji testowej.');
}

console.log(
  branch === PROD
    ? '\nOpublikowane. Strona zaktualizuje się za 2–3 minuty (GitHub → Actions).'
    : `\nOpublikowane na produkcji i na wersji testowej. Strona zaktualizuje się za 2–3 minuty (GitHub → Actions).`,
);
