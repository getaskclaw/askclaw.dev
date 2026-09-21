import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { chromium } from 'playwright';
import astroConfig from '../astro.config.mjs';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const distRoot = resolve(projectRoot, 'dist');

function normalizeBasePath(value) {
  let base = value || '/';
  if (!base.startsWith('/')) base = `/${base}`;
  if (!base.endsWith('/')) base += '/';
  return base === '//' ? '/' : base;
}

async function detectDistBasePath() {
  try {
    const indexHtml = await readFile(resolve(distRoot, 'index.html'), 'utf8');
    const canonicalPath = indexHtml.match(/<link rel="canonical" href="https:\/\/askclaw\.dev([^\"]*)"/)?.[1];
    if (canonicalPath) return normalizeBasePath(canonicalPath);
  } catch {
    // A missing or incomplete dist falls back to the Astro config; the gate will report the real
    // missing-artifact failure below instead of masking it here.
  }
  return normalizeBasePath(astroConfig.base ?? '/');
}

// The base is explicit from SITE_BASE when the gate receives it; otherwise infer the already-built
// artifact's canonical URL so `SITE_BASE=... npm run build && <gate>` checks the same build.
const previewPrefix = normalizeBasePath(process.env.SITE_BASE ?? await detectDistBasePath());
const basePrefix = previewPrefix === '/' ? '' : previewPrefix.replace(/\/$/, '');
// The legacy site lives in its own checkout (~/2609/askclaw.dev); this repo no longer keeps a
// mirror of it, so point LEGACY_SITE_ROOT at that checkout when it is not a sibling directory.
const legacySiteRoot = resolve(process.env.LEGACY_SITE_ROOT ?? resolve(projectRoot, '..', 'askclaw.dev'));
const legacyEnglish = resolve(legacySiteRoot, 'en.html');
if (!existsSync(legacyEnglish)) {
  throw new Error(
    `Legacy English page not found: ${legacyEnglish}\n`
    + 'The /en/ mirror check compares against the legacy checkout, which is not part of this repo.\n'
    + 'Set LEGACY_SITE_ROOT to the legacy site root and rerun, e.g.\n'
    + '  LEGACY_SITE_ROOT=~/2609/askclaw.dev npm run acceptance',
  );
}
// The resolved base is explicit from SITE_BASE or inferred from the built canonical URL; the
// production root and any prefixed preview build are checked without editing this script.
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function distPath(urlPath) {
  const withoutPrefix = urlPath.startsWith(previewPrefix)
    ? urlPath.slice(previewPrefix.length) || '/'
    : urlPath;
  const cleanPath = withoutPrefix.endsWith('/')
    ? `${withoutPrefix}index.html`
    : withoutPrefix;
  const candidate = resolve(distRoot, cleanPath.replace(/^\/+/, ''));
  if (candidate !== distRoot && !candidate.startsWith(`${distRoot}/`)) return null;
  return candidate;
}

const configuredBaseUrl = (process.env.ACCEPTANCE_BASE_URL
  ?? (process.argv.includes('--live') ? new URL(astroConfig.base, astroConfig.site).href : undefined))?.replace(/\/+$/, '');
let server = null;

const handleRequest = async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  const pathname = decodeURIComponent(url.pathname);
  const path = distPath(pathname);
  if (!path) {
    response.writeHead(400);
    response.end('Bad path');
    return;
  }
  try {
    const body = await readFile(path);
    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(path)] ?? 'application/octet-stream',
      'Content-Length': body.byteLength,
      'Cache-Control': 'no-store',
    });
    if (request.method !== 'HEAD') response.end(body);
    else response.end();
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
};

let baseUrl = configuredBaseUrl;
if (!baseUrl) {
  server = createServer(handleRequest);
  await new Promise((resolveServer) => server.listen(0, '127.0.0.1', resolveServer));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}${basePrefix}`;
}

const routes = process.env.ACCEPTANCE_ROUTES?.split(',') ?? ['/', '/method/', '/rank/', '/en/', '/en/rank/'];
const browser = await chromium.launch({ headless: true });
const results = [];
let failed = false;

try {
  for (const route of routes) {
    const isRankRoute = route === '/rank/' || route === '/en/rank/';
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const consoleErrors = [];
    const consoleMessages = [];
    const pageErrors = [];
    const requestFailed = [];
    const requests = [];
    const httpErrors = [];
    page.on('console', (message) => {
      consoleMessages.push({ type: message.type(), text: message.text() });
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('request', (request) => requests.push({ url: request.url(), type: request.resourceType() }));
    page.on('response', (response) => {
      if (response.status() >= 400) httpErrors.push({ url: response.url(), status: response.status() });
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('requestfailed', (request) => {
      requestFailed.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? 'unknown'}`);
    });

    // Observer is test instrumentation only, not a script shipped by the site.
    await page.addInitScript(() => {
      window.__acceptanceLcp = null;
      new PerformanceObserver((list) => {
        window.__acceptanceLcp = list.getEntries().at(-1)?.startTime ?? null;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    });
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
    const mainText = await page.locator('main').innerText();
    const mainHtml = await page.locator('main').innerHTML();
    const initialTransfer = await page.evaluate(() => {
      const documentBytes = performance.getEntriesByType('navigation').reduce((sum, entry) => sum + entry.transferSize, 0);
      const resourceBytes = performance.getEntriesByType('resource').reduce((sum, entry) => sum + entry.transferSize, 0);
      return { documentBytes, resourceBytes, totalBytes: documentBytes + resourceBytes };
    });
    const lcpMs = await page.evaluate(() => window.__acceptanceLcp);
    const result = {
      route,
      status: response?.status() ?? null,
      contentChars: mainText.trim().length,
      domChars: mainHtml.length,
      contentText: mainText,
      consoleErrors,
      consoleMessages,
      pageErrors,
      requestFailed,
      httpErrors,
      requests,
      initialTransfer,
      lcpMs,
    };

    if (!response || response.status() !== 200 || result.contentChars === 0 || consoleErrors.length || pageErrors.length || requestFailed.length) {
      failed = true;
    }

    if (isRankRoute) {
      const english = route === '/en/rank/';
      const englishLabels = {
        kimi: { vendor: 'Kimi official coding' },
        'gpt-luna': { name: 'gpt-5.6-luna-900k (max band)' },
        ds: { vendor: 'DeepSeek official' },
        doubao: { vendor: 'Volcengine Ark Agent Plan' },
        'gpt-sol': { name: 'gpt-5.6-sol-900k (high band)' },
        gp: { vendor: 'Community self-hosted 3×V100' },
      };
      result.chipCount = await page.locator('.chip').count();
      await page.locator('[data-preset="build,ops,ui-build"]').click();
      result.presetRowCount = await page.locator('#rank-body tr').count();
      if (result.chipCount !== 8 || result.presetRowCount !== 12) failed = true;
      const sourceLanes = JSON.parse(await readFile(resolve(projectRoot, 'src/data/axes.json'), 'utf8'));
      const shippedLanes = JSON.parse(await page.locator('#rank-app').getAttribute('data-lanes'));
      const expectedLanes = sourceLanes.map((lane) => ({
        ...lane,
        ...(english ? englishLabels[lane.id] : { vendor: lane.id === 'kimi' ? 'Kimi 官方 coding' : lane.vendor }),
      }));
      result.laneDataPreserved = isDeepStrictEqual(shippedLanes, expectedLanes);
      result.kimiVendor = await page.locator('#rank-body tr').filter({ has: page.locator('a[href="https://github.com/getaskclaw/amber-kimi"]') }).locator('small').innerText();
      result.presetContent = await page.locator('#rank-body').innerText();
      if (!result.laneDataPreserved || result.kimiVendor !== (english ? 'Kimi official coding' : 'Kimi 官方 coding')) failed = true;
      const axes = ['build', 'ops', 'ui-build'];
      const expectedOrder = expectedLanes.map((lane) => ({
        name: lane.name,
        minimum: Math.min(...axes.map((axis) => lane.axis[axis].p)),
        sum: axes.reduce((total, axis) => total + lane.axis[axis].p, 0),
      })).sort((a, b) => b.minimum - a.minimum || b.sum - a.sum).map((lane) => lane.name);
      result.rankOrderPreserved = isDeepStrictEqual(await page.locator('#rank-body .lane a').allTextContents(), expectedOrder);
      await page.locator('#clear-rank').click();
      const cleared = await page.locator('.chip[aria-pressed="true"]').count() === 0;
      await page.locator('[data-face="build"]').focus();
      await page.keyboard.press('Space');
      const toggled = await page.locator('[data-face="build"]').getAttribute('aria-pressed') === 'true';
      await page.locator('[data-preset="build,ops,ui-build"]').click();
      result.chipInteractionPassed = cleared && toggled && await page.locator('.chip[aria-pressed="true"]').count() === 3;
      if (!result.rankOrderPreserved || !result.chipInteractionPassed) failed = true;

      if (english) {
        await page.getByRole('button', { name: 'Everyday engineering', exact: true }).click();
        result.everydayRows = await page.locator('#rank-body tr').count();
        result.englishVerdict = await page.locator('#rank-verdict').innerText();
        result.englishHeadings = await page.locator('#rank-head th').allTextContents();
        if (result.everydayRows !== 12
          || !result.englishVerdict.startsWith('Selected: Engineering + Operations. Lowest pass count: 5.')
          || !isDeepStrictEqual(result.englishHeadings, ['#', 'Lane (model × endpoint)', 'Total score', 'Engineering', 'Operations', 'Weakest axis', 'Combined', 'Week / cases'])) failed = true;
        result.englishPresets = [];
        for (const button of await page.locator('[data-preset]').all()) {
          const preset = await button.getAttribute('data-preset');
          const active = preset.split(',');
          const expected = expectedLanes.filter((lane) => active.every((axis) => lane.axis[axis].n > 0))
            .map((lane) => ({
              name: lane.name,
              minimum: Math.min(...active.map((axis) => lane.axis[axis].p)),
              sum: active.reduce((total, axis) => total + lane.axis[axis].p, 0),
            })).sort((a, b) => b.minimum - a.minimum || b.sum - a.sum).map((lane) => lane.name);
          await button.click();
          const passed = isDeepStrictEqual(await page.locator('#rank-body .lane a').allTextContents(), expected)
            && !/[\u3400-\u9fff]/u.test(await page.locator('main').innerText());
          result.englishPresets.push({ preset, passed });
          if (!passed) failed = true;
        }
        await page.locator('#clear-rank').click();
        await page.locator('[data-face="text"]').click();
        result.englishSaturation = await page.locator('#rank-saturation').innerText();
        if (!(await page.locator('#rank-saturation').isVisible())
          || result.englishSaturation !== 'Note: all lanes currently have full marks for Text; these types do not change the ranking.') failed = true;
        await page.locator('#clear-rank').click();
        if (await page.locator('#rank-verdict').innerText() !== 'Nothing selected yet. Choose a work type to start.'
          || await page.locator('#rank-body').innerText() !== 'Choose a work type to display the lanes.') failed = true;
      } else {
        result.englishRankLink = await page.getByRole('link', { name: 'English version → /en/rank/', exact: true }).getAttribute('href');
        if (result.englishRankLink !== `${basePrefix}/en/rank/`) failed = true;
      }
    }

    if (route === '/method/') {
      result.scorePeriods = [];
      for (const [repo, score] of [['amber-ollama', '17/23'], ['amber-crof', '16/23']]) {
        const text = await page.locator(`.repo-card[href="https://github.com/getaskclaw/${repo}"]`).innerText();
        const passed = text.includes(score) && text.includes('W37') && text.includes('23 cases') && !text.includes('W36');
        result.scorePeriods.push({ repo, text, passed });
        if (!passed) failed = true;
      }
      result.compositeExplanation = mainText.includes('W37') && mainText.includes('15/21') && mainText.includes('14/21');
      if (!result.compositeExplanation) failed = true;
    }

    if (route === '/en/') {
      const legacyHtml = await readFile(resolve(legacySiteRoot, 'en.html'), 'utf8');
      const legacy = await page.evaluate((html) => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return {
          cards: [...doc.querySelectorAll('.repo')].map((card) => ({
            repo: card.querySelector('b').textContent,
            score: card.querySelector('.score').textContent,
            description: card.querySelector('p').textContent,
            href: card.getAttribute('href'),
          })),
          headings: [...doc.querySelectorAll('h2')].map((heading) => heading.textContent),
          lead: doc.querySelector('.lead').textContent.replace(/\s+/g, ' ').trim(),
          rules: [...doc.querySelectorAll('.rule')].map((rule) => rule.textContent),
          images: [...doc.querySelectorAll('figure img')].map((image) => ({
            file: image.getAttribute('src').split('/').at(-1),
            width: image.getAttribute('width'),
            height: image.getAttribute('height'),
            alt: image.getAttribute('alt'),
          })),
        };
      }, legacyHtml);
      result.englishCards = [];
      result.englishLeadPreserved = (await page.locator('.lead').innerText()).replace(/\s+/g, ' ').trim() === legacy.lead;
      for (const card of legacy.cards) {
        const locator = page.locator(`.repo-card[href="${card.href}"]`);
        const text = await locator.count() === 1 ? await locator.innerText() : '';
        const passed = [card.repo, card.score, card.description].every((value) => text.includes(value));
        result.englishCards.push({ ...card, passed });
      }
      result.resultRepoCount = await page.locator('.repo-card[href^="https://github.com/getaskclaw/amber-"]').count();
      result.englishCopy = [...legacy.headings, ...legacy.rules,
        'real history,', 'sealed in amber, replayed', '23 cases / 26 papers', '11 result repos',
        'Snapshot 2026-W38', 'leader swe-2-max @ Devin at 18/23 (scored in W37)',
        'five-way tie at 17/23', 'Think longer ≠ score better', 'output-token bills span 17×',
        'hard ones slow the token stream down', 'Correction 2026-09-18',
      ].map((text) => ({ text, passed: mainText.includes(text) }));
      result.englishImages = [];
      for (const image of legacy.images) {
        // The legacy English charts were migrated from PNG to WebP and capped at 1400px wide,
        // so match the migrated file and assert the declared size matches the decoded size
        // (no layout shift) instead of the retired PNG name and pixel dimensions.
        const migratedFile = image.file.replace(/\.png$/, '.webp');
        const locator = page.locator(`main img[src$="/${migratedFile}"]`);
        let passed = false;
        if (await locator.count() === 1) {
          await locator.scrollIntoViewIfNeeded();
          await locator.evaluate((img) => img.decode());
          passed = await locator.evaluate((img, expected) => {
            // Same chart as the legacy PNG, resized to at most 1400px wide with both
            // dimensions scaled together; allow 1px rounding on the height.
            const expectedWidth = Math.min(Number(expected.width), 1400);
            const expectedHeight = Number(expected.height) * expectedWidth / Number(expected.width);
            return img.naturalWidth === expectedWidth
              && Math.abs(img.naturalHeight - expectedHeight) <= 1
              && img.getAttribute('width') === String(img.naturalWidth)
              && img.getAttribute('height') === String(img.naturalHeight)
              && img.loading === 'lazy' && img.alt === expected.alt;
          }, image);
        }
        result.englishImages.push({ ...image, migratedFile, passed });
      }
      result.englishLinks = [];
      for (const href of [
        'https://github.com/getaskclaw/amber/blob/main/AMBER-Core-Specification.md',
        'https://github.com/getaskclaw/amber/blob/main/hash-index/v2026-09.md',
        'https://github.com/getaskclaw/amber/blob/main/PLAN.md',
        'https://github.com/getaskclaw/amber/blob/main/docs/corrections-2026-09-18.en.md',
        `${basePrefix}/method/`, `${basePrefix}/en/rank/`,
      ]) result.englishLinks.push({ href, passed: await page.locator(`a[href="${href}"]`).count() > 0 });
      result.englishMirrorPassed = result.resultRepoCount === 11
        && result.englishLeadPreserved
        && result.englishCards.every((check) => check.passed)
        && result.englishCopy.every((check) => check.passed)
        && result.englishImages.every((check) => check.passed)
        && result.englishLinks.every((check) => check.passed)
        && !mainText.includes('placeholder');
      if (!result.englishMirrorPassed) failed = true;
      result.englishRankEntries = {
        card: await page.locator('.question-entry-cobalt').getAttribute('href'),
        textLink: await page.getByRole('link', { name: 'Rank by work', exact: true }).getAttribute('href'),
        navigation: await page.getByRole('link', { name: 'Axis matrix', exact: true }).getAttribute('href'),
      };
      if (Object.values(result.englishRankEntries).some((href) => href !== `${basePrefix}/en/rank/`)) failed = true;
    }

    if (route === '/en/' || route === '/en/rank/') {
      result.accidentalChinese = await page.evaluate(() => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const matches = [];
        while (walker.nextNode()) {
          const node = walker.currentNode;
          const parent = node.parentElement;
          if (!parent || parent.closest('script, style, .language-toggle') || !parent.checkVisibility()) continue;
          const text = parent.closest('.header-nav') ? node.textContent.replaceAll('(中文)', '') : node.textContent;
          if (/[\u3400-\u9fff]/u.test(text)) matches.push(text.trim());
        }
        return matches;
      });
      if (result.accidentalChinese.length) failed = true;
      if (route === '/en/rank/') {
        const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
        result.englishRankSeo = await page.locator('html').getAttribute('lang') === 'en'
          && schema['@type'] === 'WebPage' && schema.inLanguage === 'en'
          && schema.url === new URL(`${basePrefix}/en/rank/`, astroConfig.site).href
          && await page.locator('meta[property="og:url"]').getAttribute('content') === schema.url
          && await page.locator('meta[property="og:title"]').getAttribute('content') === schema.name
          && await page.locator('meta[property="og:description"]').getAttribute('content') === schema.description
          && !/[\u3400-\u9fff]/u.test(JSON.stringify(schema));
        if (!result.englishRankSeo) failed = true;
      }
    }

    if (route === '/' || route === '/en/') {
      await page.setViewportSize({ width: 375, height: 844 });
      result.mobileLanes = await page.locator('.lane-name').evaluateAll((elements) => elements.map((element) => ({
        text: element.textContent, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth,
        whiteSpace: getComputedStyle(element).whiteSpace, textOverflow: getComputedStyle(element).textOverflow,
      })));
      result.fourCardsIntact = await page.locator('.question-entry').count() === 4;
      result.homeMobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      const bannerStyle = () => page.locator('.crab-bubble').evaluate((element) => {
        const style = getComputedStyle(element);
        return { cursor: style.cursor, background: style.backgroundColor, shadow: style.boxShadow, transform: style.transform, color: style.color };
      });
      await page.mouse.move(0, 0);
      result.bannerStyle = await bannerStyle();
      await page.locator('.crab-bubble').hover();
      result.bannerNonInteractive = isDeepStrictEqual(await bannerStyle(), result.bannerStyle)
        && result.bannerStyle.cursor === 'default' && result.bannerStyle.background === 'rgba(0, 0, 0, 0)'
        && result.bannerStyle.shadow === 'none';
      if (result.mobileLanes.length !== 5 || result.mobileLanes.some((lane) => lane.scrollWidth > lane.clientWidth
        || lane.whiteSpace !== 'normal' || lane.textOverflow === 'ellipsis')
        || !result.fourCardsIntact || result.homeMobileOverflow || !result.bannerNonInteractive) failed = true;
      await page.setViewportSize({ width: 1440, height: 900 });
    }

    result.scriptTags = await page.locator('script:not([type="application/ld+json"])').count();
    result.structuredDataTags = await page.locator('script[type="application/ld+json"]').count();
    result.fontRequests = requests.filter((request) => request.type === 'font');
    result.scriptRequests = requests.filter((request) => request.type === 'script');
    result.forbiddenTerms = (await page.content()).match(/点线面|图结构|节点|出边|点→跳转/g) ?? [];
    result.canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    result.expectedCanonical = new URL(`${basePrefix}${route}`, astroConfig.site).href;
    if (result.scriptTags !== (isRankRoute ? 1 : 0) || result.fontRequests.length
      || result.scriptRequests.length || result.forbiddenTerms.length || result.canonical !== result.expectedCanonical) failed = true;
    if (route === '/' && initialTransfer.totalBytes >= 200_000) failed = true;

    // Direct load, refresh, ordinary navigation and back must remain real MPA paths.
    const refreshed = await page.reload({ waitUntil: 'networkidle' });
    result.refreshStatus = refreshed?.status();
    result.refreshContentPreserved = (await page.locator('main').innerText()) === mainText;
    if (route !== '/method/') {
      await page.locator(`.header-nav a[href^="${basePrefix}/method/"]`).first().click();
      await page.waitForURL((url) => url.pathname === `${basePrefix}/method/`, { waitUntil: 'load' });
      await page.goBack({ waitUntil: 'networkidle' });
      result.backUrl = page.url();
    }
    if (result.refreshStatus !== 200 || !result.refreshContentPreserved
      || (result.backUrl && result.backUrl !== `${baseUrl}${route}`)) failed = true;

    if (process.env.ACCEPTANCE_SCREENSHOT_DIR) {
      const directory = resolve(process.env.ACCEPTANCE_SCREENSHOT_DIR);
      await mkdir(directory, { recursive: true });
      const label = route === '/' ? 'home' : route.replaceAll('/', '');
      if (isRankRoute) await page.locator('[data-preset="build,ops,ui-build"]').click();
      for (const image of await page.locator('main img').all()) {
        await image.scrollIntoViewIfNeeded();
        await image.evaluate((img) => img.decode());
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: resolve(directory, `${label}-desktop.png`), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      result.mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      await page.screenshot({ path: resolve(directory, `${label}-mobile.png`), fullPage: true });
      if (result.mobileOverflow) failed = true;
    }
    if (consoleErrors.length || pageErrors.length || requestFailed.length || httpErrors.length) failed = true;

    results.push(result);
    await page.close();
  }
} finally {
  await browser.close();
  if (server) await new Promise((resolveServer) => server.close(resolveServer));
}

for (const result of results) console.log(JSON.stringify(result));
if (failed) process.exitCode = 1;
