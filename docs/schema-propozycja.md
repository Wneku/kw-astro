# Dane strukturalne (JSON-LD) – kamilwnek.pl

> **Status: WDROŻONE (25.11.2026)** zgodnie z decyzjami poniżej. Kod: [src/lib/schema.ts](../src/lib/schema.ts),
> dane osoby i firmy: [src/config/site.ts](../src/config/site.ts), ceny usług: pole „Ceny” w panelu (frontmatter `offers`).
>
> **Decyzje:** adres – tylko Warszawa (`Organization`, bez LocalBusiness) · `vatID` PL5833279388 – tak ·
> `areaServed` – Polska · `publisher` (WebSite i BlogPosting) – **Person** · zdjęcie – portret z hero ·
> ceny w `Service` – tak (Analiza profilu linków **od 1000 zł**, Link Gap **od 1200 zł** – wyższe kwoty dotyczą
> rozszerzonego zakresu z tabeli) · certyfikaty w `Person.hasCredential`: Kurs SEO 3.0 (SensAI Academy, 07.2025)
> i Wykorzystanie AI w rozwoju firmy (Google, 09.2025) · konsultacje – jedna cena 250 zł/h.
> **Nierozstrzygnięte (pominięte):** `foundingDate`, telefon, pakiety konsultacji, `about`/`mentions` we wpisach.
>
> Poniższe przykłady to pierwotna propozycja – tam, gdzie decyzja była inna, obowiązuje decyzja z tej ramki.

**Jak czytać:**
- 🌍 **GLOBALNIE** – ten sam fragment na każdej podstronie.
- 📄 **NA STRONIE** – fragment zależny od typu strony.
- ❓ **DO DECYZJI** – miejsca, w których potrzebuję Twojej odpowiedzi albo poprawki.
- ✅ **JEST** / 🆕 **NOWE** – czy element już działa, czy dopiero dochodzi.

Poprawki wpisuj bezpośrednio w ten plik (w JSON-ie albo w komentarzach pod nim) – wdrożę zgodnie z nim.

---

## 1. Mapa: co będzie na której stronie

| Strona | 🌍 Globalnie | 📄 Typ strony | 📄 Dodatkowo |
|---|---|---|---|
| `/` (strona główna) | Person, Organization, WebSite | 🆕 `WebPage` | — |
| `/o-mnie/` | ↑ | 🆕 `ProfilePage` | ✅ BreadcrumbList |
| `/oferta/` | ↑ | 🆕 `CollectionPage` | 🆕 `OfferCatalog` (lista 8 usług), ✅ BreadcrumbList |
| `/oferta/<usługa>/` (8×) | ↑ | 🆕 `WebPage` + ✅ `FAQPage` | 🆕 `Service` z cenami (`Offer`), ✅ BreadcrumbList |
| `/blog/` (+ `/page/N/`) | ↑ | 🆕 `CollectionPage` | 🆕 `ItemList` wpisów na stronie, ✅ BreadcrumbList |
| `/blog/<kategoria>/` (+ `/page/N/`) | ↑ | 🆕 `CollectionPage` | 🆕 `ItemList` wpisów, ✅ BreadcrumbList |
| `/blog/<wpis>/` | ↑ | 🆕 `WebPage` (+ ✅ `FAQPage`, jeśli wpis ma FAQ) | 🆕 `BlogPosting`, ✅ BreadcrumbList |
| `/kontakt/` | ↑ | 🆕 `ContactPage` + ✅ `FAQPage` | ✅ BreadcrumbList |
| `/polityka-prywatnosci/` | ↑ | 🆕 `WebPage` | ✅ BreadcrumbList |
| `/404`, `/kontakt/dziekuje/` | — (brak schemy, strony noindex) | — | — |

Wszystko w **jednym** bloku `<script type="application/ld+json">` na stronę, w formie `@graph`.
Elementy łączą się przez `@id` (np. wpis wskazuje autora `…/#person` zamiast powtarzać jego dane).

---

## 2. 🌍 GLOBALNIE – na każdej podstronie

### 2.1 Person – Ty

```json
{
  "@type": "Person",
  "@id": "https://kamilwnek.pl/#person",
  "name": "Kamil Wnęk",
  "url": "https://kamilwnek.pl/o-mnie/",
  "image": {
    "@type": "ImageObject",
    "url": "https://kamilwnek.pl/images/schema/kamil-wnek.jpg",
    "width": 800,
    "height": 1000
  },
  "jobTitle": "Specjalista SEO",
  "description": "Specjalista ds. SEO. Od 2018 roku pomagam firmom budować widoczność w Google i AI – od audytów, przez pozycjonowanie, po link building.",
  "email": "kontakt@kamilwnek.pl",
  "knowsAbout": ["SEO", "Techniczne SEO", "AI Search", "Link building", "Pozycjonowanie lokalne", "SEO e-commerce"],
  "worksFor": { "@id": "https://kamilwnek.pl/#organization" },
  "sameAs": [
    "https://www.linkedin.com/in/kamil-wnek/",
    "https://www.youtube.com/@kamil-wnek",
    "https://www.instagram.com/kamilwnekpl/",
    "https://www.tiktok.com/@kamilwnekseo"
  ]
}
```

- `knowsAbout`, `jobTitle` i `sameAs` – 1:1 z dawnych ustawień Rank Math.
- ❓ **Zdjęcie:** proponuję portret z hero strony głównej (IMG_3804), wystawiony pod **stałym adresem**
  `/images/schema/kamil-wnek.jpg`. Obrazki z `/_astro/` zmieniają nazwy przy zmianach – do schemy się nie nadają.
- ❓ **Dodać?** `alumniOf` (uczelnia), `hasCredential` (certyfikaty, np. Google Analytics), `award`. Jeśli masz – podaj.

### 2.2 Organization – W3 Digital Kamil Wnęk

```json
{
  "@type": "Organization",
  "@id": "https://kamilwnek.pl/#organization",
  "name": "W3 Digital Kamil Wnęk",
  "alternateName": "Kamil Wnęk – Specjalista SEO",
  "url": "https://kamilwnek.pl/",
  "logo": {
    "@type": "ImageObject",
    "url": "https://kamilwnek.pl/images/schema/logo.png",
    "width": 512,
    "height": 512
  },
  "email": "kontakt@kamilwnek.pl",
  "taxID": "5833279388",
  "vatID": "PL5833279388",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Warszawa",
    "addressCountry": "PL"
  },
  "areaServed": { "@type": "Country", "name": "Polska" },
  "founder": { "@id": "https://kamilwnek.pl/#person" },
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer service",
    "email": "kontakt@kamilwnek.pl",
    "url": "https://kamilwnek.pl/kontakt/",
    "availableLanguage": ["pl"]
  }
}
```

- `taxID` (NIP) i nazwa – z dawnych ustawień Rank Math i polityki prywatności.
- ❓ **`vatID`:** wystawiasz faktury VAT, więc zakładam numer VAT UE `PL5833279388`. Potwierdź albo usuń.
- ❓ **Typ:** `Organization` nie wymaga pełnego adresu (wystarczy miasto). Jeśli chcesz pokazać **pełny adres
  z ulicą** – zmienię na `ProfessionalService` (rodzaj LocalBusiness), co może pomóc lokalnie. Wymyślonego adresu
  nie wpisujemy.
- ❓ **`areaServed`:** cała Polska? (Konsultacje są online, pozycjonowanie lokalne obsługuje klientów z różnych miast.)
- ❓ **Dodać?** `foundingDate` (data założenia działalności), `telephone` (jeśli chcesz pokazywać numer).
- **Logo:** `Logo-512` (niebieski wykres) pod stałym adresem `/images/schema/logo.png`.
  Dawniej Rank Math podawał jako logo Twoje zdjęcie – to błąd, logo to logo.

### 2.3 WebSite

```json
{
  "@type": "WebSite",
  "@id": "https://kamilwnek.pl/#website",
  "url": "https://kamilwnek.pl/",
  "name": "Kamil Wnęk",
  "alternateName": ["kamilwnek.pl", "Kamil Wnęk – Specjalista SEO"],
  "description": "SEO oparte na danych, AI i strategii. Audyty, konsultacje, pozycjonowanie i link building.",
  "inLanguage": "pl-PL",
  "publisher": { "@id": "https://kamilwnek.pl/#organization" },
  "about": { "@id": "https://kamilwnek.pl/#person" }
}
```

- `name` = nazwa witryny, którą Google może pokazać w wynikach zamiast domeny.
- Bez `SearchAction` – strona nie ma wyszukiwarki.
- ❓ **`publisher`:** firma (W3 Digital) czy Ty osobiście (`#person`)? Proponuję firmę – to ona jest właścicielem serwisu.

---

## 3. 📄 Strony – fragmenty dodawane do globalnych

> Każda strona ma też węzeł strony (`WebPage` lub podtyp) – wzór wspólny:
> `@id` = adres + `#webpage`, `url`, `name` (= `<title>`), `description` (= meta description),
> `isPartOf` → `#website`, `inLanguage`, `breadcrumb` → `#breadcrumb` (jeśli są okruszki).

### 3.1 Strona główna `/`

```json
{
  "@type": "WebPage",
  "@id": "https://kamilwnek.pl/#webpage",
  "url": "https://kamilwnek.pl/",
  "name": "Freelancer SEO - Pozycjonowanie, audyty, konsultacje | Kamil Wnęk",
  "description": "SEO oparte na danych, AI i strategii. Pomagam firmom rosnąć w Google, dzięki audytom, konsultacjom i skutecznemu pozycjonowaniu.",
  "isPartOf": { "@id": "https://kamilwnek.pl/#website" },
  "about": { "@id": "https://kamilwnek.pl/#person" },
  "primaryImageOfPage": { "@type": "ImageObject", "url": "https://kamilwnek.pl/images/schema/kamil-wnek.jpg" },
  "inLanguage": "pl-PL"
}
```

### 3.2 O mnie `/o-mnie/`

```json
{
  "@type": "ProfilePage",
  "@id": "https://kamilwnek.pl/o-mnie/#webpage",
  "url": "https://kamilwnek.pl/o-mnie/",
  "name": "O mnie | Kamil Wnęk",
  "isPartOf": { "@id": "https://kamilwnek.pl/#website" },
  "mainEntity": { "@id": "https://kamilwnek.pl/#person" },
  "dateCreated": "2025-12-15",
  "dateModified": "2026-11-25",
  "breadcrumb": { "@id": "https://kamilwnek.pl/o-mnie/#breadcrumb" },
  "inLanguage": "pl-PL"
}
```

`ProfilePage` + `mainEntity` → Person: zalecane przez Google dla stron o autorze (sygnał E-E-A-T).

### 3.3 Oferta `/oferta/`

```json
[
  {
    "@type": "CollectionPage",
    "@id": "https://kamilwnek.pl/oferta/#webpage",
    "url": "https://kamilwnek.pl/oferta/",
    "name": "Usługi SEO i widoczności w AI – cennik | Kamil Wnęk",
    "isPartOf": { "@id": "https://kamilwnek.pl/#website" },
    "mainEntity": { "@id": "https://kamilwnek.pl/oferta/#catalog" },
    "breadcrumb": { "@id": "https://kamilwnek.pl/oferta/#breadcrumb" },
    "inLanguage": "pl-PL"
  },
  {
    "@type": "OfferCatalog",
    "@id": "https://kamilwnek.pl/oferta/#catalog",
    "name": "Usługi SEO",
    "itemListElement": [
      {
        "@type": "OfferCatalog",
        "name": "Strategia i Analiza",
        "itemListElement": [
          { "@type": "Offer", "itemOffered": { "@id": "https://kamilwnek.pl/oferta/konsultacje-seo/#service" } },
          { "@type": "Offer", "itemOffered": { "@id": "https://kamilwnek.pl/oferta/audyt-seo/#service" } }
        ]
      },
      {
        "@type": "OfferCatalog",
        "name": "Pozycjonowanie",
        "itemListElement": [
          { "@type": "Offer", "itemOffered": { "@id": "https://kamilwnek.pl/oferta/pozycjonowanie-stron/#service" } },
          { "@type": "Offer", "itemOffered": { "@id": "https://kamilwnek.pl/oferta/pozycjonowanie-lokalne/#service" } },
          { "@type": "Offer", "itemOffered": { "@id": "https://kamilwnek.pl/oferta/pozycjonowanie-sklepow/#service" } }
        ]
      },
      {
        "@type": "OfferCatalog",
        "name": "Linkbuilding",
        "itemListElement": [
          { "@type": "Offer", "itemOffered": { "@id": "https://kamilwnek.pl/oferta/analiza-profilu-linkow/#service" } },
          { "@type": "Offer", "itemOffered": { "@id": "https://kamilwnek.pl/oferta/link-building/#service" } },
          { "@type": "Offer", "itemOffered": { "@id": "https://kamilwnek.pl/oferta/link-gap/#service" } }
        ]
      }
    ]
  }
]
```

Grupy katalogu = kolumny mega menu (generowane automatycznie – nowa usługa dopisze się sama).
Dodatkowo w Organization (globalnie) pojawi się `"hasOfferCatalog": { "@id": "https://kamilwnek.pl/oferta/#catalog" }`.

### 3.4 Usługa `/oferta/<usługa>/` – przykład: Audyt SEO

```json
[
  {
    "@type": ["WebPage", "FAQPage"],
    "@id": "https://kamilwnek.pl/oferta/audyt-seo/#webpage",
    "url": "https://kamilwnek.pl/oferta/audyt-seo/",
    "name": "Audyt SEO strony i sklepu – raport z priorytetami | Kamil Wnęk",
    "description": "Audyt SEO: techniczne aspekty, treści i linki. Raport z priorytetami i omówienie wyników. Realizacja 10–40 dni roboczych.",
    "isPartOf": { "@id": "https://kamilwnek.pl/#website" },
    "about": { "@id": "https://kamilwnek.pl/oferta/audyt-seo/#service" },
    "datePublished": "2025-12-25",
    "dateModified": "2026-10-30",
    "breadcrumb": { "@id": "https://kamilwnek.pl/oferta/audyt-seo/#breadcrumb" },
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Czy audyt SEO wystarczy, żeby strona była wysoko w Google?",
        "acceptedAnswer": { "@type": "Answer", "text": "Nie. Audyt pokazuje, co zrobić, a efekt daje dopiero wdrożenie zaleceń." }
      }
    ],
    "inLanguage": "pl-PL"
  },
  {
    "@type": "Service",
    "@id": "https://kamilwnek.pl/oferta/audyt-seo/#service",
    "name": "Audyt SEO",
    "serviceType": "Audyt SEO",
    "description": "Audyt SEO: techniczne aspekty, treści i linki. Raport z priorytetami i omówienie wyników. Realizacja 10–40 dni roboczych.",
    "url": "https://kamilwnek.pl/oferta/audyt-seo/",
    "category": "Strategia i Analiza",
    "provider": { "@id": "https://kamilwnek.pl/#organization" },
    "areaServed": { "@type": "Country", "name": "Polska" },
    "availableChannel": {
      "@type": "ServiceChannel",
      "serviceUrl": "https://kamilwnek.pl/kontakt/",
      "availableLanguage": "pl"
    },
    "offers": [
      {
        "@type": "Offer",
        "name": "Strona firmowa (do 50 podstron)",
        "priceSpecification": {
          "@type": "PriceSpecification",
          "minPrice": 2500,
          "maxPrice": 3000,
          "priceCurrency": "PLN",
          "valueAddedTaxIncluded": false
        }
      },
      {
        "@type": "Offer",
        "name": "Sklep internetowy (do 5000 podstron)",
        "priceSpecification": {
          "@type": "PriceSpecification",
          "minPrice": 3500,
          "maxPrice": 7000,
          "priceCurrency": "PLN",
          "valueAddedTaxIncluded": false
        }
      },
      {
        "@type": "Offer",
        "name": "Duży serwis lub sklep – wycena indywidualna",
        "priceSpecification": {
          "@type": "PriceSpecification",
          "minPrice": 7000,
          "priceCurrency": "PLN",
          "valueAddedTaxIncluded": false
        }
      }
    ]
  }
]
```

- FAQ (`mainEntity`) – skrócone tu do 1 pytania; na stronie są wszystkie, jak teraz.
- Zmiana względem obecnego stanu: FAQPage przestaje być osobnym węzłem i staje się typem strony
  (`["WebPage", "FAQPage"]`) – tak jak robił Rank Math. Strona mówi „jestem FAQ” i „opisuję usługę X”.
- Ceny **netto** (`valueAddedTaxIncluded: false`) – dokładnie te z treści. Dla usług abonamentowych
  dochodzi rozliczenie miesięczne (`UnitPriceSpecification`, `unitCode: "MON"`).

**Ceny dla wszystkich usług (z treści stron) – ❓ sprawdź, czy aktualne:**

| Usługa | Proponowane `offers` |
|---|---|
| Konsultacje SEO | 250 zł netto / godzina (`unitCode: "HUR"`) – ❓ dodać pakiety 2 h / 5 h / 10 h z cenami? |
| Audyt SEO | 2500–3000 zł (firmowa) · 3500–7000 zł (sklep) · od 7000 zł (duży serwis) |
| Pozycjonowanie stron | od 2000 zł netto / mies. |
| Pozycjonowanie lokalne | od 1500 zł netto / mies. · sama optymalizacja wizytówki od 700 zł |
| Pozycjonowanie sklepów | od 3000 zł netto / mies. |
| Analiza profilu linków | od 1000 zł netto (w treści pojawia się też „od 1500 zł” – ❓ który wariant czego dotyczy?) |
| Link building | obsługa od 500 zł netto / mies. + budżet na publikacje (zwykle od 1000 zł / mies.) |
| Link Gap | od 1200 zł netto (w treści też „od 1800 zł” – ❓ jak wyżej) |

❓ **Ceny w ogóle:** jeśli wolisz nie pokazywać cen w schemie – `Service` zostaje, bez `offers`.
Ceny wtedy trzeba trzymać w jednym miejscu: dodam do każdej usługi pole „Ceny” w panelu CMS,
żeby treść i schema się nie rozjechały.

### 3.5 Blog `/blog/` i kategorie `/blog/<kategoria>/`

```json
[
  {
    "@type": "CollectionPage",
    "@id": "https://kamilwnek.pl/blog/techniczne-seo/#webpage",
    "url": "https://kamilwnek.pl/blog/techniczne-seo/",
    "name": "Techniczne SEO | Kamil Wnęk",
    "description": "…meta description kategorii…",
    "isPartOf": { "@id": "https://kamilwnek.pl/#website" },
    "mainEntity": { "@id": "https://kamilwnek.pl/blog/techniczne-seo/#list" },
    "breadcrumb": { "@id": "https://kamilwnek.pl/blog/techniczne-seo/#breadcrumb" },
    "inLanguage": "pl-PL"
  },
  {
    "@type": "ItemList",
    "@id": "https://kamilwnek.pl/blog/techniczne-seo/#list",
    "itemListOrder": "https://schema.org/ItemListOrderDescending",
    "numberOfItems": 2,
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "url": "https://kamilwnek.pl/blog/dane-strukturalne-czym-sa-i-jak-wdrozyc-poradnik-schema-org/" },
      { "@type": "ListItem", "position": 2, "url": "https://kamilwnek.pl/blog/audyt-techniczny-seo-na-co-zwracac-uwage-i-jak-go-przeprowadzic/" }
    ]
  }
]
```

- Na `/blog/` to samo, z nazwą „Blog | Kamil Wnęk”.
- Lista zawiera tylko wpisy z **danej strony paginacji** (maks. 9).
- Kategorie z `noindex` (puste) – też dostaną schemę, ale Google i tak ich nie indeksuje.

### 3.6 Wpis `/blog/<wpis>/` – przykład: Dane strukturalne

```json
[
  {
    "@type": ["WebPage", "FAQPage"],
    "@id": "https://kamilwnek.pl/blog/dane-strukturalne-czym-sa-i-jak-wdrozyc-poradnik-schema-org/#webpage",
    "url": "https://kamilwnek.pl/blog/dane-strukturalne-czym-sa-i-jak-wdrozyc-poradnik-schema-org/",
    "name": "Dane strukturalne – kompletny poradnik | Kamil Wnęk",
    "isPartOf": { "@id": "https://kamilwnek.pl/#website" },
    "breadcrumb": { "@id": "https://kamilwnek.pl/blog/dane-strukturalne-czym-sa-i-jak-wdrozyc-poradnik-schema-org/#breadcrumb" },
    "mainEntity": [ "…5 pytań FAQ, jak teraz…" ],
    "inLanguage": "pl-PL"
  },
  {
    "@type": "BlogPosting",
    "@id": "https://kamilwnek.pl/blog/dane-strukturalne-czym-sa-i-jak-wdrozyc-poradnik-schema-org/#article",
    "headline": "Dane strukturalne – czym są i jak wdrożyć? Poradnik Schema.org",
    "description": "Sprawdź, jak wdrożyć Schema.org na stronie. Poznaj najważniejsze typy danych strukturalnych, przykłady JSON-LD oraz znaczenie Schema dla SEO i AI.",
    "image": {
      "@type": "ImageObject",
      "url": "https://kamilwnek.pl/_astro/dane-strukturalne-hero.….jpg",
      "width": 1200,
      "height": 800
    },
    "datePublished": "2026-06-19T10:18:54+00:00",
    "dateModified": "2026-10-30T20:22:46+00:00",
    "author": { "@id": "https://kamilwnek.pl/#person" },
    "publisher": { "@id": "https://kamilwnek.pl/#organization" },
    "mainEntityOfPage": { "@id": "https://kamilwnek.pl/blog/dane-strukturalne-czym-sa-i-jak-wdrozyc-poradnik-schema-org/#webpage" },
    "articleSection": ["Techniczne SEO", "Podstawy SEO"],
    "wordCount": 1650,
    "timeRequired": "PT8M",
    "inLanguage": "pl-PL"
  }
]
```

- Wszystko generowane automatycznie z pól wpisu w panelu (tytuł, opis, daty, okładka, kategorie).
- `image` – okładka w wersji 1200 px (to ta sama, co w `og:image`; tu adres z hashem jest OK,
  bo generuje się przy każdym buildzie razem ze stroną).
- `wordCount` / `timeRequired` – liczone z treści (jak „X min czytania” na stronie).
- ❓ **Dodać?** `about` / `mentions` (np. encje z Wikidata dla tematu wpisu) – ciekawe pod AI, ale wymaga
  ręcznego wskazania przy każdym wpisie. Mogę dodać opcjonalne pole w panelu.

### 3.7 Kontakt `/kontakt/`

```json
{
  "@type": ["ContactPage", "FAQPage"],
  "@id": "https://kamilwnek.pl/kontakt/#webpage",
  "url": "https://kamilwnek.pl/kontakt/",
  "name": "Kontakt – bezpłatna rozmowa i wycena SEO | Kamil Wnęk",
  "isPartOf": { "@id": "https://kamilwnek.pl/#website" },
  "about": { "@id": "https://kamilwnek.pl/#organization" },
  "breadcrumb": { "@id": "https://kamilwnek.pl/kontakt/#breadcrumb" },
  "mainEntity": [ "…3 pytania FAQ, jak teraz…" ],
  "inLanguage": "pl-PL"
}
```

Dane kontaktowe (e-mail, adres strony kontaktu) są w `contactPoint` firmy – globalnie (pkt 2.2).

### 3.8 Polityka prywatności `/polityka-prywatnosci/`

Tylko `WebPage` (wzór wspólny) + ✅ BreadcrumbList. Bez dodatków.

---

## 4. Czego celowo NIE dodaję

| Typ | Dlaczego |
|---|---|
| `LocalBusiness` / `ProfessionalService` | wymaga pełnego adresu z ulicą – czekam na decyzję (pkt 2.2) |
| `Review`, `AggregateRating` | opinie wystawione samemu sobie nie są wyświetlane przez Google; na stronie nie ma opinii klientów |
| `SearchAction` (sitelinks searchbox) | strona nie ma wyszukiwarki; Google i tak wycofał tę funkcję |
| `SiteNavigationElement` | brak realnego zysku, tylko ciężar kodu |
| `Event`, `Course`, `Product`, `HowTo` | nie pasują do obecnych treści |

---

## 5. Lista decyzji ❓ (podsumowanie)

1. **Adres:** tylko „Warszawa” (`Organization`) czy pełny adres (`ProfessionalService`)?
2. **`vatID` PL5833279388** – potwierdzasz?
3. **`areaServed`:** cała Polska?
4. **`publisher` strony:** firma (proponuję) czy Ty?
5. **Zdjęcie do schemy:** portret z hero (IMG_3804) – OK?
6. **Ceny w `Service`:** tak / nie? Jeśli tak – sprawdź tabelę w 3.4 (zwłaszcza dwie ceny przy Analizie profilu linków i Link Gap).
7. **Dodatki do Person:** uczelnia, certyfikaty, nagrody? `foundingDate`, telefon do Organization?
8. **`about` / `mentions` we wpisach** (pole w panelu): tak / nie?
