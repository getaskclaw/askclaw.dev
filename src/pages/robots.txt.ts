import type { APIRoute } from 'astro';

const site = 'https://askclaw.dev';

export const GET: APIRoute = () => {
  const baseUrl = new URL(import.meta.env.BASE_URL, site);
  const sitemap = new URL('sitemap-index.xml', baseUrl).href;

  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};