import type { APIContext } from 'astro';
import { IS_TEST } from '../lib/env';

export function GET({ site }: APIContext) {
  // wersja testowa (subdomena) – roboty nie mają tam czego szukać
  if (IS_TEST) return new Response('User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

  const body = `# Czego poszukujesz podróżniku?
# Szukasz pomysłu na plik robots.txt? Napisz na kontakt@kamilwnek.pl

User-agent: *
Allow: /

Sitemap: ${new URL('sitemap_index.xml', site).href}
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
