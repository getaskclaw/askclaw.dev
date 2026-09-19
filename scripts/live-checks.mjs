import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = new URL(process.env.ACCEPTANCE_BASE_URL ?? 'https://askclaw.dev/astro-preview/');
const manifest = JSON.parse(await readFile(new URL('../evidence/r2/dist-manifest.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ headless: true });
const checks = { publicFiles: [], noJavaScript: [] };
try {
  const context = await browser.newContext({ javaScriptEnabled: false });
  for (const [file, expected] of Object.entries(manifest.files)) {
    const response = await context.request.get(new URL(file, base).href);
    const body = await response.body();
    const sha256 = createHash('sha256').update(body).digest('hex');
    checks.publicFiles.push({ file, status: response.status(), bytes: body.length, sha256 });
    assert.equal(response.status(), 200, file);
    assert.equal(sha256, expected.sha256, `${file}: public bytes differ from dist`);
  }
  for (const route of ['', 'method/', 'en/']) {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const response = await page.goto(new URL(route, base).href, { waitUntil: 'networkidle' });
    const text = await page.locator('main').innerText();
    const scripts = await page.locator('script').count();
    const cards = await page.locator('.repo-card').count();
    checks.noJavaScript.push({ route: '/' + route, status: response.status(), contentChars: text.length, scripts, cards, errors });
    assert.equal(response.status(), 200);
    assert.equal(scripts, 0);
    assert.equal(errors.length, 0);
    assert.ok(text.length > 0);
    if (route === 'en/') {
      assert.equal(cards, 12);
      assert.ok(text.includes('23 cases / 26 papers'));
      assert.ok(text.includes('Snapshot 2026-W38'));
    }
    await page.close();
  }
  const page = await context.newPage();
  for (const file of ['sitemap-index.xml', 'sitemap-0.xml', 'robots.txt']) {
    const response = await page.goto(new URL(file, base).href);
    assert.equal(response.status(), 200, file);
    assert.ok((await response.text()).length > 0);
  }
  checks.sitemapsAndRobotsInBrowser = true;
  await page.close();
  await context.close();
} finally {
  await browser.close();
  console.log(JSON.stringify(checks, null, 2));
}
