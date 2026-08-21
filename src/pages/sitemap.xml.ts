import type { APIRoute } from 'astro';
import { LOCALES, rota } from '../i18n/ui';

/**
 * Sitemap gerado no build.
 *
 * Sao duas URLs, e uma integracao inteira para isso seria peso morto. Cada
 * entrada declara a alternativa no outro idioma, que e o que faz o buscador
 * entender pt e en como a mesma pagina em duas linguas, e nao como duplicata.
 */
export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL('https://selflabs.org');
  const hoje = new Date().toISOString().slice(0, 10);

  const hreflang = (locale: (typeof LOCALES)[number]) => (locale === 'pt' ? 'pt-BR' : 'en');

  const urls = LOCALES.map((locale) => {
    const alternativas = LOCALES.map(
      (outro) =>
        `    <xhtml:link rel="alternate" hreflang="${hreflang(outro)}" href="${new URL(rota(outro), base).href}"/>`,
    ).join('\n');

    return `  <url>
    <loc>${new URL(rota(locale), base).href}</loc>
    <lastmod>${hoje}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${locale === 'pt' ? '1.0' : '0.8'}</priority>
${alternativas}
    <xhtml:link rel="alternate" hreflang="x-default" href="${new URL('/', base).href}"/>
  </url>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
};
