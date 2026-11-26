import type { APIContext } from 'astro';

export function GET({ site }: APIContext) {
  const body = `# Czego poszukujesz podróżniku?
# Szukasz pomysłu na plik robots.txt? Napisz na kontakt@kamilwnek.pl

User-agent: *
Allow: /

Sitemap: ${new URL('sitemap_index.xml', site).href}
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
