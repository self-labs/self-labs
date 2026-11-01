import type { APIRoute } from 'astro';
import { LOCALES, rota, ui, type Locale } from '../i18n/ui';

/**
 * Sitemap gerado no build.
 *
 * Sao quatro URLs, e uma integracao inteira para isso seria peso morto. Cada
 * entrada declara a alternativa no outro idioma, que e o que faz o buscador
 * entender pt e en como a mesma pagina em duas linguas, e nao como duplicata.
 *
 * A politica de privacidade tem caminho proprio em cada idioma (/privacidade e
 * /en/privacy), entao cada pagina declara o caminho por locale, e nunca um so.
 */
const PAGINAS: { caminho: Record<Locale, string>; prioridade: Record<Locale, string>; frequencia: string }[] = [
  { caminho: { pt: '', en: '' }, prioridade: { pt: '1.0', en: '0.8' }, frequencia: 'monthly' },
  {
    caminho: { pt: ui.pt.privacidade.caminho, en: ui.en.privacidade.caminho },
    prioridade: { pt: '0.3', en: '0.2' },
    frequencia: 'yearly',
  },
];

export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL('https://selflabs.org');
  const hoje = new Date().toISOString().slice(0, 10);

  const hreflang = (locale: Locale) => (locale === 'pt' ? 'pt-BR' : 'en');

  const urls = PAGINAS.flatMap((pagina) =>
    LOCALES.map((locale) => {
      const endereco = (l: Locale) => new URL(rota(l, pagina.caminho[l]), base).href;
      const alternativas = LOCALES.map(
        (outro) => `    <xhtml:link rel="alternate" hreflang="${hreflang(outro)}" href="${endereco(outro)}"/>`,
      ).join('\n');

      return `  <url>
    <loc>${endereco(locale)}</loc>
    <lastmod>${hoje}</lastmod>
    <changefreq>${pagina.frequencia}</changefreq>
    <priority>${pagina.prioridade[locale]}</priority>
${alternativas}
    <xhtml:link rel="alternate" hreflang="x-default" href="${endereco('pt')}"/>
  </url>`;
    }),
  ).join('\n');

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
