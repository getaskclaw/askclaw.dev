import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Production root is the default: `npm run build` with no SITE_BASE builds the real site.
// The preview deployment sets SITE_BASE=/astro-preview/ and must stay out of search engines,
// so the sitemap integration is only enabled for the production root (base === '/').
const base = process.env.SITE_BASE || '/';

export default defineConfig({
  site: 'https://askclaw.dev',
  base,
  trailingSlash: 'always',
  output: 'static',
  redirects: {
    '/axes.html': { destination: '/rank/', status: 301 },
  },
  // Keep retired HTML absent. The static host must apply the HTTP 301 above
  // (Caddy: redir /axes.html /rank/ 301); Astro's HTML fallback is not an HTTP 301.
  build: { redirects: false },
  integrations: base === '/' ? [
    sitemap({
      i18n: {
        defaultLocale: 'zh-CN',
        locales: {
          'zh-CN': 'zh-CN',
          en: 'en',
        },
      },
      namespaces: { xhtml: true },
    }),
  ] : [],
});
