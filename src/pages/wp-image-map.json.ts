/**
 * Mapa: stary adres obrazka z WordPressa → zoptymalizowany plik Astro (WebP).
 * Plik jest czytany po buildzie przez integrację htaccess (przekierowania 301), po czym usuwany z dist/.
 */
import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';
import media from '../data/wp-media.json';

const files = import.meta.glob<ImageMetadata>('/src/assets/images/wp/**/*.{jpg,jpeg,png,webp,gif}', {
  eager: true,
  import: 'default',
});

export async function GET() {
  const map = [];
  for (const item of media) {
    const src = files[`/${item.file}`];
    if (!src) continue;
    const img = await getImage({ src, format: 'webp', width: Math.min(src.width, 1920) });
    map.push({ oldPath: item.oldPath, ext: item.ext, target: img.src });
  }
  return new Response(JSON.stringify(map), { headers: { 'Content-Type': 'application/json' } });
}
