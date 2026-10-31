// What abandoning a raid costs, end to end: deploy, then leave the raid the
// three ways a page can go (`run/raidInFlight.ts`).
//
//   node tools/playtest/abandonRaid.mjs http://localhost:5173/ [--shot=dir]
//
// 1. Reload mid-raid: the base opens on a box saying the pack was lost, and the
//    save has lost the pack and what was packed, and kept the team.
// 2. Close the tab mid-raid and open the game in a new one: the same.
// 3. A second tab opened while the first is still in its raid: nothing is
//    settled, and the raid is still recorded as under way.
// And a reload at base, outside a raid, changes nothing in the save.
import { LOGIC_WINDOW, PIXEL_WINDOW, launchBrowser, sleep } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs, takePokemon, walkIntoBase, jumpIn } from './deploy.mjs';

const base = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
if (!base) {
  throw new Error('usage: abandonRaid.mjs <dev server url> [--shot=dir]');
}
const shots = process.argv.find((arg) => arg.startsWith('--shot='))?.slice('--shot='.length);
const url = new URL(base);
url.searchParams.set('testmode', shots ? 'pixels' : '1');

const clicker = (page) => async (text) => {
  await page.waitFor(
    `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())}) && !b.disabled); if (!b) return false; b.click(); return true; })()`,
    { what: `button "${text}"` },
  );
  await sleep(350);
};
const save = (page) => page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}'))`);
const said = (page) =>
  page.evaluate(`(() => { const box = ${GAME}.scene.getScene('base').dialogBox;
    return box.visible ? box.list.filter((c) => c.type === 'Text').map((c) => c.text).join(' | ') : ''; })()`);

/** Reads the box through to its end, as a player would. */
async function readThrough(page) {
  for (let guard = 0; guard < 40 && (await said(page)) !== ''; guard += 1) {
    await page.tap('Space', 60);
    await sleep(250);
  }
}

let failures = 0;
const check = (ok, what) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${what}`);
  failures += ok ? 0 : 1;
};

/** Who is at heel (`base/partner.ts`): an abandoned raid keeps the team, so the starter still follows. */
const follower = (page) =>
  page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); const p = b.partner; const t = b.currentTile;
    return { partnerId: b.savedGame.stash.partnerId(), out: Boolean(p && p.place.out && p.sprite.visible), id: b.savedGame.stash.partner()?.id ?? null,
      atHeel: Boolean(p) && Math.abs(p.place.tile.x - t.x) + Math.abs(p.place.tile.y - t.y) === 1 }; })()`);

async function newGame(page) {
  await page.waitFor(sceneIs('title'));
  await page.evaluate(`localStorage.removeItem('${SAVE_KEY}')`);
  await page.send('Page.reload', {}); await sleep(1500);
  await page.waitFor(sceneIs('title'));
  await page.tap('Space', 60);
  await page.waitFor(sceneIs('base'));
  await page.waitFor(`window.__escapeFromPalletTownGame__.scene.getScene('base')?.takeStarterForDriver?.("charmander") === true`);
  await page.waitFor(sceneIs('base'));
}

async function deployFrom(page) {
  await walkIntoBase(page, 'raid-arena');
  const click = clicker(page);
  await page.waitFor(takePokemon('Charmander'), { what: 'Charmander in the raid party' });
  await jumpIn(page, { until: (expression, what) => page.waitFor(expression, { what }) });
  await page.waitFor(sceneIs('world'));
}

async function continueToBase(page) {
  await page.waitFor(sceneIs('title'));
  await page.tap('Space', 60);
  await page.waitFor(sceneIs('base'));
  await sleep(600);
}

const browser = await launchBrowser({ window: shots ? PIXEL_WINDOW : LOGIC_WINDOW });
try {
  // 1. Reload mid-raid.
  const tab = await browser.openPage(url.href);
  await newGame(tab);
  const before = await save(tab);
  await deployFrom(tab);
  const inFlight = (await save(tab)).raidInFlight;
  check(Boolean(inFlight), `a deployed raid is recorded as under way (${JSON.stringify(inFlight)})`);
  await tab.send('Page.reload', {}); await sleep(1500);
  await continueToBase(tab);
  let after = await save(tab);
  const words = await said(tab);
  console.log(`  the base says: ${words}`);
  if (shots) {
    // Every line of the box, typed out, so the wording can be judged as shown.
    for (let line = 1; line <= 6 && (await said(tab)) !== ''; line += 1) {
      await sleep(4000);
      await tab.screenshot(`${shots}/abandon-reload-${line}.png`);
      await tab.tap('Space', 60);
      await sleep(250);
    }
  }
  check(words.includes('The game closed'), 'the base says the raid was abandoned');
  check(!after.raidInFlight, 'the raid is settled');
  check((after.stash.items['raid-pack'] ?? 0) === 0, 'the Raid pack is lost');
  check(
    after.stash.pokemon.length === before.stash.pokemon.length,
    `the team came home (${after.stash.pokemon.map((p) => p.id).join(', ')})`,
  );
  const heel = await follower(tab);
  check(heel.out && heel.atHeel && heel.id === before.stash.partnerId, `the starter still follows at heel (${JSON.stringify(heel)})`);

  // A reload at base, outside a raid, costs nothing.
  const atBase = JSON.stringify(await save(tab));
  await tab.send('Page.reload', {}); await sleep(1500);
  await continueToBase(tab);
  check(JSON.stringify(await save(tab)) === atBase && (await said(tab)) === '', 'a reload outside a raid changes nothing');

  // 2. Close the tab mid-raid, open the game in a new one.
  await deployFrom(tab);
  await tab.close();
  const reopened = await browser.openPage(url.href);
  await continueToBase(reopened);
  after = await save(reopened);
  check((await said(reopened)).includes('The game closed'), 'a new tab says the closed tab\'s raid was abandoned');
  check(!after.raidInFlight, 'and has settled it');
  const reopenedHeel = await follower(reopened);
  check(reopenedHeel.out && reopenedHeel.atHeel && reopenedHeel.id === before.stash.partnerId, `and the starter still follows at heel (${JSON.stringify(reopenedHeel)})`);
  await readThrough(reopened);

  // 3. A second tab while the first is still in its raid.
  await deployFrom(reopened);
  const second = await browser.openPage(url.href);
  await continueToBase(second);
  after = await save(second);
  check((await said(second)) === '', 'a second tab says nothing about a raid still being played');
  check(Boolean(after.raidInFlight), 'and leaves it under way');
  if (shots) await second.screenshot(`${shots}/abandon-second-tab.png`);
} finally {
  await browser.close();
}
process.exitCode = failures === 0 ? 0 : 1;
