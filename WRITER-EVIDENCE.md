# WRITER-EVIDENCE — askclaw-astro-01-R2

Writer repair and verification evidence only. This is not a red-lane verdict or an approval. Vesper owns the fresh blind rechecks.

- Observed: 2026-09-19 UTC; build and deployment start times are recorded in `evidence/r2/`.
- Workspace: `/home/computebox/2609/askclaw.dev-astro`
- Branch: `feat/astro-batch1`
- Repair commit: `165f56953571853ea9c008f4e7f3aa5b5fe85133`
- Deployment target: `26430:/var/www/askclaw-site/astro-preview/`
- Public preview: https://askclaw.dev/astro-preview/
- Contract checked directly: `/home/computebox/.hermes/red-lane/BREAK-CONTRACT.md`, SHA-256 `57afef2c8ceeb967383cd406def446e377af2e107b80fc6fb223bb7d03d456f3` (matches the work order).
- Runtime identity reported to this session: `openai-codex / gpt-6-astra`. The work order requested `gpt-5.6-luna-900k`; this evidence does not claim that model override or max-effort execution occurred.

## 1. R2 fixes and direct ground truth

### Score periods: W37 composites, not W36 / 23-case records

Read directly before editing:

| Source | Observed fact |
|---|---|
| `../amber-ollama/results/2026-W36.md:24` | glm-5.3-flash = 15/21 |
| `../amber-ollama/results/2026-W37.md:27-32` | W36 15/21 + two new ops cases = W37 composite 17/23 |
| `../amber-ollama/results/2026-W37.md:44-60` | d41f's separate full-library debut = W37 17/23 |
| `../amber-crof/results/2026-W36.md:24` | qwen3.8-27b = 14/21 |
| `../amber-crof/results/2026-W37.md:28-34` | W36 14/21 + two new ops cases = W37 composite 16/23 |
| `../askclaw.dev/index.html:131-143` and `../askclaw.dev/en.html:122-134` | Published repo summaries retain Ollama 17/23 and CrofAI 16/23 |

Both method cards now say `W37 · 23 cases`. Their scores and model names are unchanged. A visible explanation distinguishes the composites from the older axis records, links to both W37 result files, and notes that d41f's 17/23 is a full W37 sitting.

`/rank/` still shows glm-5.3-flash 15/21 and qwen3.8-27b 14/21 with `W36 · 21`. Its canonical data file was not rewritten. The method and English pages explain this difference instead of inventing a single shared period.

### Kimi vendor label: explicit whole-label mapping

`src/pages/rank/index.astro` now maps only `lane.id === 'kimi'` to `Kimi official coding`. Every other vendor is passed through unchanged. The broad substring replacement was removed.

The browser test compares every shipped lane field against canonical `axes.json`, allowing only that explicit Kimi label difference. It also reads the rendered table label: `Kimi official coding`, without the duplicated word. Model, total, denominator, week, repository, source-file path and all axis values remain unchanged.

### English mirror: migrated content, not a placeholder

`src/pages/en/index.astro` now ports the public content of `../askclaw.dev/en.html`:

- The English AMBER hero and sealed-history explanation, including the private-cases/public-scores statement.
- `23 cases / 26 papers`, `11 result repos`, and the weekly-publication statement.
- The W38 board snapshot, swe-2-max's W37 18/23 result, five-way 17/23 tie, and the published swe-2-high re-run correction/link.
- Board, nine-axis matrix, trust process, all three findings, result repos and rules sections.
- All 11 scored result-repo cards, plus the separate `amber` specification card. The browser compares all 12 cards' names, scores, descriptions and URLs with the legacy source.
- Core Specification, public hash index, roadmap, correction, method and rank links.
- All six original English PNGs, copied byte-for-byte into `public/assets/`, with source-verified width/height, alt text and `loading="lazy"`.

Charts are static images with ordinary links to full-size versions and source details. Legacy hover/interactive promises were replaced with accurate static-chart instructions. No Vega scripts, chart specs, client framework, web fonts or image-generation replacements were copied.

The root `/` remains the second-batch visual placeholder. Its source and built HTML are unchanged.

### Other direct reads and source-path reconciliation

- Read `../askclaw-dev-rebuild-arrangement-20260918.md`, including §§1, 6 and 9, and both legacy home HTML files directly. No writer session logs were used.
- `../askclaw.dev/amber/index.html` is a redirect, not a method article. Its actual content is:

```html
<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="0; url=/"><link rel="canonical" href="https://askclaw.dev/"></head><body><a href="/">→ askclaw.dev</a></body></html>
```

- `../askclaw.dev/axes.html` is absent. Read the observed source at `../amber-axes/axes.html` and its `axes.json`; the original page explicitly identifies Ollama/Crof as W36 / 21-case records.
- The public hash index was retrieved directly from `https://raw.githubusercontent.com/getaskclaw/amber/main/hash-index/v2026-09.md` because no local `../amber/hash-index/v2026-09.md` exists. It states 23 cases / 26 papers, two ops additions after W36, and that W36 used the 21-case library.
- Both the source and copied axes data have SHA-256 `2ae8b63ef898bd60106d0cc374801cbb7fd061bac6d1465fc4d3fd2c6ec222be`.

## 2. Verification results

| Requirement | R2 result | Evidence |
|---|---|---|
| Required static build | PASS; 4 pages, exit 0, specified heap cap | `evidence/r2/build.log` contains the full output |
| Method periods and composite explanation | PASS; both cards W37 / 23 cases; original scores retained | `final-live.log` scorePeriods and compositeExplanation; `static-verification.json` parsed cards |
| Kimi label and lane preservation | PASS in shipped data and rendered table | `final-live.log`: laneDataPreserved, kimiVendor |
| Full English migration | PASS; 11 scored repos + spec card; source-matched copy/cards/images/links | `final-live.log`: englishCards, englishCopy, englishImages, englishLinks, englishLeadPreserved |
| Rank interaction | PASS; 8 chips, required preset 12 rows, independently recomputed ordering, clear and keyboard toggle | `final-live.log`: chipCount, presetRowCount, rankOrderPreserved, chipInteractionPassed |
| Four live routes | PASS; all 200, nonempty content, empty console/page/request-failure/HTTP-error arrays | `final-live.log`; compact `browser-summary.txt` |
| MPA behavior | PASS; direct loads and refreshes on all routes, native method navigation and back from home/rank/English | `final-live.log` |
| Zero content-page JS | PASS; 0 script elements on `/`, `/method/`, `/en/`; all work with JS disabled | `static-verification.json`, `live-checks.json` |
| Native rank-only JS | PASS; 1 inline module, 3,522 bytes; 0 external JS files or script requests | Static and browser evidence |
| No framework or network fonts | PASS; runtime deps remain Astro + sitemap only; no prohibited framework packages, font assets/references or font requests | `verify-dist.py`, `static-verification.json`, browser request records |
| No forbidden terms in built HTML | PASS across all four complete HTML files, decoded attributes and live post-interaction DOM | Static and browser forbiddenTerms checks |
| Generated sitemap | PASS; build log records `@astrojs/sitemap`; 4 distinct routes; zh-CN/en alternates on both home URLs; 4 hreflang entries | `static-verification.json`, `live-checks.json` |
| No handcrafted sitemap | PASS; no tracked sitemap XML; robots points to the generated sitemap index | `verify-dist.py` |
| Local links/assets | PASS; every local href/src resolves within the preview build; all 6 PNGs decode with matching intrinsic dimensions | Static and browser evidence |
| Source/live byte identity | PASS; 15/15 dist files match both SSH target and public HTTPS responses | `containment.json`, `live-checks.json` |
| Containment | PASS; all 37 remote sibling files, top-level paths, and 33 legacy checkout files unchanged | Before/after manifests and `containment.json` |
| Git/no push | PASS; branch is feat/astro-batch1, candidate has no remote, legacy refs and GitHub main unchanged | Git snapshots and `containment.json` |
| Desktop/mobile rendering | PASS for observed layout checks; no horizontal overflow at 390px; no card/score collisions seen | `live-screens/`; no taste approval claimed |

### Live browser measurements

Fresh headless Chromium contexts at 1440 × 900. Initial transfer includes the navigation document, not just subresources. LCP uses a buffered PerformanceObserver installed by the test, not by the shipped site.

| Route | HTTP | Main text chars | Document bytes | Resource bytes | Total initial bytes | LCP ms | Shipped scripts |
|---|---:|---:|---:|---:|---:|---:|---:|
| `/` | 200 | 628 | 1,564 | 2,197 | 3,761 | 112 | 0 |
| `/method/` | 200 | 1,292 | 2,622 | 2,197 | 4,819 | 100 | 0 |
| `/rank/` | 200 | 359 before selection | 4,460 | 2,197 | 6,657 | 100 | 1 |
| `/en/` | 200 | 3,593 | 4,225 | 2,671,364 | 2,675,589 | 264 | 0 |

All four routes recorded zero console messages, console errors, page errors, failed requests, HTTP errors, network-font requests and external script requests. Mobile viewport overflow checks were false for all four routes.

The initial English transfer includes several original PNGs within Chromium's native lazy-load distance. The six PNGs total 2,827,002 bytes; this migration does not claim the English page is below 200 KB. The work-order homepage budget was measured on `/`.

### Regression sequence

Each required repair had a failing real-browser check before its implementation:

- `red-method.log`: both cards incorrectly W36 and composite explanation absent; `green-method.log`: passed.
- `red-rank.log`: shipped/rendered `Kimi 官方 coding coding`; `green-rank.log`: passed with canonical data preserved.
- `red-en.log`: 0 result cards, no migrated sections/images; `green-en.log`: all required content present.
- `pre-final-local.log`: stricter full-lead parity caught lost whitespace around an inline bold element. Explicit spaces fixed it; final local/live runs pass.

Intermediate logs use the older resource-only metric and are not the final performance evidence. Use `final-local.log` and `final-live.log` for the final test script and artifact.

## 3. Reproduction and full artifacts

Commands actually exercised:

```text
NODE_OPTIONS=--max-old-space-size=2560 npm run build
node --check scripts/acceptance.mjs
node --check scripts/live-checks.mjs
python3 scripts/verify-dist.py
npm run acceptance
ACCEPTANCE_SCREENSHOT_DIR=evidence/r2/live-screens npm run acceptance -- --live
node scripts/live-checks.mjs
python3 scripts/verify-containment.py
git diff --check
```

`--live` derives the URL from the existing Astro site/base configuration. Local mode serves only the built dist using a bounded Node server and shuts it down afterward; no dev watcher was run. Node v22.22.2, npm 10.9.7. No package or lockfile changes were made.

The shell rejected an earlier inline `.dev` URL invocation. That invocation did not run. The subsequent source-configured `--live` verifier and the explicit live-check script ran successfully; no approval or security settings were changed.

Evidence files:

- `evidence/r2/build-start.txt`, `build.log`: exact final application build timestamp and full output.
- `.gitattributes` exempts only captured `evidence/r2/*.log` files from whitespace checks so the raw Astro output keeps its original trailing spaces; source files remain checked.
- `evidence/r2/dist-manifest.json`: complete final dist listing with sizes and SHA-256.
- `evidence/r2/static-verification.json`: parsed built cards, JS count/size, source/asset identity and sitemap assertions.
- `evidence/r2/final-local.log`, `final-live.log`: complete per-route browser JSON, including content, requests and assertions.
- `evidence/r2/browser-summary.txt`: compact local/live results.
- `evidence/r2/live-checks.json`: all 15 public file hashes, JS-disabled content checks, and browser sitemap/robots visits.
- `evidence/r2/deploy-start.txt`, `deploy.log`: actual deployment time and itemized changes.
- `evidence/r2/remote-{before,after}.json`, `legacy-{before,after}.json`, Git snapshots and `containment.json`: containment checks.
- `evidence/r2/live-screens/`: final desktop and mobile screenshots for all four routes. Intermediate local screenshots are ignored scratch, not final evidence.
- `evidence/r2/design-detector.json`: mechanical detector returned `[]`; final screenshot review also used original-resolution crops.

Complete final dist file listing (all SHA-256 values are in the manifest):

```text
_astro/BaseLayout.Bc8_lLlO.css                 5459
assets/completion-matrix-7way.en.png          722723
assets/effort-curves-20260911.en.png           408709
assets/score-vs-tokens-2026-w37.en.png         492800
assets/top5-2026-w38.en.png                   973588
assets/trust-chain.en.png                     69847
assets/wallclock-strip-2026-w37.en.png         159335
en/index.html                                14149
favicon.svg                                    284
index.html                                    2886
method/index.html                             6124
rank/index.html                              17093
robots.txt                                      85
sitemap-0.xml                                  925
sitemap-index.xml                              196
```

## 4. Deployment and protected state

A read-only SSH snapshot and local rollback archive preceded deployment. The only remote write command was:

```text
rsync -az --delete --delay-updates --itemize-changes dist/ 26430:/var/www/askclaw-site/astro-preview/
```

A dry run was inspected first. The actual deployment added the six English images and changed three HTML files; no preview files were removed. Other preview files had timestamps refreshed but unchanged bytes. All root-level and recursive sibling file hashes and the top-level path set stayed identical.

Old checkout status before and after, exactly:

```text
## main...origin/main [ahead 1]
 M index.html
 M sitemap.xml
```

GitHub main stayed at `90b9798b3ccbe1092bfa58ef3d48fb4fffa47f2d`; the legacy local refs are unchanged. The Astro repository has no configured remotes. No push occurred.

Rollback archive, verified readable: `/home/computebox/2609/askclaw.dev-astro/.astro/preview-r2-before.tar.gz`. It contains only the prior `astro-preview/` subtree. Rollback, if separately requested, can restore that subtree using the same destination fence; no rollback was performed.

## 5. Remaining limitations and boundary statement

- `/` is intentionally still the batch-2 visual placeholder. `/en/` is now the real content migration, not a placeholder.
- Original English PNGs are preserved, not recompressed. Native lazy loading does not promise that every below-fold image waits until it is visible. Static images have no Vega hover interactions; full-size/source links are available.
- No Lighthouse run was performed. The LCP and transfer values above are single-host, unthrottled Chromium observations, not a Lighthouse score or a universal weak-network guarantee.
- Only the home pair has translated sitemap alternates; method and rank remain single-language routes.
- This run cannot claim the requested luna/max model override; actual runtime identity is stated above.
- No red-lane approval, owner taste approval, merge approval or main publication is claimed.

BREAK-CONTRACT §8 triage: this repairs public wording and an already-required static content migration inside the existing preview fence; it adds no authorization, data-access or deployment privileges, changes no approved resource boundary, and does not modify the contract or review gates. Fresh reviewers must still check that assessment independently.
