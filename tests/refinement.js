const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { chromium } = require('@playwright/test');

(async () => {
  const app = express();
  const root = path.resolve(__dirname, '..', 'next-site/out');
  app.use(express.static(root));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const browser = await chromium.launch();
  const base = `http://127.0.0.1:${server.address().port}`;
  const screenshots = process.env.AUDIT_SCREENSHOTS;
  if (screenshots) fs.mkdirSync(screenshots, { recursive: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
    await context.route(/^https:/, route => route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.waitForFunction(() => document.querySelectorAll('.snapshot-card__date time').length === 3);
    const homepageBtc = await page.locator('.snapshot-card__reading strong').nth(0).innerText();
    const homepageSpy = await page.locator('.snapshot-card__reading strong').nth(1).innerText();
    const cards = await page.locator('.tool-card').evaluateAll(cards => cards.map(c => ({ x: c.getBoundingClientRect().x, width: c.getBoundingClientRect().width })));
    assert.equal(cards[0].width, cards[2].width);
    assert.equal(cards[1].x, cards[3].x);
    if (screenshots) await page.screenshot({ path: path.join(screenshots, 'home-light.png'), fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: 'Toggle color theme' }).click();
    if (screenshots) await page.screenshot({ path: path.join(screenshots, 'home-dark.png'), fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: 'Toggle color theme' }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    const menu = page.getByRole('button', { name: 'Tools', exact: false });
    await menu.click();
    assert.equal(await menu.getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'BTC Risk');
    await page.keyboard.press('Escape');
    assert.equal(await menu.getAttribute('aria-expanded'), 'false');
    assert.equal(await menu.evaluate(el => el === document.activeElement), true);
    if (screenshots) await page.screenshot({ path: path.join(screenshots, 'home-mobile.png'), fullPage: true, animations: 'disabled' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + '/risk-metric/');
    await page.waitForFunction(() => /^0\.\d{3}$|^1\.000$/.test(document.querySelector('#vRisk').textContent));
    assert.equal(await page.locator('#vRisk').innerText(), homepageBtc, 'Homepage BTC uses the dashboard model: ' + await page.locator('#vPriceTime').innerText());
    assert.equal(await page.evaluate(() => document.querySelector('#price-chart').compareDocumentPosition(document.querySelector('#fair-value')) & Node.DOCUMENT_POSITION_FOLLOWING), 4);
    await page.locator('#priceCanvas').focus();
    const latest = await page.locator('#priceCanvas-reading').innerText();
    await page.keyboard.press('ArrowLeft');
    assert.notEqual(await page.locator('#priceCanvas-reading').innerText(), latest);
    const downloadEvent = page.waitForEvent('download');
    await page.locator('#price-chart').getByRole('link', { name: 'Download chart data' }).click();
    const download = await downloadEvent;
    const downloadPath = await download.path();
    assert.match(fs.readFileSync(downloadPath, 'utf8'), /^date,price,risk,vix\n/);
    if (screenshots) await page.screenshot({ path: path.join(screenshots, 'btc-desktop.png'), fullPage: true, animations: 'disabled' });
    await page.route('**/api/quote?symbol=SPY', () => {});
    await page.goto(base + '/spy-risk-metric/');
    await page.waitForFunction(() => document.querySelector('#vPrice').textContent.startsWith('$'), null, { timeout: 3000 });
    assert.equal(await page.locator('#vRisk').innerText(), homepageSpy, 'Homepage SPY uses the saved-data dashboard model');
    await page.unroute('**/api/quote?symbol=SPY');
    if (screenshots) await page.screenshot({ path: path.join(screenshots, 'spy-desktop.png'), fullPage: true, animations: 'disabled' });
    // Dataset failure is recoverable and does not erase stored holdings.
    await page.evaluate(() => localStorage.setItem('dividend_portfolios', JSON.stringify([{ name: 'Audit', holdings: [{ ticker: 'XBCI', shares: 10, costBasis: 20 }] }])));
    await page.route('**/data/dividend_data.json*', route => route.fulfill({ status: 503, body: 'Unavailable' }));
    await page.goto(base + '/dividend-tracker/');
    await page.getByRole('button', { name: 'Retry loading data' }).waitFor();
    assert.equal(await page.locator('#app-content').isVisible(), false);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('dividend_portfolios'))[0].holdings[0].shares), 10);
    await page.unroute('**/data/dividend_data.json*');
    await page.getByRole('button', { name: 'Retry loading data' }).click();
    await page.locator('#holdings-table').waitFor();
    assert.ok((await page.locator('#holdings-table').innerText()).includes('XBCI'));
    for (const route of ['ema-scanner', 'dividend-tracker', 'risk-metric', 'spy-risk-metric']) {
      await page.goto(base + '/' + route + '/');
      await page.waitForTimeout(700);
      if (route === 'ema-scanner') await page.locator('#scanner-table tbody tr').first().waitFor({ state: 'attached' });
      if (route === 'ema-scanner' || route === 'dividend-tracker') {
        const background = await page.locator('[data-dashboard]').evaluate(el => getComputedStyle(el).backgroundImage);
        assert.ok(!background.includes('rgb(5, 5, 4)'), 'Light theme must not retain dark gradient');
      }
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, route + ' mobile overflow');
      if (screenshots) await page.screenshot({ path: path.join(screenshots, route + '-mobile.png'), fullPage: true, animations: 'disabled' });
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    assert.deepEqual(errors, []);
    console.log('Refinement checks passed: snapshot/model parity, layout, mobile navigation, chart access/download, nonblocking quotes, dividend retry, themes, and mobile widths.');
    await context.close();
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
