<?xml version="1.0" encoding="UTF-8"?>
<!-- Czytelny podgląd sitemapy w przeglądarce. Roboty czytają sam XML – ten plik ich nie dotyczy. -->
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html lang="pl">
      <head>
        <meta charset="utf-8"/>
        <meta name="robots" content="noindex"/>
        <title>Mapa witryny – kamilwnek.pl</title>
        <style>
          body{font:15px/1.5 system-ui,sans-serif;color:#333;margin:0;padding:2rem;max-width:1100px;margin-inline:auto}
          h1{font-size:1.5rem;margin:0 0 .25rem;color:#111}
          p{margin:0 0 1.5rem;color:#666}
          table{width:100%;border-collapse:collapse}
          th,td{text-align:left;padding:.5rem .75rem;border-bottom:1px solid #e5e5e5;vertical-align:top}
          th{background:#f6f6f6;font-weight:600}
          td.n{text-align:right;white-space:nowrap;width:1%}
          a{color:#2872fa;text-decoration:none;word-break:break-all}
          a:hover{text-decoration:underline}
        </style>
      </head>
      <body>
        <h1>Mapa witryny</h1>
        <xsl:choose>
          <xsl:when test="s:sitemapindex">
            <p>Spis map: <xsl:value-of select="count(s:sitemapindex/s:sitemap)"/></p>
            <table>
              <tr><th>Mapa</th><th>Ostatnia zmiana</th></tr>
              <xsl:for-each select="s:sitemapindex/s:sitemap">
                <tr>
                  <td><a href="{s:loc}"><xsl:value-of select="s:loc"/></a></td>
                  <td class="n"><xsl:value-of select="substring(s:lastmod,1,10)"/></td>
                </tr>
              </xsl:for-each>
            </table>
          </xsl:when>
          <xsl:otherwise>
            <p>Adresów: <xsl:value-of select="count(s:urlset/s:url)"/> · <a href="/sitemap_index.xml">← spis map</a></p>
            <table>
              <tr><th>Adres</th><th>Obrazki</th><th>Ostatnia zmiana</th></tr>
              <xsl:for-each select="s:urlset/s:url">
                <tr>
                  <td><a href="{s:loc}"><xsl:value-of select="s:loc"/></a></td>
                  <td class="n"><xsl:value-of select="count(image:image)"/></td>
                  <td class="n"><xsl:value-of select="substring(s:lastmod,1,10)"/></td>
                </tr>
              </xsl:for-each>
            </table>
          </xsl:otherwise>
        </xsl:choose>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
