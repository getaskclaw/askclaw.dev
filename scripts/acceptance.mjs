import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

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

const configuredBaseUrl = process.env.ACCEPTANCE_BASE_URL?.replace(/\/+$/, '');
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

const routes = ['/', '/method/', '/rank/', '/en/'];
const browser = await chromium.launch({ headless: true });
const results = [];
let failed = false;

try {
  for (const route of routes) {
    const page = await browser.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const requestFailed = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('requestfailed', (request) => {
      requestFailed.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? 'unknown'}`);
    });

    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
    const mainText = await page.locator('main').innerText();
    const mainHtml = await page.locator('main').innerHTML();
    const transferBytes = await page.evaluate(() =>
      performance.getEntriesByType('resource').reduce((total, entry) => total + (entry.transferSize || 0), 0),
    );
    const lcpMs = await page.evaluate(() => {
      const entries = performance.getEntriesByType('largest-contentful-paint');
      return entries.length ? entries.at(-1).startTime : null;
    });
    const result = {
      route,
      status: response?.status() ?? null,
      contentChars: mainText.trim().length,
      domChars: mainHtml.length,
      contentText: mainText,
      consoleErrors,
      pageErrors,
      requestFailed,
      transferBytes,
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
    }

    results.push(result);
    await page.close();
  }
} finally {
  await browser.close();
  if (server) await new Promise((resolveServer) => server.close(resolveServer));
}

for (const result of results) console.log(JSON.stringify(result));
if (failed) process.exitCode = 1;
