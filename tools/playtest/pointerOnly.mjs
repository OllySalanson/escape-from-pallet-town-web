// The pointer only lights a thing, and never moves the cursor (`ui/pointerPreview.ts`,
// `docs/screens/pointer-only/`).
//
//   node tools/playtest/pointerOnly.mjs <test-mode build url> <out dir> [--window=WxH] [--port=N]
//
// A new save chooses its partner, X opens THE POKéDEX in the yard, and the mouse
// comes to rest on PIKACHU's tile: the cursor must stay on the tile it opened on,
// the card beside the grid must answer PIKACHU, and the help bar must name it.
// Moved off the grid, the card must answer the cursor's tile again; a click on
// the tile then presses it, opening its page. Each step is photographed and logged, and
// it exits non-zero on the first that goes wrong. It steps a paused loop, so it
// wants a test-mode build.
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [url, out] = args.filter((arg) => !arg.startsWith('--'));
if (!url || !out) throw new Error('usage: pointerOnly.mjs <test-mode build url> <out dir> [--port=N]');
mkdirSync(out, { recursive: true });
const FRAME_MS = 1000 / 60;
const PANEL = '#screens .pokedex-menu';

const sized = /^(\d+)x(\d+)$/.exec(option('window') ?? '');
const WINDOW = sized ? { width: Number(sized[1]), height: Number(sized[2]) } : PIXEL_WINDOW;
const browser = option('port') ? attachBrowser(Number(option('port')), { window: WINDOW }) : await launchBrowser({ window: WINDOW });
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { timeoutMs: 60_000 });
  await page.evaluate(`localStorage.clear(); localStorage.setItem('escape-from-pallet-town.player.name', 'PIP')`);
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { timeoutMs: 60_000 });
  await page.evaluate(`${GAME}.pauseLoop()`);
  const step = (count = 1) => page.evaluate(`${GAME}.stepFrames(${count}, ${FRAME_MS})`);
  const wait = (ms) => step(Math.max(1, Math.round(ms / FRAME_MS)));
  const until = async (expression, what = expression) => {
    for (let tries = 0; tries < 400; tries += 1) {
      if (await page.evaluate(expression)) return;
      await wait(100);
    }
    await page.screenshot(`${out}/stuck.png`);
    throw new Error(`never saw ${what}`);
  };
  const press = async (code) => {
    await page.keyDown(code);
    await step(1);
    await page.keyUp(code);
    await step(2);
  };
  const BASE = `${GAME}.scene.getScene('base')`;
  const baseReady = `${sceneIs('base')} && ${BASE}.ready`;
  const faults = [];
  const expect = (what, ok) => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
    if (!ok) faults.push(what);
  };
  const state = async () =>
    JSON.parse(
      await page.evaluate(`JSON.stringify({
        cursor: document.activeElement?.dataset?.dex ?? null,
        card: document.querySelector('${PANEL} [data-dex-card]')?.dataset.dexCard ?? null,
        cardShown: document.querySelector('${PANEL} [data-dex-card]')?.offsetParent != null,
        help: document.querySelector('${PANEL} [data-help-text]')?.textContent ?? '',
      })`),
    );
  const centreOf = (selector) =>
    page.evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  const mouse = (type, at) =>
    page.send('Input.dispatchMouseEvent', { type, x: at.x, y: at.y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: 1 });

  await press('Space');
  await until(sceneIs('base'), 'the starter table');
  await until(`${BASE}?.takeStarterForDriver?.("bulbasaur") === true`);
  await wait(300);
  await until(baseReady, 'the harbour');
  await page.evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    save.raidProgress.pokedexOwned = [1, 25];
    save.raidProgress.pokedexSeen = [16];
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save));
  })()`);
  await page.evaluate(`void ${BASE}.scene.start('base', {})`);
  await until(baseReady, 'the harbour again');
  await press('Escape');
  await wait(300);
  await press('KeyX');
  await until(`${sceneIs('pokedex')} && Boolean(document.querySelector('${PANEL} [data-dex]'))`, 'THE POKéDEX');
  await wait(500);
  const opened = await state();
  console.log(`opened: ${JSON.stringify(opened)}`);

  await mouse('mouseMoved', await centreOf(`${PANEL} [data-dex="25"]`));
  await wait(200);
  const pointing = await state();
  console.log(`pointing at PIKACHU: ${JSON.stringify(pointing)}`);
  expect('the cursor stays on the tile it opened on', pointing.cursor === opened.cursor);
  // A window too narrow for the card hides it, and the help bar names the tile there.
  expect('the help bar answers the tile pointed at', pointing.help.includes('PIKACHU'));
  if (pointing.cardShown) {
    expect('and so does the card', pointing.card === '25');
  }
  await page.screenshot(`${out}/after-pointing.png`);

  await mouse('mouseMoved', { x: 4, y: 4 });
  await wait(200);
  const left = await state();
  console.log(`pointer gone: ${JSON.stringify(left)}`);
  expect("and the cursor's tile again once the pointer leaves", left.help === opened.help && left.cursor === opened.cursor && (!left.cardShown || left.card === opened.cursor));

  // A click presses the tile: it opens PIKACHU's page.
  const tile = await centreOf(`${PANEL} [data-dex="25"]`);
  await mouse('mousePressed', tile);
  await mouse('mouseReleased', tile);
  await wait(400);
  expect('a click presses the tile pointed at', await page.evaluate(`Boolean(document.querySelector('${PANEL} [data-dex-page="25"]'))`));
  if (faults.length > 0) {
    process.exitCode = 1;
  } else {
    console.log('ok');
  }
} finally {
  await browser.close();
}
