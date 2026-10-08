import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import zhFirstRedirects from './scripts/zh-first-redirects.mjs';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// Board and picker data are generated from amber.db, never edited by hand: amber-run's
// tools/amberdb/sync_site.py writes src/data/axes.json and src/data/site-data.json together with
// axes.provenance.json. Every build checks both against it, so a hand edit (or a stale provenance)
// fails the build.
const provenance = JSON.parse(readFileSync(new URL('./src/data/axes.provenance.json', import.meta.url), 'utf8'));
for (const [file, key] of [['axes.json', 'axes_sha256'], ['site-data.json', 'site_data_sha256']]) {
  const sha = createHash('sha256').update(readFileSync(new URL(`./src/data/${file}`, import.meta.url))).digest('hex');
  if (provenance[key] !== sha) {
    throw new Error(
      `src/data/${file} (sha256 ${sha.slice(0, 12)}) does not match axes.provenance.json ${key} ` +
      `(${String(provenance[key]).slice(0, 12)}). Do not edit it by hand; regenerate it from amber.db ` +
      'with amber-run tools/amberdb/sync_site.py --site <this checkout> --write.'
    );
  }
}
// Pages that are built and reachable but not launched yet: kept out of the sitemap (and noindex).
const UNLISTED = [];

// Production root is the default: `npm run build` with no SITE_BASE builds the real site.
// The preview deployment sets SITE_BASE=/astro-preview/ and must stay out of search engines,
// so the sitemap integration is only enabled for the production root (base === '/').
const base = process.env.SITE_BASE || '/';

export default defineConfig({
  site: 'https://askclaw.dev',
  base,
  trailingSlash: 'always',
  output: 'static',
  integrations: [zhFirstRedirects(base), ...(base === '/' ? [
    sitemap({
      // /model/<name>/ and /provider/<name>/ (both languages) are redirects to /<name>/: not listed.
      // The old /zh/... addresses the build rewrites to the plain path are not listed either.
      filter: (page) => {
        const pathname = new URL(page).pathname;
        return !UNLISTED.some((path) => pathname === path)
          && !/^\/zh(?:\/|$)/.test(pathname)
          && !/^(?:\/en)?\/(?:model|provider)\//.test(pathname);
      },
      i18n: {
        defaultLocale: 'zh',
        locales: {
          zh: 'zh-CN',
          en: 'en',
        },
      },
      namespaces: { xhtml: true },
    }),
  ] : [])],
});
