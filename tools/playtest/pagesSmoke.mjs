/**
 * Smoke-test the production build served under the GitHub Pages subpath.
 * Usage: node tools/playtest/pagesSmoke.mjs [url]
 */
import { launchBrowser, sleep } from './browser.mjs';

const BASE =
  process.argv[2] ?? 'http://127.0.0.1:4173/escape-from-pallet-town-web/?testmode=1';
const REAL_SPEED_URL = BASE.split('?')[0];

const browser = await launchBrowser();
const consoleErrors = [];
const failedRequests = [];

try {
  const page = await browser.openPage(BASE);
  page.on('Runtime.consoleAPICalled', (event) => {
    if (event.type === 'error') {
      consoleErrors.push(event.args?.map((a) => a.value ?? a.description).join(' '));
    }
  });
  page.on('Network.loadingFailed', (event) => {
    failedRequests.push(`${event.type}:${event.errorText}:${event.requestId}`);
  });

  await page.waitFor(
    `window.__escapeFromPalletTownGame__ && window.__escapeFromPalletTownGame__.scene.isActive('title')`,
    { what: 'title scene', timeoutMs: 30_000 },
  );

  // Title -> starter picker (fresh save, Space).
  await page.tap('Space');
  await sleep(500);
  await page.waitFor(
    `document.querySelector('.pixel-ui') !== null`,
    { what: 'starter picker overlay', timeoutMs: 15_000 },
  );

  // Pick Charmander (first row, Enter).
  await page.tap('Enter');
  await sleep(500);
  await page.waitFor(
    `window.__escapeFromPalletTownGame__.scene.isActive('base') || window.__escapeFromPalletTownGame__.scene.isActive('hub')`,
    { what: 'base or hub after starter', timeoutMs: 20_000 },
  );

  if (consoleErrors.length) {
    throw new Error(`console errors: ${consoleErrors.join(' | ')}`);
  }
  if (failedRequests.length) {
    throw new Error(`network failures: ${failedRequests.length}`);
  }

  console.log('subpath smoke: title -> starter -> base OK');

  await page.close();

  // One real-speed load (no testmode): game must still boot.
  const live = await browser.openPage(REAL_SPEED_URL);
  await live.waitFor(
    `window.__escapeFromPalletTownGame__ && window.__escapeFromPalletTownGame__.scene.isActive('title')`,
    { what: 'title at real speed', timeoutMs: 30_000 },
  );
  await live.close();

  console.log('real-speed load OK');
} finally {
  await browser.close();
}
