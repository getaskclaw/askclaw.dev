import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { chromium } from 'playwright';
import astroConfig from '../astro.config.mjs';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const distRoot = resolve(projectRoot, 'dist');
const previewPrefix = '/astro-preview';
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
};

function distPath(urlPath) {
  const withoutPrefix = urlPath.startsWith(previewPrefix)
    ? urlPath.slice(previewPrefix.length) || '/'
    : urlPath;
  const cleanPath = withoutPrefix.endsWith('/')
    ? `${withoutPrefix}index.html`
    : withoutPrefix;
  const candidate = resolve(distRoot, `.${cleanPath}`);
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
  baseUrl = `http://127.0.0.1:${port}${previewPrefix}`;
}

const routes = process.env.ACCEPTANCE_ROUTES?.split(',') ?? ['/', '/method/', '/rank/', '/en/'];
const browser = await chromium.launch({ headless: true });
const results = [];
let failed = false;

try {
  for (const route of routes) {
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

    if (route === '/rank/') {
      result.chipCount = await page.locator('.chip').count();
      await page.locator('[data-preset="build,ops,ui-build"]').click();
      result.presetRowCount = await page.locator('#rank-body tr').count();
      if (result.chipCount !== 8 || result.presetRowCount !== 12) failed = true;
      const sourceLanes = JSON.parse(await readFile(resolve(projectRoot, 'src/data/axes.json'), 'utf8'));
      const shippedLanes = JSON.parse(await page.locator('#rank-app').getAttribute('data-lanes'));
      const expectedLanes = sourceLanes.map((lane) => ({
        ...lane,
        vendor: lane.id === 'kimi' ? 'Kimi official coding' : lane.vendor,
      }));
      result.laneDataPreserved = isDeepStrictEqual(shippedLanes, expectedLanes);
      result.kimiVendor = await page.locator('#rank-body tr').filter({ has: page.locator('a[href="https://github.com/getaskclaw/amber-kimi"]') }).locator('small').innerText();
      result.presetContent = await page.locator('#rank-body').innerText();
      if (!result.laneDataPreserved || result.kimiVendor !== 'Kimi official coding') failed = true;
      const axes = ['build', 'ops', 'ui-build'];
      const expectedOrder = sourceLanes.map((lane) => ({
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
      const legacyHtml = await readFile(resolve(process.env.LEGACY_SITE_ROOT ?? resolve(projectRoot, '../askclaw.dev'), 'en.html'), 'utf8');
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
        `${previewPrefix}/method/`, `${previewPrefix}/rank/`,
      ]) result.englishLinks.push({ href, passed: await page.locator(`a[href="${href}"]`).count() > 0 });
      result.englishMirrorPassed = result.resultRepoCount === 11
        && result.englishLeadPreserved
        && result.englishCards.every((check) => check.passed)
        && result.englishCopy.every((check) => check.passed)
        && result.englishImages.every((check) => check.passed)
        && result.englishLinks.every((check) => check.passed)
        && !mainText.includes('placeholder');
      if (!result.englishMirrorPassed) failed = true;
    }

    result.scriptTags = await page.locator('script:not([type="application/ld+json"])').count();
    result.structuredDataTags = await page.locator('script[type="application/ld+json"]').count();
    result.fontRequests = requests.filter((request) => request.type === 'font');
    result.scriptRequests = requests.filter((request) => request.type === 'script');
    result.forbiddenTerms = (await page.content()).match(/点线面|图结构|节点|出边|点→跳转/g) ?? [];
    result.canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    result.expectedCanonical = `https://askclaw.dev${previewPrefix}${route}`;
    if (result.scriptTags !== (route === '/rank/' ? 1 : 0) || result.fontRequests.length
      || result.scriptRequests.length || result.forbiddenTerms.length || result.canonical !== result.expectedCanonical) failed = true;
    if (route === '/' && initialTransfer.totalBytes >= 200_000) failed = true;

    // Direct load, refresh, ordinary navigation and back must remain real MPA paths.
    const refreshed = await page.reload({ waitUntil: 'networkidle' });
    result.refreshStatus = refreshed?.status();
    result.refreshContentPreserved = (await page.locator('main').innerText()) === mainText;
    if (route !== '/method/') {
      await page.locator('.header-nav a[href^="/astro-preview/method/"]').first().click();
      await page.waitForURL((url) => url.pathname === `${previewPrefix}/method/`, { waitUntil: 'load' });
      await page.goBack({ waitUntil: 'networkidle' });
      result.backUrl = page.url();
    }
    if (result.refreshStatus !== 200 || !result.refreshContentPreserved
      || (result.backUrl && result.backUrl !== `${baseUrl}${route}`)) failed = true;

    if (process.env.ACCEPTANCE_SCREENSHOT_DIR) {
      const directory = resolve(process.env.ACCEPTANCE_SCREENSHOT_DIR);
      await mkdir(directory, { recursive: true });
      const label = route === '/' ? 'home' : route.replaceAll('/', '');
      if (route === '/rank/') await page.locator('[data-preset="build,ops,ui-build"]').click();
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
