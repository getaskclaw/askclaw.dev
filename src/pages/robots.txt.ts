import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  if (!site) throw new Error('Astro.site is required to build robots.txt');
  const baseUrl = new URL(import.meta.env.BASE_URL, site);

  // Only the production root is crawlable. The preview deployment (base != '/') must not
  // be indexed and must not advertise a sitemap: it would be a duplicate of the real site.
  if (import.meta.env.BASE_URL !== '/') {
    return new Response('User-agent: *\nDisallow: /\n', {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }

  const sitemap = new URL('sitemap-index.xml', baseUrl).href;

  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
