// Photographs Bill's Cottage and Brock's Workshop in the states a player meets
// them in - opened, the cursor moved along the cards, a deal asked again - on a
// save with money and a few parts, for `docs/screens/menu-look/shops/`.
//
//   node tools/playtest/shopStates.mjs <test-mode build url> <out dir> [--window=1280x800] [--rich] [--port=CDP port]
//
// `--rich` gives the save every part Brock asks for, so his builds read ready.
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, sleep } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [url = 'http://localhost:5173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const [width, height] = (option('window') ?? '1280x800').split('x').map(Number);
const rich = args.includes('--rich');
mkdirSync(out, { recursive: true });

const BASE = `${GAME}.scene.getScene('base')`;
const browser = option('port') ? attachBrowser(Number(option('port')), { window: { width, height } }) : await launchBrowser({ window: { width, height } });
try {
  const page = await browser.openPage(`${url}?testmode=pixels`);
  const until = (expression, what) => page.waitFor(expression, { what, timeoutMs: 60_000 });
  // An attached browser keeps the last driver's save, and a save with a partner has no starter to take: start from none.
  await until(sceneIs('title'), 'the title');
  await page.evaluate('localStorage.clear()');
  await page.send('Page.navigate', { url: `${url}?testmode=pixels` });
  await until(sceneIs('title'), 'the title');
  await page.tap('Space');
  await until(sceneIs('base'), 'the harbour');
  await until(`${BASE}?.takeStarterForDriver?.("squirtle") === true`, 'Squirtle off the table');
  await until(`localStorage.getItem('${SAVE_KEY}') !== null`, 'the save');
  const parts = rich
    ? { 'radio-valve': 9, 'mooring-rope': 9, 'parts-crate': 9, 'lamp-oil': 9, 'cable-coil': 9, 'linen-roll': 9 }
    : { 'radio-valve': 3, 'mooring-rope': 2 };
  await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}')); const p = save.raidProgress;
    p.firstContractExtracted = true;
    p.standingContractsBanked = 3;
    Object.assign(save.stash.items, { 'poke-ball': 6, potion: 5, money: 640 }, ${JSON.stringify(parts)});
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
  for (const view of ['trader', 'workshop']) {
    await page.send('Page.navigate', { url: `${url}?testmode=pixels` });
    await until(sceneIs('title'), 'the title');
    await page.tap('Space');
    await until(`${sceneIs('base')} && ${BASE}.ready`, 'the harbour');
    await sleep(600);
    await page.evaluate(`${BASE}.openHub({ savedGame: ${BASE}.savedGame, view: '${view}', at: { ...${BASE}.currentTile } })`);
    await sleep(1500);
    await page.screenshot(`${out}/${view}-open.png`);
    await page.tap('ArrowRight');
    await page.tap('ArrowRight');
    await sleep(500);
    await page.screenshot(`${out}/${view}-moved.png`);
    await page.tap('ArrowDown');
    await sleep(500);
    await page.screenshot(`${out}/${view}-down.png`);
    await page.tap('ArrowUp');
    await page.tap('ArrowLeft');
    await page.tap('ArrowLeft');
    await page.tap('Enter');
    await sleep(700);
    await page.screenshot(`${out}/${view}-asked.png`);
    // The question opens on NOT NOW; Right is the answer that spends.
    await page.tap('ArrowRight');
    await page.tap('Enter');
    await sleep(250);
    await page.screenshot(`${out}/${view}-done.png`);
    await sleep(1200);
    await page.screenshot(`${out}/${view}-after.png`);
    console.log(`shot ${view}`);
  }
} finally {
  await browser.close();
}
