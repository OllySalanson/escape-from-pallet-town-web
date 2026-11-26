// Photographs a raid lost to the clock on the result screen
// (`scenes/ExtractionScene.ts`) beat by beat - the clock ringing out, what the
// raid kept, what the locker held - and the report after it, printing the
// line-up's top edge at each beat, which must not move. The report is the
// game's own, made by `clockLossReport.ts`; one without `fallen` is the screen
// as it was before a clock-out had a line-up (`docs/screens/clock-loss/`).
//
//   npx vite-node tools/playtest/clockLossReport.ts <after.json> <before.json>
//   node tools/playtest/clockLossShots.mjs <test-mode build url> <report.json> <dir> [WxH]
import { mkdirSync, readFileSync } from 'node:fs';
import { launchBrowser, sleep } from './browser.mjs';
import { GAME, sceneIs } from './deploy.mjs';

const [base, reportFile, out, size = '1280x800'] = process.argv.slice(2);
const [width, height] = size.split('x').map(Number);
mkdirSync(out, { recursive: true });
const url = new URL(base);
url.searchParams.set('testmode', 'pixels');
const real = JSON.parse(readFileSync(reportFile, 'utf8'));
const browser = await launchBrowser({ window: { width, height } });
try {
  const page = await browser.openPage(url.href);
  await page.waitFor(sceneIs('title'), { timeoutMs: 60000 });
  await page.evaluate(`void ${GAME}.scene.getScenes(true)[0].scene.start('extraction', { report: ${JSON.stringify(real)} })`);
  if (!real.fallen?.length) {
    await page.waitFor(`Boolean(document.querySelector('#screens .menu-overlay [data-continue]'))`, { timeoutMs: 60000 });
    await sleep(2500);
    await page.screenshot(`${out}/before.png`);
  } else {
    await page.waitFor(`Boolean(document.querySelector('[data-defeat]'))`, { timeoutMs: 60000 });
    await sleep(60);
    await page.screenshot(`${out}/0-standing.png`);
    console.log('standing', await page.evaluate(`document.querySelector('.defeat-cast').getBoundingClientRect().top`));
    await sleep(1500);
    await page.screenshot(`${out}/1-clock.png`);
    console.log('clock', await page.evaluate(`document.querySelector('.defeat-cast').getBoundingClientRect().top`));
    for (const [index, name] of [[2, 'taken'], [3, 'held']]) {
      await page.tap('Space');
      await sleep(1600);
      await page.screenshot(`${out}/${index}-${name}.png`);
      console.log(name, await page.evaluate(`document.querySelector('.defeat-cast').getBoundingClientRect().top`));
    }
    await page.tap('Space');
    await page.waitFor(`Boolean(document.querySelector('#screens .menu-overlay [data-continue]'))`, { timeoutMs: 60000 });
    await sleep(2500);
    await page.screenshot(`${out}/4-report.png`);
  }
} finally {
  await browser.close();
}
