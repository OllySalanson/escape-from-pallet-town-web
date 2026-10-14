// The base half of an errand (`src/game/hub/errands.ts`), played the way a
// player meets it: walk into a keeper's building, and they ask; bring the thing
// home, walk in again, and they take it and pay; lose it, and they ask after it.
//
//   node tools/playtest/errands.mjs <url> <out dir> [--save=path.json] [--window=1200x768]
//
// `--save` starts from a save a raid wrote - `raid.mjs --insertion=town-square
// --errands=brocks-crate --grab=brocks-crate --save-out=path.json` is the other
// half, which carries Brock's crate home - so the hand-over is checked against
// a crate a raid actually banked. Without one, the crate is written into the
// vault. Photographs each beat and fails loudly when one is not what it promises.
import { mkdirSync, readFileSync } from 'node:fs';
import { launchBrowser, sleep } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs, takePokemon, walkIntoBase } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [width, height] = (option('window') ?? '1200x768').split('x').map(Number);
const saved = option('save');
mkdirSync(out, { recursive: true });

const page_url = `${url}?testmode=pixels`;
const browser = await launchBrowser({ window: { width, height } });
const page = await browser.openPage(page_url);
try {
  const press = async (code) => {
    await page.tap(code);
    await sleep(200);
  };
  const click = async (selector, what = selector) => {
    await page.waitFor(
      `(() => { const b = document.querySelector(${JSON.stringify(selector)}); if (!b || b.disabled) return false; b.click(); return true; })()`,
      { what },
    );
    await sleep(400);
  };
  const said = () =>
    page.evaluate(`[...document.querySelectorAll('.px-speech-line')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim())`);
  const progress = () => page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}')).raidProgress`);
  const vault = () => page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}')).stash`);
  /** Writes the save and reopens the game on it, standing in the yard. */
  const load = async (edit) => {
    await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}')); (${edit})(save);
      localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
    await page.send('Page.navigate', { url: page_url });
    await page.waitFor(sceneIs('title'));
    await press('Space');
    await page.waitFor(sceneIs('base'));
    await sleep(600);
  };
  const leave = async () => {
    await click('[data-back]', 'back out of the screen');
    await page.waitFor(sceneIs('base'));
    await sleep(500);
  };
  const expectSaid = (lines, start, what) => {
    if (!lines[0]?.startsWith(start)) throw new Error(`${what}: said ${JSON.stringify(lines)}`);
    console.log(`${what}: ${lines.join(' / ')}`);
  };

  // A game, then the save it is checked against.
  await page.waitFor(sceneIs('title'));
  await page.evaluate(`localStorage.removeItem('${SAVE_KEY}')`);
  await page.send('Page.navigate', { url: page_url });
  await page.waitFor(sceneIs('title'));
  await press('Space');
  await page.waitFor(sceneIs('starter'));
  await page.waitFor(
    `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('Confirm ')); if (!b) return false; b.click(); return true; })()`,
  );
  await page.waitFor(sceneIs('base'));
  await page.waitFor(`localStorage.getItem('${SAVE_KEY}') !== null`);
  const raidSave = saved ? JSON.parse(readFileSync(saved, 'utf8')) : null;
  await load(`(save) => {
    const raid = ${JSON.stringify(raidSave)};
    if (raid) Object.assign(save, raid);
    const p = save.raidProgress;
    // The first contract banked, which is what opens every errand's map.
    p.firstContractExtracted = true;
    p.completedContracts = [...new Set([...(p.completedContracts ?? []), 'recover-lost-field-kit'])];
    p.unlockedInsertions = [...new Set([...p.unlockedInsertions, 'town-square', 'route-1', 'viridian-forest', 'viridian-city'])];
    p.firstWordsHeard = ['lab', 'loadout', 'dropin', 'check', 'center'];
    p.keysLearned = ['walk', 'look'];
    if (!raid) {
      p.errands = [{ id: 'brocks-crate', status: 'started', found: 1, lossesHeard: 0 }];
      save.stash.items['brocks-crate'] = 1;
    }
  }`);

  // The yard, with the look key held: every door says what is waiting inside.
  await page.keyDown('KeyL');
  await sleep(700);
  await page.screenshot(`${out}/yard-look.png`);
  await page.keyUp('KeyL');

  // Nurse Joy asks.
  await walkIntoBase(page, 'pokemon-centre');
  await sleep(500);
  expectSaid(await said(), 'Could I ask a favour?', 'Joy asks');
  await page.screenshot(`${out}/joy-asks.png`);
  await click('[data-speech-done]', 'Got it');
  if ((await progress()).errands.find((e) => e.id === 'medicine-bag')?.status !== 'started') throw new Error('Joy asked and nothing was recorded');
  await leave();
  // Walking in again: asked once, never twice.
  await walkIntoBase(page, 'pokemon-centre');
  await sleep(400);
  if ((await said()).length > 0) throw new Error(`Joy asked again: ${JSON.stringify(await said())}`);
  await leave();

  // Brock takes the crate the raid brought home, and pays.
  if (!((await vault()).items['brocks-crate'] > 0)) throw new Error('there is no crate in the vault to hand over');
  await walkIntoBase(page, 'brocks-workshop');
  await sleep(500);
  expectSaid(await said(), "You handed over Brock's crate.", 'Brock thanks');
  await page.screenshot(`${out}/brock-thanks.png`);
  const after = await vault();
  if (after.items['brocks-crate'] || after.items['tm39-rock-tomb'] !== 1) throw new Error(`the vault holds ${JSON.stringify(after.items)}`);
  await click('[data-speech-done]', 'Got it');
  await leave();
  // And the crate stands on his bench: one step up off the mat to see it.
  await press('ArrowUp');
  await sleep(600);
  const room = await page.evaluate(`${GAME}.scene.getScene('base').room?.id`);
  if (room !== 'brocks-workshop') throw new Error(`backed out into ${room}`);
  await page.screenshot(`${out}/brock-room.png`);

  // Oak's parcel was found and lost with the pack: he asks after it.
  await load(`(save) => { save.raidProgress.errands = [...save.raidProgress.errands.filter((e) => e.id !== 'oaks-parcel'), { id: 'oaks-parcel', status: 'started', found: 1, lossesHeard: 0 }]; }`);
  await walkIntoBase(page, 'oaks-lab');
  await sleep(500);
  expectSaid(await said(), 'You found my parcel, and it never made it home?', 'Oak hears of the loss');
  await page.screenshot(`${out}/oak-lost.png`);
  await click('[data-speech-done]', 'Got it');
  const oak = (await progress()).errands.find((e) => e.id === 'oaks-parcel');
  if (oak.lossesHeard !== 1) throw new Error(`Oak's loss is recorded as ${JSON.stringify(oak)}`);
  // Oak's board lists every errand in hand under his contracts.
  const board = await page.evaluate(`document.querySelector('.objectives-panel')?.innerText ?? ''`);
  if (!/ERRANDS/i.test(board) || !/Oak's Parcel/i.test(board)) throw new Error(`the lab's board has no errands: ${board.slice(0, 300)}`);
  await page.screenshot(`${out}/lab-board.png`);

  // The drop-in screen names the errands on the map being looked at.
  await click('[data-deploy-flow]', 'Start a raid');
  await page.waitFor(takePokemon(), { what: 'a Pokémon for the raid' });
  await click('[data-advance]', 'on to the drop-in');
  await click('button[data-insertion="route-1"]', 'Route 1');
  await sleep(600);
  const pane = await page.evaluate(`document.querySelector('.dropin-layout, .px-body')?.innerText ?? ''`);
  if (!/MEDICINE BAG/i.test(pane) || !/THE STEADING/.test(pane)) throw new Error(`the drop-in pane does not name Joy's bag: ${pane.slice(0, 400)}`);
  await page.screenshot(`${out}/dropin-errand.png`);
  console.log('drop-in: names the medicine bag in THE STEADING');

  // Bill asks, last, so his cottage is photographed with the amber not yet on his desk.
  await load(`(save) => save`);
  await walkIntoBase(page, 'bills-cottage');
  await sleep(500);
  expectSaid(await said(), 'Say, you are going out there anyway', 'Bill asks');
  await page.screenshot(`${out}/bill-asks.png`);
} finally {
  await page.close();
  await browser.close();
}
