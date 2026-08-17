const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4173';
const browserPath = process.env.BROWSER_PATH;

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: browserPath });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      const url = new URL(response.url());
      const appOrigin = new URL(baseUrl).origin;
      if (url.origin === appOrigin && !response.ok() && !url.pathname.endsWith('/favicon.ico')) {
        errors.push(`${response.status()} ${url.pathname}`);
      }
    });

    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForSelector('.pet-card');
    const cachedAssets = await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      const cache = await caches.open('lavender-workbench-v2');
      return (await cache.keys()).map(request => new URL(request.url).pathname);
    });
    ['/pet.css', '/pet-core.js', '/pet-ui.js'].forEach(path => {
      assert.ok(cachedAssets.some(asset => asset.endsWith(path)));
    });
    const guideButton = page.locator('[data-finish-guide]');
    if (await guideButton.isVisible()) await guideButton.click();
    assert.equal(await page.locator('.pet-name-row strong').textContent(), '缅英猫');
    assert.equal(await page.locator('.pet-stat-grid span').nth(0).locator('b').textContent(), '80');

    const openTask = page.locator('[data-toggle-task][aria-label="完成任务"]').first();
    await openTask.click();
    await page.waitForTimeout(80);
    assert.equal(await page.locator('.pet-stat-grid span').nth(0).locator('b').textContent(), '85');
    assert.match(await page.locator('.pet-coins').textContent(), /3/);

    for (let index = 0; index < 4; index += 1) {
      await page.locator('[data-pet-click]').click();
      await page.waitForTimeout(320);
    }
    assert.match(await page.locator('#toastRoot').textContent(), /今天已经摸过三次/);

    await page.locator('[data-pet-open]').click();
    await page.locator('[data-pet-species="border-collie"]').click();
    assert.equal(await page.locator('.pet-species .active').textContent(), '边牧');
    await page.locator('[data-close]').click();
    assert.equal(await page.locator('.pet-name-row strong').textContent(), '边牧');

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.pet-card');
    assert.equal(await page.locator('.pet-name-row strong').textContent(), '边牧');

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(overflow <= 0, `mobile overflow is ${overflow}px`);
    assert.deepEqual(errors, []);

    await page.screenshot({ path: 'tests/pet-mobile.png', fullPage: true });

    const desktop = await browser.newPage({ viewport: { width: 800, height: 1200 } });
    desktop.setDefaultTimeout(10000);
    await desktop.goto(baseUrl, { waitUntil: 'networkidle' });
    await desktop.waitForSelector('.pet-card');
    const desktopGuide = desktop.locator('[data-finish-guide]');
    if (await desktopGuide.isVisible()) await desktopGuide.click();

    const draggableTask = desktop.locator('[data-pet-task-id]:not(.done)').first();
    await desktop.evaluate(() => {
      window.__petDragEvents = [];
      ['dragstart', 'dragover', 'drop', 'dragend'].forEach(type => {
        document.addEventListener(type, event => {
          window.__petDragEvents.push({ type, target: event.target.className });
        }, true);
      });
    });
    const dragState = await draggableTask.evaluate(element => ({
      draggable: element.draggable,
      attribute: element.getAttribute('draggable'),
      connected: element.isConnected
    }));
    assert.equal(dragState.draggable, true, JSON.stringify(dragState));
    const sourceBox = await draggableTask.boundingBox();
    const targetBox = await desktop.locator('[data-pet-drop]').boundingBox();
    await desktop.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await desktop.mouse.down();
    await desktop.mouse.move(sourceBox.x + sourceBox.width / 2 + 12, sourceBox.y + sourceBox.height / 2, { steps: 4 });
    await desktop.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 18 });
    await desktop.mouse.up();
    await desktop.waitForTimeout(120);
    const hungerAfterDrop = await desktop.locator('.pet-stat-grid span').nth(0).locator('b').textContent();
    const dragEvents = await desktop.evaluate(() => window.__petDragEvents);
    assert.equal(hungerAfterDrop, '85', JSON.stringify({ dragState, sourceBox, targetBox, dragEvents }));

    await desktop.locator('[data-pet-open]').click();
    await desktop.locator('[data-pet-tab="store"]').click();
    assert.equal(await desktop.locator('.pet-item').count(), 11);
    await desktop.locator('[data-pet-tab="achievements"]').click();
    assert.equal(await desktop.locator('.pet-achievement').count(), 6);
    await desktop.locator('[data-pet-tab="store"]').click();
    await desktop.waitForTimeout(300);
    await desktop.screenshot({ path: 'tests/pet-desktop.png' });
    const desktopOverflow = await desktop.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(desktopOverflow <= 0, `desktop overflow is ${desktopOverflow}px`);
    console.log('pet browser regression passed');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
