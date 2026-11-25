/**
 * Slug ASCII z polskiego tekstu: „Czym są dane strukturalne?” → „czym-sa-dane-strukturalne”.
 * Używany przez importer (linki w spisach treści) i przez rehype-heading-ids (id nagłówków),
 * dzięki czemu kotwice zawsze do siebie pasują.
 * @param {string} text
 */
export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
