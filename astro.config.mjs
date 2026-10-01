import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// The /rank/ board data is generated from amber.db, never edited by hand: amber-run's
// tools/amberdb/sync_site.py writes src/data/axes.json together with axes.provenance.json.
// Every build checks the pair, so a hand edit (or a stale provenance) fails the build.
const axesSha = createHash('sha256').update(readFileSync(new URL('./src/data/axes.json', import.meta.url))).digest('hex');
const provenance = JSON.parse(readFileSync(new URL('./src/data/axes.provenance.json', import.meta.url), 'utf8'));
if (provenance.axes_sha256 !== axesSha) {
  throw new Error(
    `src/data/axes.json (sha256 ${axesSha.slice(0, 12)}) does not match axes.provenance.json ` +
    `(${String(provenance.axes_sha256).slice(0, 12)}). Do not edit axes.json by hand; regenerate it ` +
    'from amber.db with amber-run tools/amberdb/sync_site.py --site <this checkout> --write.'
  );
}

// Production root is the default: `npm run build` with no SITE_BASE builds the real site.
// The preview deployment sets SITE_BASE=/astro-preview/ and must stay out of search engines,
// so the sitemap integration is only enabled for the production root (base === '/').
const base = process.env.SITE_BASE || '/';

export default defineConfig({
  site: 'https://askclaw.dev',
  base,
  trailingSlash: 'always',
  output: 'static',
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
