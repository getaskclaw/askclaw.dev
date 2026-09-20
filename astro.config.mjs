import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://askclaw.dev',
  base: process.env.SITE_BASE || '/',
  trailingSlash: 'always',
  output: 'static',
  integrations: [
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
  ],
});
