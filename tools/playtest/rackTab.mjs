// Tab between the areas of THE ARMOURY RACK (`docs/screens/rack-tab/`).
//
//   node tools/playtest/rackTab.mjs <test-mode build url> <out dir> [--port=N]
//
// A new save with a long stash walks into THE RAID ARENA and opens the rack.
// Left and Right are the counts' there, so the PACK side was reached only by Down
// through every supply row (the navigation audit, 25 Nov 2026). Tab must go from
// the supplies to the pack, then to the X in the header, then back to the supply
// row it left; Shift+Tab must go the other way; and Tab must never leave the
// panel.
// Each step is logged and the pack photographed; it exits non-zero on the first
// that goes wrong.
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW, sleep } from './browser.mjs';
import { SAVE_KEY, sceneIs, takePokemon, walkIntoBase, openHallPanel } from './deploy.mjs';

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [url, out] = args.filter((arg) => !arg.startsWith('--'));
if (!url || !out) throw new Error('usage: rackTab.mjs <test-mode build url> <out dir> [--port=N]');
mkdirSync(out, { recursive: true });

const browser = option('port') ? attachBrowser(Number(option('port')), { window: PIXEL_WINDOW }) : await launchBrowser({ window: PIXEL_WINDOW });
const faults = [];
const expect = (what, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) faults.push(what);
};
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url });
  const until = async (expression, what = expression) => {
    for (let guard = 0; guard < 600; guard += 1) {
      if (await page.evaluate(expression)) return;
      await sleep(100);
    }
    throw new Error(`never saw ${what}`);
  };
  const press = async (code, modifiers = 0) => {
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: code === 'Tab' ? 'Tab' : code, windowsVirtualKeyCode: code === 'Tab' ? 9 : 0, modifiers });
    await sleep(50);
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: code === 'Tab' ? 'Tab' : code, windowsVirtualKeyCode: code === 'Tab' ? 9 : 0, modifiers });
    await sleep(200);
  };
  const walkPress = async (code) => {
    await page.keyDown(code);
    await sleep(50);
    await page.keyUp(code);
    await sleep(140);
  };
  await until(sceneIs('title'), 'the title screen');
  await walkPress('Space');
  await until(sceneIs('base'), 'the starter picker');
  await until(`window.__escapeFromPalletTownGame__.scene.getScene('base')?.takeStarterForDriver?.("bulbasaur") === true`);
  await until(`localStorage.getItem('${SAVE_KEY}') !== null`, 'the save');
  await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    save.stash.items = { ...save.stash.items, potion: 6, 'super-potion': 4, 'poke-ball': 6, 'great-ball': 3, 'oran-berry': 2, antidote: 3, 'cheri-berry': 2 };
    save.raidProgress.firstWordsHeard = ['lab', 'loadout', 'check', 'center'];
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
  await page.send('Page.navigate', { url });
  await until(sceneIs('title'), 'the title again');
  await walkPress('Space');
  await until(sceneIs('base'), 'the base');
  await walkIntoBase(page, 'raid-arena', { press: walkPress, until });
  await until(takePokemon('Bulbasaur'), 'Bulbasaur in the party');
  await openHallPanel(page, 'rack', { press: walkPress, until });
  await sleep(600);

  const where = () =>
    page.evaluate(`(() => {
      const a = document.activeElement;
      if (!a || !document.querySelector('#screens')?.contains(a)) return { area: 'outside', what: a?.tagName ?? null };
      const area = a.closest('.pack-window') ? 'pack' : a.closest('.loadout-stash') ? 'supplies' : a.closest('.px-title') ? 'header' : 'other';
      return { area, what: a.getAttribute('aria-label') || a.innerText.trim().slice(0, 30) };
    })()`);
  const start = await where();
  console.log(`opened on ${JSON.stringify(start)}`);
  expect('the rack opens in the supplies', start.area === 'supplies');
  await press('ArrowDown');
  await press('ArrowDown');
  const row = await where();

  await press('Tab');
  const pack = await where();
  console.log(`Tab: ${JSON.stringify(pack)}`);
  expect('Tab goes to the pack', pack.area === 'pack');
  await page.screenshot(`${out}/after-tab-to-pack.png`);
  await press('Tab');
  const close = await where();
  console.log(`Tab: ${JSON.stringify(close)}`);
  expect('Tab again goes to the header and its X', close.area === 'header');
  await press('Tab');
  const back = await where();
  console.log(`Tab: ${JSON.stringify(back)}`);
  expect('and Tab again round to the supply row it left', back.area === 'supplies' && back.what === row.what);
  await press('Tab', 8);
  await press('Tab', 8);
  const shiftBack = await where();
  console.log(`Shift+Tab twice: ${JSON.stringify(shiftBack)}`);
  expect('Shift+Tab goes the other way, past the header to the pack', shiftBack.area === 'pack');
  for (let k = 0; k < 6; k += 1) await press('Tab');
  expect('Tab never leaves the panel', (await where()).area !== 'outside');
  if (faults.length > 0) {
    process.exitCode = 1;
  } else {
    console.log('ok');
  }
} finally {
  await browser.close();
}
