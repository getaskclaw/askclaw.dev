# English-first route migration — reconnaissance and release handoff

## Authority and frozen scope

Work order: `enfirst-site`, 2026-10-07. The reconnaissance was recorded before implementation. This branch changes routes and language plumbing only. Scores, case data, page wording, public assets and the original claims assertions remain unchanged. Vesper retains acceptance, merge and deployment authority. No deployment is performed by this branch.

Baseline: the work order names `2ebb9d1`; the later owner instruction explicitly makes the live `git ls-remote origin main` result authoritative if SHAs differ. The working clone's live value was `c180bb0954ad84ba7e6a6baa732ac7f85cb2437d`. The migration is based on that observed value, not an invented replacement SHA.

Budget decision: owner 2026-10-07 B3 explicitly approves **230,000 → 250,000 bytes for the English default homepage**, because changing the default language causes structural growth. This is a named owner decision, not silent guardrail drift. The old checkout's 260,000-byte allowance is not retained. `acceptance.mjs` keeps the same uncompressed navigation-plus-resource `transferSize` measurement and fails at 250,000 bytes. No scores, counts, weeks or claims thresholds are changed to obtain a pass.

## Reconnaissance: change surfaces

- Paired pages: old English `/en/...` content moves to `/...`; old Chinese root pages move to `/zh/...`. Imports and links move with them, without rewriting copy.
- Chinese-only method and notes pages move to `/zh/`; old paths redirect there. No English translations are invented.
- `BaseLayout`, `SiteHeader`, `ChatDrawer` and entity URL helpers contain language-sensitive links. They must move together; moving page files alone would leave broken or wrong-language navigation.
- The existing `askclaw-lang` values remain `en` and `zh-CN`. The script resolves the updated alternate links; no storage migration or browser-locale guessing is needed. The default/x-default is English.
- Canonical, `og:url`, JSON-LD and alternate links use the new URL space. The production sitemap contains only content pages; preview stays noindex and has no sitemap.
- Static Astro HTML refresh pages cannot return HTTP 301. A build integration emits fallback HTML plus an exact redirect manifest and a Caddy include. Verification must exercise a real server, not count meta refresh as HTTP 301.
- Gate path expectations and the claims registry move with pages. Historical scores and all other registry values stay identical.

## Redirect artifacts and deployment dependency

Each build emits:

- `dist/_en-first.caddy`: importable Caddy redirect directives.
- `dist/_en-first-redirects.json`: enumerated source-to-target mappings with status 301 and the build base.
- Static fallback pages for existing `/en/...` and moved Chinese-only paths.

The manifest includes every old English route, including model/provider aliases. `/en/...` first redirects to its unprefixed equivalent; a pre-existing model/provider alias then redirects to its final entity page. Single-lane provider anchors are retained. GET and HEAD, with and without trailing slashes, `index.html` spellings, query strings, final content and fragment targets are tested. A bounded `/en/` fallback strips the prefix for additional paths; it does not match `/english/`.

Vesper's release must import `_en-first.caddy` **inside the existing site block, before any URI rewriting or `file_server` handling**, and publish the matching `dist/` in the same release. For a prefix build the redirects include that prefix and must execute before `handle_path` strips it. Copying HTML alone is not enough for HTTP 301. Run `caddy validate` against the actual combined site configuration before reload. Local verification is not a claim that production has been updated.

## Verification

Dependencies: `npm ci`, `npx playwright install chromium`, Python 3, and Caddy on PATH or `CADDY_BIN=/path/to/caddy`. Set `LEGACY_SITE_ROOT` to the unchanged legacy chart checkout as documented in README. `verify-dist.py` fails if Caddy is missing; it does not skip HTTP evidence.

Run each set for the production root and `SITE_BASE=/astro-preview/`:

```sh
npm run build
npm run acceptance
python3 scripts/verify-dist.py
npm run check-claims
npm run test:claims
```

Set `SITE_BASE` on the build for preview; the gates infer the built base even when that variable is not exported to the next process. Use `NODE_OPTIONS=--max-old-space-size=2560` for bounded builds. Tests start an ephemeral loopback-only Caddy with its admin API disabled, and terminate it afterward. They never reload a live service.

For one-time migration preservation, retain the baseline production `dist/`, then run:

```sh
python3 scripts/verify-migration.py --baseline-dist /path/to/baseline-dist --baseline-ref <baseline-sha>
```

This compares all original content-page body text, accessibility labels, image alt text, titles and description/keyword metadata by old-to-new route; checks every tracked `src/data/` and `public/` file byte-for-byte; and proves the claims registry changed only URL keys. The Chinese rank page's visible `English version → /en/rank/` wording is intentionally preserved under the no-copy-change rule; its href now points directly to `/rank/`, and the displayed legacy URL remains a valid 301 entry.

## Risks and rollback

- Language-memory loops: keep the storage values, explicit switches and same-origin bypass; test reload, external entry, query/hash, invalid preferences, denied storage and no-JS access.
- Redirect release mismatch: deploy the generated include and HTML together. Do not mix an old include with a new base.
- Permanent redirect caches: a server rollback does not instantly undo a browser/CDN's cached 301. Verify cache policy before release.
- Chinese-only pages: keep their explicit Chinese navigation labels and reachable `/zh/` paths, rather than invent copy or returning 404.
- Frozen data and prose: all changes remain in the language/routing layer, with independent preservation checks.

Before release, reverting this branch has no production effect. If Vesper later rolls back a release, restore both the prior static output and its matched Caddy configuration from the release backup, validate the configuration, then verify both languages and the old routes. No data rollback is needed or authorized.
