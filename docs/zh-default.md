# Chinese-default route flip — reconnaissance and release handoff

> 本文件是 2026-10-08 owner 令「make Chinese the default language for askclaw.dev」的执行记录。原文方向为**逆** 2026-10-07 的 English-first 翻转（那份记录见 [docs/en-first.md](en-first.md)，已加 append-only 勘误，正文未改）。

## Authority and frozen scope

Work order: `askclaw-zh-default`, 2026-10-08（owner B3：「make Chinese the default language for askclaw.dev」）。This branch changes routes and language plumbing only. Scores, case data, page wording, public assets and the original claims assertions remain unchanged.

Baseline: the flip starts from the just-released English-first state, `main` @ `f2dbef6`（含 haiku 卡、对比度修复、cmp URL 功能）。The migration is based on that observed value, not an invented replacement SHA.

Budget decision: the default homepage is now the Chinese page. Its measured `transferSize` is 230,810 bytes (navigation + resources), below the standing 300,000-byte gate set by owner 2026-10-08 (30-lane structural growth, same batch as enabling compression). The gate number is **not** changed by this work order; no scores, counts, weeks or claims thresholds are touched to obtain a pass.

## Shape of the flip（方案选择）

根路径直接伺服中文内容，采用**静态目录搬移 + 服务端 301**，不是 JS 跳转、也不是 meta refresh：

- Chinese pages move physically to the root (`/`, `/rank/`, `/claim/`, `/method/`, `/notes/...`, `/<slug>/`, `/model/<slug>/`, `/provider/<slug>/`) via `git mv`.
- English pages move under `/en/`（`/en/`, `/en/rank/`, `/en/claim/`, `/en/notes/...`, `/en/<slug>/`, `/en/model/<slug>/`, `/en/provider/<slug>/`）。
- 这是 2026-10-07 English-first 结构的**精确逆**（那次文件搬移方向与之相反）。

为什么不是 JS/meta 跳转：静态 Astro HTML 的 refresh 页无法返回真正的 HTTP 301。老 `/zh/*` 外链必须由**服务端 301** 兑现（保住 SEO 权重与外链），所以由构建产出一份 Caddy include（`dist/_zh-first.caddy`）+ 精确映射清单（`dist/_zh-first-redirects.json`），发布时导入 site block（在 `file_server` 之前），与本构建的静态文件同批上线。

## Reconnaissance: change surfaces

- Paired pages: old Chinese `/zh/...` content moves to `/...`; old English root pages move to `/en/...`. Imports and links move with them, without rewriting copy.
- Chinese-only method and notes pages move to root (`/method/`, `/notes/...`); old `/zh/...` paths redirect to them. No English translations are invented (there is no English method page, same as before).
- `BaseLayout`, `SiteHeader`, `ChatDrawer` and entity URL helpers contain language-sensitive links. They move together; moving page files alone would leave broken or wrong-language navigation. `import` paths in moved `src/pages/*` were depth-corrected (`../` → `../../`) for pages moved one level deeper.
- The existing `askclaw-lang` values remain `en` and `zh-CN`. The script resolves the updated alternate links; no storage migration or browser-locale guessing is needed. The default/x-default is now Chinese.
- Canonical, `og:url`, JSON-LD and alternate links use the new URL space. The production sitemap contains only content pages; preview stays noindex and has no sitemap.
- Gate path expectations and the claims registry move with pages. Historical scores and all other registry values stay identical.

## Redirect artifacts and deployment dependency

Each build emits:

- `dist/_zh-first.caddy`: importable Caddy redirect directives.
- `dist/_zh-first-redirects.json`: enumerated source-to-target mappings with status 301 and the build base.
- Static fallback pages for existing `/zh/...` and the non-canonical `/model/...`, `/provider/...` alias paths.

The manifest includes every legacy `/zh/...` route, including model/provider aliases. `/zh/...` first redirects to its unprefixed equivalent; a pre-existing model/provider alias then redirects to its final entity page. Single-lane provider anchors are retained. GET and HEAD, with and without trailing slashes, `index.html` spellings, query strings, final content and fragment targets are tested. A bounded `/zh/` fallback strips the prefix for additional paths; it does not match `/zhuang/`.

## Deployment

The release imports `_zh-first.caddy` **inside the existing site block, before any URI rewriting or `file_server` handling**, and publishes the matching `dist/` in the same release. For a prefix build the redirects include that prefix and must execute before `handle_path` strips it. Copying HTML alone is not enough for HTTP 301. Run `caddy validate` against the actual combined site configuration before reload. The live Caddyfile import line changes from `import /var/www/askclaw-site/_en-first.caddy` to `import /var/www/askclaw-site/_zh-first.caddy`; the old `_en-first.caddy` must be removed from the site root so no stale include survives.

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

This compares all original content-page body text, accessibility labels, image alt text, titles and description/keyword metadata by old-to-new route; checks every tracked `src/data/` and `public/` file byte-for-byte; and proves the claims registry changed only URL keys. The rank page's visible `English version → /en/rank/` wording is intentionally preserved under the no-copy-change rule; its href now points directly to `/en/rank/`.

## Risks and rollback

- Language-memory loops: keep the storage values, explicit switches and same-origin bypass; test reload, external entry, query/hash, invalid preferences, denied storage and no-JS access.
- Redirect release mismatch: deploy the generated include and HTML together. Do not mix an old include with a new base.
- Permanent redirect caches: a server rollback does not instantly undo a browser/CDN's cached 301. CF sits in front, so purge the cache after deploy.
- Chinese-only pages: keep their explicit Chinese navigation labels and reachable root paths, rather than invent copy or returning 404.

Before release, reverting this branch has no production effect. If a later rollback is needed, restore both the prior static output and its matched Caddy configuration from the release backup, validate the configuration, then verify both languages and the old routes. No data rollback is needed or authorized.
