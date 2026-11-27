// Two tabs on one save: THE CHEST's POKéMON tab left open in one while the
// other plays on. A stale screen must never write its old picture of the game
// over what the other tab did since - that erased banked contracts and undid
// wipes - nor touch a Pokémon the other tab's raid has out.
//
//   node tools/playtest/staleTab.mjs http://localhost:5173/ [--shot=path.png]
//
// Tab B opens a fresh game and opens THE CHEST's POKéMON tab (B, then P). Tab
// A, in the same browser and so on the same save, jumps into a raid with the
// partner, which records it. Tab B then presses ENTER on the partner. The raid
// tab A recorded must still be in the save afterwards, and tab B must say the
// partner is out on a raid.
import { LOGIC_WINDOW, PIXEL_WINDOW, launchBrowser, sleep } from './browser.mjs';
import { SAVE_KEY, sceneIs, takePokemon, walkIntoBase, jumpIn } from './deploy.mjs';

const base = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
if (!base) {
  throw new Error('usage: staleTab.mjs <dev server url>');
}
const shot = process.argv.find((arg) => arg.startsWith('--shot='))?.slice('--shot='.length);
const url = new URL(base);
url.searchParams.set('testmode', shot ? 'pixels' : '1');

const deployed = (page) =>
  page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}')).raidProgress.raidRecord?.['floodplain-relay']?.deployed ?? 0`);

const browser = await launchBrowser({ window: shot ? PIXEL_WINDOW : LOGIC_WINDOW });
try {
  const tabB = await browser.openPage(url.href);
  await tabB.waitFor(sceneIs('title'));
  await tabB.tap('Space', 60);
  await tabB.waitFor(sceneIs('base'));
  await tabB.waitFor(`window.__escapeFromPalletTownGame__.scene.getScene('base')?.takeStarterForDriver?.("charmander") === true`);
  await tabB.waitFor(sceneIs('base'));
  await tabB.tap('KeyB', 60);
  await tabB.waitFor(sceneIs('things'));
  await tabB.tap('KeyP', 60);
  await tabB.waitFor(`${sceneIs('chest-pokemon')} && Boolean(document.querySelector('.chest-mon-grid'))`);
  console.log(`tab B is on THE CHEST's POKéMON tab; raids deployed in the save: ${await deployed(tabB)}`);

  const tabA = await browser.openPage(url.href);
  await tabA.waitFor(sceneIs('title'));
  await tabA.tap('Space', 60);
  await tabA.waitFor(sceneIs('base'));
  await walkIntoBase(tabA, 'raid-arena');
  // The lone Pokemon is packed by default; clicking its row would take it out.
  await tabA.waitFor(takePokemon('Charmander'), { what: 'Charmander in the raid party' });
  await jumpIn(tabA, { until: (expression, what) => tabA.waitFor(expression, { what }) });
  await tabA.waitFor(sceneIs('world'));
  const afterA = await deployed(tabA);
  console.log(`tab A deployed a raid; raids deployed in the save: ${afterA}`);
  await tabA.close();

  await tabB.evaluate(`document.querySelector('.chest-mons [data-mon]')?.focus()`);
  await sleep(200);
  await tabB.tap('Enter', 60);
  await sleep(400);
  if (shot) {
    await tabB.screenshot(shot);
  }
  const afterB = await deployed(tabB);
  const status = await tabB.evaluate(`document.querySelector('#screens .px-status-line')?.textContent ?? ''`);
  console.log(`tab B pressed ENTER on the partner; raids deployed in the save: ${afterB}`);
  console.log(`tab B says: ${status}`);
  if (!/raid/i.test(status)) {
    console.log('FAIL: tab B did not say the partner is out on a raid.');
    process.exitCode = 1;
  } else if (afterB !== afterA) {
    console.log('FAIL: the stale tab wrote over the raid the other tab recorded.');
    process.exitCode = 1;
  } else {
    console.log('PASS: the raid the other tab recorded is still in the save.');
  }
} finally {
  await browser.close();
}
