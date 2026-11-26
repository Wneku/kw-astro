/**
 * Publikacja zmian (też przycisk „Opublikuj” w edytorze /admin):  npm run publikuj  [-- "opis zmian"]
 * Sprawdza build, robi commit treści i push → GitHub Actions wdraża stronę na serwer.
 */
import { execSync } from 'node:child_process';

const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts });
const out = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();

const branch = out('git rev-parse --abbrev-ref HEAD');
const changes = out('git status --porcelain');
if (!changes) {
  console.log('Brak zmian do opublikowania.');
  process.exit(0);
}

console.log('\nZmiany:\n' + changes + '\n');
console.log('Sprawdzam, czy strona się buduje…');
try {
  run('npm run build', { stdio: ['inherit', 'ignore', 'inherit'] });
} catch {
  console.error('\nBuild nie przeszedł – nic nie zostało opublikowane. Popraw błąd powyżej.');
  process.exit(1);
}

const message = process.argv.slice(2).join(' ').trim() || 'Treść: aktualizacja z panelu';
run('git add -A');
run(`git commit -m ${JSON.stringify(message)}`);
run(`git push origin ${branch}`);
console.log(
  branch === 'main'
    ? '\nWysłane. Strona zaktualizuje się za 2–3 minuty (GitHub → Actions).'
    : `\nWysłane na gałąź „${branch}”. Na stronę trafi dopiero po scaleniu z main.`,
);
