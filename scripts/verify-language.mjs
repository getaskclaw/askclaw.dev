import assert from 'node:assert/strict';

// Owner 2026-10-08: Chinese is the default language of askclaw.dev. The bare path serves
// Chinese; the English twin lives under /en/. A visitor who has never chosen gets Chinese,
// even with an English browser locale — nothing is guessed from the browser.
export async function verifyLanguage(browser, baseUrl) {
  const checks = [];
  const base = new URL(baseUrl);
  const prefix = base.pathname.replace(/\/$/, '');
  const address = (path) => baseUrl + path;
  const fresh = await browser.newContext({ locale: 'en-US' });
  try {
    const page = await fresh.newPage();
    await page.goto(address('/'), { waitUntil: 'networkidle' });
    assert.equal(await page.locator('html').getAttribute('lang'), 'zh-CN');
    assert.equal(await page.evaluate(() => localStorage.getItem('askclaw-lang')), null);
    for (const path of ['/', '/rank/', '/claim/', '/deepseek/']) {
      await page.goto(address(path), { waitUntil: 'networkidle' });
      const alternate = page.locator('.language-toggle');
      assert.equal(await alternate.getAttribute('href'), prefix + '/en' + path);
      await alternate.click();
      await page.waitForURL(address('/en' + path));
      assert.equal(await page.locator('html').getAttribute('lang'), 'en');
      assert.equal(await page.evaluate(() => localStorage.getItem('askclaw-lang')), 'en');
      await page.locator('.language-toggle').click();
      await page.waitForURL(address(path));
      assert.equal(await page.evaluate(() => localStorage.getItem('askclaw-lang')), 'zh-CN');
      checks.push({ name: 'switch round trip', path, passed: true });
    }
  } finally { await fresh.close(); }

  for (const preference of ['zh-CN', 'en', 'invalid']) {
    const context = await browser.newContext();
    try {
      await context.addInitScript((value) => localStorage.setItem('askclaw-lang', value), preference);
      const page = await context.newPage();
      const source = preference === 'zh-CN' ? '/en/rank/' : '/rank/';
      const target = preference === 'en' ? '/en/rank/' : '/rank/';
      const state = '?axes=build%2Cops&q=GPT#rank-app';
      await page.goto(address(source + state), { waitUntil: 'networkidle' });
      await page.waitForURL(address(target + state));
      assert.equal(await page.locator('html').getAttribute('lang'), preference === 'en' ? 'en' : 'zh-CN');
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal(page.url(), address(target + state));
      checks.push({ name: 'remembered external entry/query/hash/reload', preference, passed: true });
      if (preference !== 'invalid') {
        // Deliberate same-origin navigation must not be forced back by a stored preference.
        await page.goto(address(source), { referer: address(target), waitUntil: 'networkidle' });
        assert.equal(page.url(), address(source));
        checks.push({ name: 'same-origin bypass', preference, passed: true });
      }
    } finally { await context.close(); }
  }
  for (const mode of ['no-js', 'storage-denied']) {
    const context = await browser.newContext({ javaScriptEnabled: mode !== 'no-js' });
    try {
      if (mode === 'storage-denied') await context.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage denied'); } });
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      for (const [path, lang] of [['/', 'zh-CN'], ['/en/', 'en']]) {
        const response = await page.goto(address(path), { waitUntil: 'networkidle' });
        assert.equal(response.status(), 200);
        assert.equal(await page.locator('html').getAttribute('lang'), lang);
        assert.ok(await page.locator('#grid .card').count() > 0);
      }
      assert.deepEqual(errors, []);
      checks.push({ name: mode, passed: true });
    } finally { await context.close(); }
  }
  // An old Chinese deep link gets a real 301 from the serving layer, keeping query and fragment.
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const response = await page.goto(address('/zh/rank/?keep=1#rank-app'), { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200);
    const redirected = response.request().redirectedFrom();
    assert.ok(redirected);
    assert.equal((await redirected.response()).status(), 301);
    assert.equal(page.url(), address('/rank/?keep=1#rank-app'));
    checks.push({ name: 'legacy Chinese 301/query/hash', passed: true });
  } finally { await context.close(); }
  return { languageChecks: checks, passed: true };
}
