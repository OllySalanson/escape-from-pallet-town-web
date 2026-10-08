// Two tabs on one save: the Pokemon Center left open in one while the other
// plays on. A stale screen must never write its old picture of the game over
// what the other tab did since - that erased banked contracts and undid wipes.
//
//   node tools/playtest/staleTab.mjs http://localhost:5173/ [--shot=path.png]
//
// Tab B opens a fresh game and walks into the Pokemon Center. Tab A, in the
// same browser and so on the same save, walks into Oak's Lab and deploys a
// raid, which records it. Tab B then presses NEW BOX. The raid tab A recorded
// must still be in the save afterwards, and tab B must say what happened.
import { LOGIC_WINDOW, PIXEL_WINDOW, launchBrowser, sleep } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs, walkIntoBase } from './deploy.mjs';

const base = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
if (!base) {
  throw new Error('usage: staleTab.mjs <dev server url>');
}
const shot = process.argv.find((arg) => arg.startsWith('--shot='))?.slice('--shot='.length);
const url = new URL(base);
url.searchParams.set('testmode', shot ? 'pixels' : '1');

const clicker = (page) => async (text) => {
  await page.waitFor(
    `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}) && !b.disabled); if (!b) return false; b.click(); return true; })()`,
    { what: `button "${text}"` },
  );
  await sleep(350);
};
const deployed = (page) =>
  page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}')).raidProgress.raidRecord?.['floodplain-relay']?.deployed ?? 0`);

const browser = await launchBrowser({ window: shot ? PIXEL_WINDOW : LOGIC_WINDOW });
try {
  const tabB = await browser.openPage(url.href);
  await tabB.waitFor(sceneIs('title'));
  await tabB.tap('Space', 60);
  await tabB.waitFor(sceneIs('starter'));
  await tabB.waitFor(`(() => { const b = document.querySelector('button[data-starter="charmander"]'); if (!b) return false; b.click(); return true; })()`);
  await clicker(tabB)('Confirm Charmander');
  await tabB.waitFor(sceneIs('base'));
  await walkIntoBase(tabB, 'pokemon-centre');
  console.log(`tab B is in the Pokemon Center; raids deployed in the save: ${await deployed(tabB)}`);

  const tabA = await browser.openPage(url.href);
  await tabA.waitFor(sceneIs('title'));
  await tabA.tap('Space', 60);
  await tabA.waitFor(sceneIs('base'));
  await walkIntoBase(tabA, 'oaks-lab');
  const clickA = clicker(tabA);
  await clickA('Start a raid');
  await clickA('Charmander');
  for (const label of ['Choose drop-in', 'Review & deploy', 'Enter the raid']) await clickA(label);
  await tabA.waitFor(sceneIs('world'));
  const afterA = await deployed(tabA);
  console.log(`tab A deployed a raid; raids deployed in the save: ${afterA}`);
  await tabA.close();

  await tabB.waitFor(`(() => { const b = document.querySelector('[data-box-new]'); if (!b) return false; b.click(); return true; })()`, { what: 'NEW BOX' });
  await sleep(400);
  if (shot) {
    await tabB.screenshot(shot);
  }
  const afterB = await deployed(tabB);
  const status = await tabB.evaluate(`${GAME}.scene.getScene('hub').status`);
  console.log(`tab B pressed NEW BOX; raids deployed in the save: ${afterB}`);
  console.log(`tab B says: ${status}`);
  if (afterB !== afterA) {
    console.log('FAIL: the stale tab wrote over the raid the other tab recorded.');
    process.exitCode = 1;
  } else {
    console.log('PASS: the raid the other tab recorded is still in the save.');
  }
} finally {
  await browser.close();
}
