/**
 * Generuje dist/.htaccess dla hostingu seohost (LiteSpeed/Apache):
 *  - HTTPS + domena bez www,
 *  - 301 ze starych adresów WordPressa (feed, sitemapy Rank Math, autor, paginacja, obrazki),
 *  - strona 404, cache dla zasobów, nagłówki bezpieczeństwa.
 */
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default function htaccess({ host = 'kamilwnek.pl' } = {}) {
  return {
    name: 'htaccess',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        const mapFile = path.join(out, 'wp-image-map.json');
        let imageRules = '';
        try {
          const map = JSON.parse(await fs.readFile(mapFile, 'utf8'));
          imageRules = map
            .map(({ oldPath, ext, target }) => {
              const from = escapeRe(oldPath.slice(1)); // bez wiodącego "/"
              // oryginał + warianty WordPressa: -300x200, -scaled
              return `RewriteRule ^${from}(-\\d+x\\d+|-scaled)?\\.${ext}$ ${target} [R=301,L,NC]`;
            })
            .join('\n');
          await fs.rm(mapFile);
          logger.info(`przekierowania obrazków: ${map.length}`);
        } catch (e) {
          logger.warn(`brak mapy obrazków (${e.message})`);
        }

        const hostRe = escapeRe(host);
        const content = `# Wygenerowane automatycznie przez src/integrations/htaccess.mjs – nie edytuj w dist/
Options -MultiViews -Indexes
DirectoryIndex index.html
# /o-mnie → 301 → /o-mnie/ (jeden adres na stronę)
DirectorySlash On
ErrorDocument 404 /404.html

<IfModule mod_rewrite.c>
RewriteEngine On

# Domena bez www
RewriteCond %{HTTP_HOST} ^www\\.${hostRe}$ [NC]
RewriteRule ^ https://${host}%{REQUEST_URI} [R=301,L,NE]
# HTTPS (z obsługą proxy) – na tę samą domenę, więc działa też na subdomenie testowej
RewriteCond %{HTTPS} !=on
RewriteCond %{HTTP:X-Forwarded-Proto} !=https
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L,NE]

# Stare adresy WordPressa
RewriteRule ^(blog/)?feed/?$ /rss.xml [R=301,L]
RewriteRule ^(.+)/feed/?$ /$1/ [R=301,L]
RewriteRule ^(sitemap_index|page-sitemap|post-sitemap|category-sitemap|sitemap)\\.xml$ /sitemap-index.xml [R=301,L]
RewriteRule ^author/ /o-mnie/ [R=301,L]
RewriteRule ^strona-glowna/?$ / [R=301,L]
# paginacja: /page/1/ to strona główna listingu (kolejne strony istnieją)
RewriteRule ^blog/page/1/?$ /blog/ [R=301,L]
RewriteRule ^blog/([^/]+)/page/1/?$ /blog/$1/ [R=301,L]
# kategorie: dawniej /blog/k/<kategoria>/ (WordPress), teraz /blog/<kategoria>/
RewriteRule ^blog/k/([^/]+)/page/1/?$ /blog/$1/ [R=301,L]
RewriteRule ^blog/k/(.*)$ /blog/$1 [R=301,L]
RewriteRule ^(wp-admin|wp-login\\.php|xmlrpc\\.php|wp-json) - [G,L]

# Obrazki z /wp-content/uploads/ → zoptymalizowane pliki Astro
${imageRules}
</IfModule>

<IfModule mod_expires.c>
ExpiresActive On
ExpiresByType text/html "access plus 0 seconds"
ExpiresByType text/css "access plus 1 year"
ExpiresByType application/javascript "access plus 1 year"
ExpiresByType image/webp "access plus 1 year"
ExpiresByType image/avif "access plus 1 year"
ExpiresByType image/png "access plus 1 month"
ExpiresByType image/jpeg "access plus 1 month"
ExpiresByType image/svg+xml "access plus 1 month"
ExpiresByType font/woff2 "access plus 1 year"
</IfModule>

<IfModule mod_headers.c>
<FilesMatch "\\.(css|js|woff2|webp|avif)$">
Header set Cache-Control "public, max-age=31536000, immutable"
</FilesMatch>
<FilesMatch "\\.html$">
Header set Cache-Control "public, max-age=0, must-revalidate"
</FilesMatch>
Header always set X-Content-Type-Options "nosniff"
Header always set Referrer-Policy "strict-origin-when-cross-origin"
Header always set X-Frame-Options "SAMEORIGIN"
Header always set Permissions-Policy "camera=(), microphone=(), geolocation=()"
</IfModule>

<IfModule mod_deflate.c>
AddOutputFilterByType DEFLATE text/html text/css text/plain text/xml application/javascript application/json application/xml application/rss+xml image/svg+xml
</IfModule>
`;
        await fs.writeFile(path.join(out, '.htaccess'), content);
        logger.info('zapisano .htaccess');
      },
    },
  };
}
