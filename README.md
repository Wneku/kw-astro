# kamilwnek.pl – Astro

Strona przeniesiona z WordPressa (Blocksy + Rank Math) do Astro. Statyczny build, hosting seohost (LiteSpeed).

## Komendy

| Komenda             | Co robi                                                                 |
| ------------------- | ----------------------------------------------------------------------- |
| `npm run dev`       | serwer deweloperski (`localhost:4321`)                                  |
| `npm run build`     | build do `dist/` (+ `.htaccess` z przekierowaniami)                     |
| `npm run preview`   | podgląd builda                                                          |
| `npm run check`     | sprawdzenie typów                                                       |
| `npm run import:wp` | ponowny import treści z WordPressa (nadpisuje pliki w `src/content/`!)  |
| `npm run verify`    | porównanie `dist/` z obecnym WordPressem (SEO, treść, linki, kotwice)   |

## Gdzie co jest

- `src/content/oferta/*.md` – usługi (pole `group` = kolumna mega menu, `faq`, `intro` = tekst obok formularza)
- `src/content/blog/*.md` – wpisy; `src/content/kategorie.json` – kategorie
- `src/content/strony/*.md` – O mnie, Polityka prywatności
- `src/pages/index.astro`, `kontakt.astro` – strony budowane ręcznie (treść w pliku)
- `src/config/site.ts` – dane firmy, GTM, CookieYes, social media
- `src/config/services.ts` – kolumny mega menu „Oferta” i karta CTA
- `src/styles/tokens.css` – kolory, fonty, skala typografii
- `src/data/page-seo.json` – title/description stron budowanych ręcznie (z Rank Math)

Nowa usługa = nowy plik `.md` w `src/content/oferta/` – pojawi się w mega menu, stopce, `/oferta/` i sitemapie.

## Dodawanie i edycja treści

### W przeglądarce – Pages CMS (zalecane)

1. Wejdź na https://app.pagescms.org, zaloguj się kontem GitHub i otwórz repozytorium strony.
2. **Blog – wpisy → Add an entry**: tytuł, meta description, data, kategorie, okładka, FAQ i treść (Markdown).
3. „Save” = commit do gałęzi `main` → GitHub Actions buduje stronę i wgrywa ją na seohost (ok. 2–3 min).
   Postęp i ewentualne błędy: zakładka **Actions** w repozytorium (przy błędzie przychodzi też mail z GitHuba,
   a strona na serwerze zostaje bez zmian).
4. `Szkic` zaznaczony = wpis nie pojawi się na stronie.

Treść pisze się w **edytorze wizualnym** (zapisuje Markdown; przełącznik „Source” pokazuje kod). Edytor nie obsługuje
surowego HTML, dlatego:

- **Przycisk** = osobny akapit z linkiem, cały pogrubiony (`**[Umów rozmowę](/kontakt/#kalendarz)**`).
  Pogrubiony link w środku zdania zostaje zwykłym linkiem. Obsługa: [src/lib/rehype-cta.mjs](src/lib/rehype-cta.mjs).
- **nofollow / sponsored / ugc** – dopisz znacznik na końcu adresu linku: `https://example.com/#nofollow`,
  `#sponsored`, `#ugc` lub łącznie `#nofollow-sponsored`. Adres z kotwicą: `https://example.com/#sekcja~nofollow`.
  Znacznik znika z adresu na stronie i zamienia się w `rel="…"`. Obsługa: [src/lib/rehype-link-rel.mjs](src/lib/rehype-link-rel.mjs).
- **FAQ** dodawaj w polu „FAQ” formularza, nie w treści – wyświetli się pod wpisem, w spisie treści i w schema FAQPage.
- **Obrazki** przeciągnij do edytora i uzupełnij opis (alt). Trafiają do `src/assets/images/blog/` – Astro sam robi
  z nich WebP w kilku rozmiarach.
Konfiguracja panelu: [.pages.yml](.pages.yml). Nowa kategoria: dodaj ją w „Blog – kategorie” **i** w `.pages.yml`
(lista `categories`), żeby była do wyboru przy wpisie.

### Lokalnie

```bash
npm run nowy-wpis "Tytuł wpisu"   # tworzy szkic src/content/blog/tytul-wpisu.md (draft: true)
npm run dev                       # podgląd na http://localhost:4321
# gotowe? draft: false → git add . && git commit -m "Nowy wpis" && git push
```

### Wdrożenie automatyczne (GitHub Actions)

[.github/workflows/deploy.yml](.github/workflows/deploy.yml): każdy push do `main` → `npm run check` → `npm run build`
→ wysyłka FTPS na seohost (tylko zmienione pliki). Sekrety w GitHub → Settings → Secrets and variables → Actions:
`FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`. Katalog docelowy jest w samym workflow (`FTP_DIR: public_html/`) – **względem folderu po zalogowaniu FTP**,
na seohost zwykle `public_html/` (nie pełna ścieżka `/home/…`).

## Formularze kontaktowe

Wysyłka bez zewnętrznych usług: `public/api/kontakt.php` (PHP `mail()` na seohost) → trafia do `dist/api/kontakt.php`.

- Odbiorca i nadawca: stałe `RECIPIENT` / `SENDER` na górze pliku. `SENDER` musi istnieć jako skrzynka w domenie na seohost.
- Antyspam: ukryte pole `website`, pułapka czasowa (min. 3 s), sprawdzenie Origin, limit 5 wiadomości / 10 min z jednego IP.
- Z JS odpowiedź pojawia się pod formularzem; bez JS – przekierowanie na `/kontakt/dziekuje/`.
- Na `localhost` wiadomości nie są wysyłane, tylko zapisywane do `kamilwnek-form-test.log` w katalogu tymczasowym PHP.
- `npm run dev` / `preview` nie wykonują PHP – formularz testuj na serwerze albo lokalnie przez `php -S localhost:8080 -t dist`.

**Test po wdrożeniu (najlepiej najpierw na subdomenie testowej, np. `nowa.kamilwnek.pl`):**

1. Wyślij formularz z `/kontakt/` i z dowolnej usługi → mail ma przyjść na `RECIPIENT`, „Odpowiedz” ma trafiać do nadawcy z formularza.
2. Sprawdź folder SPAM i nagłówki maila (SPF/DKIM = pass). Jeśli trafia do spamu: w panelu seohost włącz DKIM dla domeny i sprawdź rekord SPF.
3. Wyłącz JS w przeglądarce i wyślij ponownie → powinno przekierować na `/kontakt/dziekuje/`.
4. Wyślij pusty formularz z pominięciem walidacji przeglądarki (np. przez narzędzia deweloperskie) → komunikat o błędach.
5. Otwórz `https://…/api/kontakt.php` w przeglądarce → „Niedozwolona metoda” (405).

## Wdrożenie na seohost

1. `npm run build && npm run verify`
2. Wgraj **zawartość** `dist/` (łącznie z ukrytym plikiem `.htaccess` i folderem `api/`) do katalogu domeny (`public_html`) przez FTP/menedżer plików.
   Przed wgraniem zrób kopię obecnego WordPressa i przenieś go poza `public_html`.
3. Przetestuj formularze (sekcja wyżej).
4. Google Search Console → prześlij `https://kamilwnek.pl/sitemap-index.xml`, sprawdź kilka adresów w „Sprawdzanie adresu URL”.
