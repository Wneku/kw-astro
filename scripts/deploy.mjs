/**
 * Wdrożenie KODU na produkcję:  npm run wdroz
 *
 * Wersja testowa (gałąź dev) → produkcja (main):
 *   1. pobiera najnowszy main i dołącza go do dev (treści opublikowane w międzyczasie),
 *   2. sprawdza typy i build,
 *   3. push dev, a potem dev → main (produkcja).
 *
 * Wymaga czystego stanu: wszystkie zmiany w kodzie zacommitowane (treści publikuje się przyciskiem „Opublikuj”).
 */
import { execFileSync, execSync } from 'node:child_process';

const PROD = 'main';
const TEST = 'dev';

const git = (args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const live = (cmd, args) => (cmd === 'npm' ? execSync(`npm ${args.join(' ')}`, { stdio: 'inherit' }) : execFileSync(cmd, args, { stdio: 'inherit' }));
const fail = (msg) => {
  console.error('\n' + msg);
  process.exit(1);
};

const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
if (branch !== TEST) fail(`Wdrożenie robi się z gałęzi „${TEST}” (jesteś na „${branch}”). Przełącz: git checkout ${TEST}`);

const dirty = git(['status', '--porcelain']);
if (dirty) fail('Masz niezacommitowane zmiany:\n' + dirty + '\n\nZacommituj kod (treści opublikuj przyciskiem „Opublikuj”) i uruchom ponownie.');

console.log(`Pobieram ${PROD} i dołączam opublikowane treści do ${TEST}…`);
live('git', ['fetch', 'origin']);
try {
  live('git', ['merge', '--no-edit', `origin/${PROD}`]);
} catch {
  fail(`Konflikt przy łączeniu ${PROD} z ${TEST}. Rozwiąż konflikty (VS Code pokaże pliki), zrób commit i uruchom ponownie.`);
}

console.log('\nSprawdzam typy i build…');
try {
  live('npm', ['run', 'check']);
  live('npm', ['run', 'build']);
} catch {
  fail('Sprawdzenie nie przeszło – nic nie zostało wdrożone. Popraw błąd powyżej.');
}

console.log('\nWysyłam…');
live('git', ['push', 'origin', TEST]);
try {
  // dev zawiera już cały main, więc to zwykłe przesunięcie main do przodu
  live('git', ['push', 'origin', `${TEST}:${PROD}`]);
} catch {
  fail(`Push na ${PROD} odrzucony – ktoś/coś zmieniło produkcję w międzyczasie. Uruchom npm run wdroz jeszcze raz.`);
}
try {
  git(['fetch', 'origin', `${PROD}:${PROD}`]);
} catch {}

console.log('\nWdrożone. Produkcja zaktualizuje się za 2–3 minuty (GitHub → Actions).');
