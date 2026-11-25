/**
 * Tworzy szkic nowego wpisu:  npm run nowy-wpis "Tytuł wpisu"
 * → src/content/blog/<slug>.md (draft: true – widoczny tylko w `npm run dev`, do czasu zmiany na false)
 */
import fs from 'node:fs';
import { slugify } from '../src/lib/slugify.mjs';

const title = process.argv.slice(2).join(' ').trim();
if (!title) {
  console.error('Podaj tytuł:  npm run nowy-wpis "Tytuł wpisu"');
  process.exit(1);
}

const slug = slugify(title);
const file = `src/content/blog/${slug}.md`;
if (fs.existsSync(file)) {
  console.error(`Plik już istnieje: ${file}`);
  process.exit(1);
}

const categories = JSON.parse(fs.readFileSync('src/content/kategorie.json', 'utf8'));
const now = new Date().toISOString().slice(0, 16);
const yamlString = (s) => `'${s.replace(/'/g, "''")}'`;

fs.writeFileSync(
  file,
  `---
title: ${yamlString(title)}
seoTitle: ${yamlString(`${title} | Kamil Wnęk`)}
description: 'TODO: meta description (140–160 znaków)'
pubDate: ${now}
# Dostępne kategorie: ${categories.map((c) => c.id).join(', ')}
categories:
  - ${categories[0]?.id ?? 'podstawy-seo'}
# Okładka: wrzuć plik do src/assets/images/blog/ i odkomentuj:
# cover: ../../assets/images/blog/nazwa-pliku.jpg
# coverAlt: 'Opis zdjęcia'
# FAQ (opcjonalnie) – wyświetli się pod treścią i trafi do schema FAQPage:
# faq:
#   - question: 'Pytanie?'
#     answer: 'Odpowiedź.'
draft: true
---

Wstęp – 2–3 zdania, które od razu odpowiadają na pytanie z tytułu.

## Pierwszy nagłówek

Treść…

<p class="cta"><a class="btn" href="/kontakt/#kalendarz">Umów bezpłatną rozmowę</a></p>
`,
);

console.log(`✓ Utworzono ${file}`);
console.log('  Podgląd: npm run dev → http://localhost:4321/blog/' + slug + '/');
console.log('  Publikacja: zmień draft: true → false, zapisz i wyślij zmiany (git push).');
