# kamilwnek.pl – Astro

Strona przeniesiona z WordPressa (Blocksy + Rank Math) do Astro. Statyczny build, hosting seohost (LiteSpeed).

## Komendy

| Komenda             | Co robi                                                                 |
| ------------------- | ----------------------------------------------------------------------- |
| `npm run dev`       | serwer deweloperski (`localhost:4321`) + edytor treści `/admin`         |
| `npm run publikuj`  | build + commit + push → automatyczne wdrożenie (opis: `-- "Nowy wpis"`) |
| `npm run build`     | build do `dist/` (+ `.htaccess` z przekierowaniami)                     |
| `npm run preview`   | podgląd builda                                                          |
| `npm run check`     | sprawdzenie typów                                                       |
| `npm run import:wp` | ponowny import treści z WordPressa (nadpisuje pliki w `src/content/`!)  |
| `npm run verify`    | porównanie `dist/` z obecnym WordPressem (SEO, treść, linki, kotwice)   |

## Gdzie co jest

- `src/content/oferta/*.md` – usługi (pole `group` = kolumna mega menu, `faq`, `intro` = tekst obok formularza)
- `src/content/blog/*.md` – wpisy; `src/content/kategorie/*.json` – kategorie (nazwa pliku = adres URL)
- `src/content/strony/*.md` – O mnie, Polityka prywatności
- `src/pages/index.astro`, `kontakt.astro` – strony budowane ręcznie (treść w pliku)
- `src/config/site.ts` – dane firmy, GTM, CookieYes, social media
- `src/config/services.ts` – kolumny mega menu „Oferta” i karta CTA
- `src/styles/tokens.css` – kolory, fonty, skala typografii
- `src/data/page-seo.json` – title/description stron budowanych ręcznie (z Rank Math)

Nowa usługa = nowy plik `.md` w `src/content/oferta/` – pojawi się w mega menu, stopce, `/oferta/` i sitemapie.

## Dodawanie i edycja treści – edytor `/admin` (lokalnie)

1. `npm run dev` i wejdź na **http://localhost:4321/admin**.
2. Po lewej lista: Wpisy, Oferta, Strony, Kategorie (`+ nowy` = nowa pozycja). Tytuł na górze, adres URL tworzy się
   z tytułu; po prawej pola (meta title/description z licznikiem znaków, daty, kategorie, okładka, FAQ, szkic).
3. **Zapisz** (Ctrl+S) zapisuje plik na dysku (`src/content/…`, obrazki w `src/assets/images/<sekcja>/<adres>/`).
   **Podgląd ↗** zapisuje i otwiera gotową stronę (lokalnie widać też szkice).
4. **Opublikuj** (prawy górny róg) sprawdza build, robi commit i push → GitHub Actions wgrywa stronę na seohost
   (ok. 2–3 min). To samo z terminala: `npm run publikuj -- "opis"`. Licznik obok pokazuje nieopublikowane zmiany.

Edytor działa tylko na Twoim komputerze – do builda nic z niego nie trafia (strona jest w 100% statyczna).

**W treści:**

- **Obrazki** – wklej (Ctrl+V), przeciągnij plik albo przycisk „Obrazek”. Po dodaniu od razu pyta o alt;
  kliknięcie w obrazek → „Edytuj alt / podmień”. Astro sam robi z nich zoptymalizowane wersje (webp, rozmiary).
- **Link** (przycisk albo Ctrl+K) – jedno okno: adres (podpowiada podstrony serwisu), `nofollow`, `sponsored`, `ugc`,
  „nowa karta”. Nic nie zaznaczone = zwykły link follow. Kliknięcie w link → pasek nad treścią pokazuje rel → „Edytuj”.
  Linki z atrybutami mają w edytorze przerywane podkreślenie.
- nagłówki **H2–H4** (lista „Akapit”), pogrubienie, kursywa, listy, cytat, **tabela** (pasek nad treścią: + wiersz / kolumna),
  **Przycisk** (CTA), **Ramka** (informacja / uwaga / wskazówka + tytuł), blok kodu, linia.
- **Zakładka HTML** – cała treść jako kod do edycji. Elementy, których edytor nie zna (np. `<iframe>`, `<div class>`),
  zamienia na blok „Kod HTML”, więc nic nie ginie. Blok „&lt;HTML&gt;” na pasku wstawia dowolny kod (embed, iframe) 1:1.
- **FAQ** – w polach po prawej (odpowiedź: zwykły tekst, `**pogrubienie**`, `[link](/adres/)`). Wyświetla się pod treścią,
  w spisie treści i w schema FAQPage.

Jak to działa: treść zapisuje się jako Markdown (`.md`). Przycisk, ramka i linki z atrybutami to tagi `<Cta … />`,
`<Ramka …>`, `<LinkRel …>`, które przy buildzie zamienia [src/lib/remark-components.mjs](src/lib/remark-components.mjs).
Edytor: [src/admin/](src/admin/) – pola formularza w [src/admin/fields.ts](src/admin/fields.ts), pasek narzędzi
w [src/admin/editor.ts](src/admin/editor.ts), konwersja Markdown ↔ HTML w [src/admin/convert.mjs](src/admin/convert.mjs).
Pliki `.md` można też dalej edytować ręcznie w VS Code – edytor wykryje zmianę i nie nadpisze jej bez pytania.

Uwaga: adres URL opublikowanej pozycji jest zablokowany („zmień” pyta o potwierdzenie) – zmiana adresu = nowy URL
(trzeba dodać przekierowanie 301). Usuwanie wpisów: skasuj plik `.md` w VS Code (albo zaznacz „Szkic”).

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
