/**
 * Środowisko wdrożenia (ustawia GitHub Actions: DEPLOY_ENV=production | test).
 * Wersja testowa (gałąź dev → subdomena): noindex, robots.txt blokuje wszystko, bez GTM, etykieta „Wersja testowa”.
 * Lokalnie (npm run build / dev) zmienna nie jest ustawiona → zachowanie jak produkcja.
 * Czytane tylko przy buildzie (Node), nigdy w przeglądarce.
 */
const env = (globalThis as unknown as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
export const IS_TEST = env.DEPLOY_ENV === 'test';
