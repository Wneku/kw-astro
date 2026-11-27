<?php
/**
 * Obsługa formularzy kontaktowych kamilwnek.pl – wysyłka maila z serwera (seohost, PHP mail()).
 *
 * Formularz (src/components/forms/ContactForm.astro) wysyła POST na /api/kontakt.php.
 *  - z JS:  odpowiedź JSON { success, message }
 *  - bez JS: przekierowanie na /kontakt/dziekuje/ albo prosta strona z błędem
 *
 * Ochrona: honeypot, pułapka czasowa, sprawdzenie Origin, limit wysyłek z jednego IP,
 * walidacja pól i blokada wstrzykiwania nagłówków.
 * Na localhost wiadomości NIE są wysyłane – trafiają do pliku logu (tryb testowy).
 */
declare(strict_types=1);

/* ───────────── Konfiguracja ───────────── */
const RECIPIENT     = 'kontakt@kamilwnek.pl';  // dokąd trafiają wiadomości
const SENDER        = 'kontakt@kamilwnek.pl';  // nadawca – musi istnieć jako skrzynka w domenie na seohost
const SITE_NAME     = 'kamilwnek.pl';
const ALLOWED_HOSTS = ['kamilwnek.pl', 'www.kamilwnek.pl', 'localhost', '127.0.0.1'];
const THANK_YOU_URL = '/kontakt/dziekuje/';
const RATE_LIMIT    = 5;    // maks. wiadomości…
const RATE_WINDOW   = 600;  // …na 10 minut z jednego IP
const MIN_FILL_TIME = 3;    // sekundy – szybciej wypełniają tylko boty

/* ───────────── Pomocnicze ───────────── */
$wantsJson = str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json');
$host      = strtolower(explode(':', $_SERVER['HTTP_HOST'] ?? '')[0]);
$isLocal   = in_array($host, ['localhost', '127.0.0.1'], true);

function respond(bool $ok, string $message, int $status = 200): void
{
    global $wantsJson;
    http_response_code($status);
    if ($wantsJson) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success' => $ok, 'message' => $message], JSON_UNESCAPED_UNICODE);
    } elseif ($ok) {
        header('Location: ' . THANK_YOU_URL, true, 303);
    } else {
        header('Content-Type: text/html; charset=utf-8');
        $msg = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
        echo "<!doctype html><html lang=\"pl\"><meta charset=\"utf-8\"><meta name=\"robots\" content=\"noindex\">"
           . "<title>Nie udało się wysłać wiadomości</title>"
           . "<body style=\"font-family:system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem;color:#3a4f66\">"
           . "<h1 style=\"color:#192a3d\">Nie udało się wysłać wiadomości</h1><p>{$msg}</p>"
           . "<p><a href=\"/kontakt/\" style=\"color:#2872fa\">← Wróć do formularza</a></p></body></html>";
    }
    exit;
}

/** Usuwa znaki nowej linii (ochrona przed wstrzykiwaniem nagłówków) i przycina. */
function clean(string $value, int $max): string
{
    $value = trim(preg_replace('/[\r\n\t]+/', ' ', $value) ?? '');
    return mb_substr($value, 0, $max);
}

/* ───────────── Kontrole ───────────── */
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    respond(false, 'Niedozwolona metoda.', 405);
}

// Żądanie musi przyjść z naszej strony
$origin = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '';
if ($origin !== '') {
    $originHost = strtolower((string) parse_url($origin, PHP_URL_HOST));
    // dozwolone: lista powyżej + dowolna subdomena kamilwnek.pl (np. testowa nowa.kamilwnek.pl)
    if (!in_array($originHost, ALLOWED_HOSTS, true) && !str_ends_with($originHost, '.kamilwnek.pl')) {
        respond(false, 'Nieprawidłowe źródło żądania.', 403);
    }
}

// Honeypot – pole niewidoczne dla ludzi; boty je wypełniają. Udajemy sukces, żeby bot nie próbował dalej.
if (!empty($_POST['website'])) {
    respond(true, 'Dziękuję! Wiadomość została wysłana.');
}

// Pułapka czasowa (ts ustawia JS przy wczytaniu strony; bez JS pole jest puste i kontrola jest pomijana)
$ts = (int) ($_POST['ts'] ?? 0);
if ($ts > 0 && (time() - intdiv($ts, 1000)) < MIN_FILL_TIME) {
    respond(true, 'Dziękuję! Wiadomość została wysłana.');
}

/* ───────────── Walidacja ───────────── */
$name    = clean((string) ($_POST['name'] ?? ''), 100);
$email   = clean((string) ($_POST['email'] ?? ''), 200);
$message = trim(mb_substr((string) ($_POST['message'] ?? ''), 0, 5000));
$source  = clean((string) ($_POST['source'] ?? 'kamilwnek.pl'), 120);
$consent = ($_POST['zgoda'] ?? '') === 'tak';

$errors = [];
if ($name === '')                                   $errors[] = 'Podaj imię.';
if (!filter_var($email, FILTER_VALIDATE_EMAIL))     $errors[] = 'Podaj poprawny adres e-mail.';
if (mb_strlen($message) < 10)                       $errors[] = 'Wiadomość jest za krótka (min. 10 znaków).';
if (!$consent)                                      $errors[] = 'Zaznacz zgodę na przetwarzanie danych.';
if ($errors) {
    respond(false, implode(' ', $errors), 422);
}

/* ───────────── Limit wysyłek z jednego IP ───────────── */
$ip       = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateFile = sys_get_temp_dir() . '/kw-form-' . hash('sha256', $ip . SITE_NAME) . '.json';
$now      = time();
$hits     = is_file($rateFile) ? (json_decode((string) file_get_contents($rateFile), true) ?: []) : [];
$hits     = array_values(array_filter($hits, fn ($t) => is_int($t) && $t > $now - RATE_WINDOW));
if (count($hits) >= RATE_LIMIT) {
    respond(false, 'Wysłano zbyt wiele wiadomości. Spróbuj ponownie za kilka minut albo napisz na ' . RECIPIENT . '.', 429);
}
$hits[] = $now;
@file_put_contents($rateFile, json_encode($hits), LOCK_EX);

/* ───────────── Wiadomość ───────────── */
$subject = 'Nowe zapytanie: ' . $source;
// wersja testowa (subdomena) – od razu widać w skrzynce, że to nie prawdziwe zapytanie
$host = preg_replace('/[^a-z0-9.:-]/', '', strtolower($_SERVER['HTTP_HOST'] ?? ''));
if ($host !== 'kamilwnek.pl' && $host !== 'www.kamilwnek.pl') $subject = '[TEST ' . $host . '] ' . $subject;
$body = implode("\n", [
    "Nowa wiadomość z formularza na " . SITE_NAME,
    str_repeat('-', 48),
    "Imię:      {$name}",
    "E-mail:    {$email}",
    "Strona:    {$source}",
    "Data:      " . date('Y-m-d H:i:s'),
    str_repeat('-', 48),
    '',
    $message,
    '',
    str_repeat('-', 48),
    "IP: {$ip}",
    'Przeglądarka: ' . clean((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 300),
    'Zgoda na przetwarzanie danych: tak',
]);

$encode  = fn (string $s) => '=?UTF-8?B?' . base64_encode($s) . '?=';
$headers = implode("\r\n", [
    'From: ' . $encode(SITE_NAME) . ' <' . SENDER . '>',
    'Reply-To: ' . $encode($name) . ' <' . $email . '>',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    'X-Mailer: kamilwnek.pl',
]);

/* ───────────── Wysyłka ───────────── */
if ($isLocal) {
    // Tryb testowy: zapis do logu zamiast wysyłki
    $log = sys_get_temp_dir() . '/kamilwnek-form-test.log';
    file_put_contents($log, "=== {$subject}\n{$headers}\n\n{$body}\n\n", FILE_APPEND | LOCK_EX);
    respond(true, 'Dziękuję! (tryb testowy – wiadomość zapisana w ' . $log . ')');
}

$sent = mail(RECIPIENT, $encode($subject), $body, $headers, '-f' . SENDER);
if (!$sent) {
    error_log('[kamilwnek.pl] mail() nie wysłał wiadomości od ' . $email);
    respond(false, 'Nie udało się wysłać wiadomości. Spróbuj ponownie albo napisz na ' . RECIPIENT . '.', 500);
}

respond(true, 'Dziękuję! Wiadomość została wysłana – odpowiem najszybciej, jak to możliwe.');
